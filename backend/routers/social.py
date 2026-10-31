from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session

from models import Campground, User, Trip
from database import get_session
from dependencies import is_logged_in, get_current_user
from schemas import (
    VoteResponse, WishlistToggleResponse, DashboardResponse,
    CheckInCreate, CheckInOut, TripCreate, TripOut, TripMemberAdd
)
from services.limiter import limiter
from config import settings
from repositories.social_repo import social_repo

router = APIRouter(tags=["social"])

@router.post("/campgrounds/{id}/vote", response_model=VoteResponse)
@limiter.limit(settings.RATE_LIMIT_SOCIAL_ACTION)
def toggle_vote(
    id: int,
    request: Request,
    vote_type: int = Query(..., description="1 for like, -1 for dislike"),
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Upvote (+1) or downvote (-1) a campsite via repository."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    
    if vote_type not in (1, -1):
        raise HTTPException(status_code=400, detail="Invalid vote type. Must be 1 (like) or -1 (dislike)")

    return social_repo.toggle_vote(db, id, current_user.id, vote_type)

@router.get("/campgrounds/{id}/stats")
def get_stats(
    id: int,
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Retrieve community vote statistics and user state for a campsite directly from SQL engine."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    
    user_id = current_user.id if current_user else None
    return social_repo.get_vote_stats(db, id, user_id)

@router.post("/campgrounds/{id}/wishlist", response_model=WishlistToggleResponse)
@limiter.limit(settings.RATE_LIMIT_SOCIAL_ACTION)
def toggle_wishlist(
    id: int,
    request: Request,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Toggle a campsite in the authenticated user's wishlist."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    return social_repo.toggle_wishlist(db, id, current_user.id)

@router.get("/me/dashboard", response_model=DashboardResponse)
def get_my_dashboard(
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """
    Retrieve dashboard statistics, wishlist items, and hosted campgrounds.
    Single-query summary executed inside worker threadpool.
    """
    return social_repo.get_dashboard(db, current_user)

@router.post("/campgrounds/{id}/checkin", response_model=CheckInOut)
@limiter.limit("20/minute")
def add_checkin(
    id: int,
    request: Request,
    data: Optional[CheckInCreate] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Record an on-site field check-in."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    checkin = social_repo.create_checkin(db, id, current_user.id)
    return CheckInOut(
        id=checkin.id,
        user_id=current_user.id,
        username=current_user.username,
        campground_id=id,
        timestamp=checkin.timestamp
    )

@router.get("/campgrounds/{id}/checkins", response_model=List[CheckInOut])
def get_checkins(id: int, db: Session = Depends(get_session)):
    """Retrieve field check-in history for a campsite via repository."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    return social_repo.get_checkins(db, id)

@router.post("/trips", response_model=TripOut)
def create_trip(
    data: TripCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Create a collaborative backcountry expedition trip."""
    trip = social_repo.create_trip(db, current_user.id, data.name)
    return TripOut(
        id=trip.id,
        name=trip.name,
        owner_id=trip.owner_id,
        member_ids=[m.user_id for m in trip.members]
    )

@router.get("/trips", response_model=List[TripOut])
def get_my_trips(
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """List trips owned by or joined by the authenticated scout."""
    return social_repo.get_user_trips(db, current_user.id)

@router.post("/trips/{trip_id}/members", response_model=TripOut)
def add_trip_member(
    trip_id: int,
    data: TripMemberAdd,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Add a group member to an expedition trip."""
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the trip owner can add members")

    invited_user = db.get(User, data.user_id)
    if not invited_user:
        raise HTTPException(status_code=404, detail="User to invite not found")

    updated_trip = social_repo.add_trip_member(db, trip_id, data.user_id)
    return TripOut(
        id=updated_trip.id,
        name=updated_trip.name,
        owner_id=updated_trip.owner_id,
        member_ids=[m.user_id for m in updated_trip.members]
    )
