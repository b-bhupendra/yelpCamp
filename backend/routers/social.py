from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session, select
from models import Vote, Campground, User, Wishlist, CheckIn, Trip, TripMember
from database import get_session
from dependencies import is_logged_in
from schemas import (
    VoteResponse, WishlistToggleResponse, DashboardResponse,
    CheckInCreate, CheckInOut, TripCreate, TripOut, TripMemberAdd
)
from services.cloudinary_service import get_user_avatar_url
from services.limiter import limiter
from config import settings

router = APIRouter(tags=["social"])

@router.post("/campgrounds/{id}/vote", response_model=VoteResponse)
@limiter.limit(settings.RATE_LIMIT_SOCIAL_ACTION)
async def toggle_vote(
    id: int,
    request: Request,
    vote_type: int = Query(..., description="1 for like, -1 for dislike"),
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Upvote (+1) or downvote (-1) a campsite."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    
    if vote_type not in [1, -1]:
        raise HTTPException(status_code=400, detail="Invalid vote type. Must be 1 (like) or -1 (dislike)")

    existing_vote = db.exec(
        select(Vote).where(Vote.user_id == current_user.id, Vote.campground_id == id)
    ).first()

    if existing_vote:
        if existing_vote.vote_type == vote_type:
            db.delete(existing_vote)
            message = "Vote removed"
            active_vote = 0
        else:
            existing_vote.vote_type = vote_type
            db.add(existing_vote)
            message = "Vote updated"
            active_vote = vote_type
    else:
        new_vote = Vote(user_id=current_user.id, campground_id=id, vote_type=vote_type)
        db.add(new_vote)
        message = "Vote recorded"
        active_vote = vote_type

    db.commit()
    db.refresh(campground)
    
    likes = len([v for v in campground.votes if v.vote_type == 1])
    dislikes = len([v for v in campground.votes if v.vote_type == -1])
    
    return {
        "message": message,
        "likes": likes,
        "dislikes": dislikes,
        "user_vote": active_vote
    }

@router.get("/campgrounds/{id}/stats")
async def get_stats(id: int, db: Session = Depends(get_session)):
    """Retrieve community vote statistics for a campsite."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    
    likes = len([v for v in campground.votes if v.vote_type == 1])
    dislikes = len([v for v in campground.votes if v.vote_type == -1])
    return {"likes": likes, "dislikes": dislikes}

@router.post("/campgrounds/{id}/wishlist", response_model=WishlistToggleResponse)
@limiter.limit(settings.RATE_LIMIT_SOCIAL_ACTION)
async def toggle_wishlist(
    id: int,
    request: Request,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Toggle a campsite in the authenticated user's wishlist."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    existing_wishlist = db.exec(
        select(Wishlist).where(
            Wishlist.user_id == current_user.id,
            Wishlist.campground_id == id
        )
    ).first()

    if existing_wishlist:
        db.delete(existing_wishlist)
        db.commit()
        is_wishlisted = False
        message = "Removed from wishlist"
    else:
        new_wishlist = Wishlist(user_id=current_user.id, campground_id=id)
        db.add(new_wishlist)
        db.commit()
        is_wishlisted = True
        message = "Added to wishlist"

    user_wishlist_count = len(db.exec(select(Wishlist).where(Wishlist.user_id == current_user.id)).all())

    return {
        "message": message,
        "is_wishlisted": is_wishlisted,
        "wishlist_count": user_wishlist_count
    }

@router.get("/me/dashboard", response_model=DashboardResponse)
async def get_my_dashboard(
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Retrieve dashboard statistics, wishlist items, and hosted campgrounds for the current user."""
    my_camps = current_user.campgrounds or []
    total_posts = len(my_camps)
    
    total_likes = 0
    for camp in my_camps:
        total_likes += len([v for v in camp.votes if v.vote_type == 1]) if camp.votes else 0
    
    wishlist_entries = db.exec(select(Wishlist).where(Wishlist.user_id == current_user.id)).all()
    wishlist_items = []
    for w in wishlist_entries:
        camp = db.get(Campground, w.campground_id)
        if camp:
            wishlist_items.append({
                "id": camp.id,
                "title": camp.title,
                "image": camp.image,
                "price": float(camp.price) if camp.price is not None else 0.0
            })
        
    my_campgrounds_list = []
    for c in my_camps:
        c_likes = len([v for v in c.votes if v.vote_type == 1]) if c.votes else 0
        c_comments = len(c.comments) if hasattr(c, "comments") and c.comments else 0
        c_stories = len(c.visitor_photos) if hasattr(c, "visitor_photos") and c.visitor_photos else 0
        my_campgrounds_list.append({
            "id": c.id,
            "title": c.title,
            "image": c.image,
            "price": float(c.price) if c.price is not None else 0.0,
            "location_address": c.location_address or c.location or "",
            "avg_rating": c.avg_rating or 0.0,
            "likes_count": c_likes,
            "comments_count": c_comments,
            "stories_count": c_stories,
        })

    return {
        "username": current_user.username,
        "avatar_url": get_user_avatar_url(current_user.username, current_user.avatar_url),
        "total_posts": total_posts,
        "total_likes": total_likes,
        "wishlist_count": len(wishlist_items),
        "wishlist": wishlist_items[:10],
        "my_campgrounds": my_campgrounds_list,
    }

@router.post("/campgrounds/{id}/checkin", response_model=CheckInOut)
@limiter.limit("20/minute")
async def add_checkin(
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

    ts = (data.timestamp if data and data.timestamp else datetime.now(timezone.utc).isoformat())

    checkin = CheckIn(
        user_id=current_user.id,
        campground_id=id,
        timestamp=ts
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

    return {
        "id": checkin.id,
        "user_id": current_user.id,
        "username": current_user.username,
        "campground_id": id,
        "timestamp": checkin.timestamp
    }

@router.get("/campgrounds/{id}/checkins", response_model=List[CheckInOut])
async def get_checkins(id: int, db: Session = Depends(get_session)):
    """Retrieve field check-in history for a campsite."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    results = []
    for c in (campground.check_ins or []):
        u = db.get(User, c.user_id)
        results.append({
            "id": c.id,
            "user_id": c.user_id,
            "username": u.username if u else "Adventurer",
            "campground_id": c.campground_id,
            "timestamp": c.timestamp
        })
    return results

@router.post("/trips", response_model=TripOut)
async def create_trip(
    data: TripCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Create a collaborative backcountry expedition trip."""
    trip = Trip(name=data.name, owner_id=current_user.id)
    db.add(trip)
    db.commit()
    db.refresh(trip)

    return {
        "id": trip.id,
        "name": trip.name,
        "owner_id": trip.owner_id,
        "member_ids": [m.user_id for m in trip.members]
    }

@router.get("/trips", response_model=List[TripOut])
async def get_my_trips(
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """List trips owned by the authenticated scout."""
    trips = db.exec(select(Trip).where(Trip.owner_id == current_user.id)).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "owner_id": t.owner_id,
            "member_ids": [m.user_id for m in t.members]
        } for t in trips
    ]

@router.post("/trips/{trip_id}/members", response_model=TripOut)
async def add_trip_member(
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

    existing = db.exec(select(TripMember).where(TripMember.trip_id == trip_id, TripMember.user_id == data.user_id)).first()
    if not existing:
        member = TripMember(trip_id=trip_id, user_id=data.user_id)
        db.add(member)
        db.commit()
        db.refresh(trip)

    return {
        "id": trip.id,
        "name": trip.name,
        "owner_id": trip.owner_id,
        "member_ids": [m.user_id for m in trip.members]
    }
