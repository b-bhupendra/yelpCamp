from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from sqlmodel import Session, select
from models import Vote, Campground, User, Wishlist, CheckIn, Trip, TripMember
from database import get_session
from dependencies import is_logged_in
from schemas import (
    VoteResponse, WishlistToggleResponse, DashboardResponse,
    CheckInCreate, CheckInOut, TripCreate, TripOut, TripMemberAdd
)
from services.cloudinary_service import get_user_avatar_url

router = APIRouter(tags=["social"])

@router.post("/vote", response_model=VoteResponse)
async def toggle_vote(
    id: int,
    vote_type: int = Query(..., description="1 for like, -1 for dislike"),
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    
    if vote_type not in [1, -1]:
        raise HTTPException(status_code=400, detail="Invalid vote type. Must be 1 (like) or -1 (dislike)")

    # Check for existing vote
    existing_vote = db.exec(
        select(Vote).where(Vote.user_id == current_user.id, Vote.campground_id == id)
    ).first()

    if existing_vote:
        if existing_vote.vote_type == vote_type:
            # Toggle off if clicking the same one
            db.delete(existing_vote)
            message = "Vote removed"
            active_vote = 0
        else:
            # Change vote type
            existing_vote.vote_type = vote_type
            db.add(existing_vote)
            message = "Vote updated"
            active_vote = vote_type
    else:
        # Create new vote
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

@router.get("/stats")
async def get_stats(id: int, db: Session = Depends(get_session)):
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    
    likes = len([v for v in campground.votes if v.vote_type == 1])
    dislikes = len([v for v in campground.votes if v.vote_type == -1])
    
    return {"likes": likes, "dislikes": dislikes}

@router.post("/wishlist", response_model=WishlistToggleResponse)
async def toggle_wishlist(
    id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
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
    my_camps = current_user.campgrounds
    total_posts = len(my_camps)
    
    total_likes = 0
    for camp in my_camps:
        total_likes += len([v for v in camp.votes if v.vote_type == 1])
    
    wishlist_entries = db.exec(select(Wishlist).where(Wishlist.user_id == current_user.id)).all()
    wishlist_items = []
    for w in wishlist_entries:
        camp = db.get(Campground, w.campground_id)
        if camp:
            wishlist_items.append({
                "id": camp.id,
                "name": camp.name,
                "image": camp.image,
                "price": camp.price
            })
        
    return {
        "username": current_user.username,
        "avatar_url": get_user_avatar_url(current_user.username, current_user.avatar_url),
        "total_posts": total_posts,
        "total_likes": total_likes,
        "wishlist_count": len(wishlist_items),
        "wishlist": wishlist_items[:10]
    }

@router.post("/checkin", response_model=CheckInOut)
async def add_checkin(
    id: int,
    data: Optional[CheckInCreate] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
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

@router.get("/checkins", response_model=List[CheckInOut])
async def get_checkins(id: int, db: Session = Depends(get_session)):
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    results = []
    for c in campground.check_ins:
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
