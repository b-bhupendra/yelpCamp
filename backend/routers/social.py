from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session, select, func, case
from models import Vote, Campground, User, Wishlist, CheckIn, Trip, TripMember, Comment, VisitorPhoto
from database import get_session
from dependencies import is_logged_in
from schemas import (
    VoteResponse, WishlistToggleResponse, DashboardResponse, WishlistCampgroundItem,
    CheckInCreate, CheckInOut, TripCreate, TripOut, TripMemberAdd
)
from services.cloudinary_service import get_user_avatar_url
from services.limiter import limiter
from config import settings

router = APIRouter(tags=["social"])

def get_campground_vote_counts(db: Session, campground_id: int) -> tuple[int, int]:
    """
    Computes likes and dislikes in a single SQL conditional aggregation directly in the database engine.
    Zero Python in-memory iterating or filtering.
    """
    row = db.exec(
        select(
            func.coalesce(func.sum(case((Vote.vote_type == 1, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Vote.vote_type == -1, 1), else_=0)), 0)
        ).where(Vote.campground_id == campground_id)
    ).first()
    return (int(row[0]), int(row[1])) if row else (0, 0)

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
    
    # Single SQL conditional sum executed in DB engine
    likes, dislikes = get_campground_vote_counts(db, id)
    
    return VoteResponse(
        message=message,
        likes=likes,
        dislikes=dislikes,
        user_vote=active_vote
    )

@router.get("/campgrounds/{id}/stats")
async def get_stats(id: int, db: Session = Depends(get_session)):
    """Retrieve community vote statistics for a campsite directly from SQL engine."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    
    likes, dislikes = get_campground_vote_counts(db, id)
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

    user_wishlist_count = db.exec(
        select(func.count(Wishlist.campground_id)).where(Wishlist.user_id == current_user.id)
    ).one() or 0

    return WishlistToggleResponse(
        message=message,
        is_wishlisted=is_wishlisted,
        wishlist_count=user_wishlist_count
    )

@router.get("/me/dashboard", response_model=DashboardResponse)
async def get_my_dashboard(
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """
    Retrieve dashboard statistics, wishlist items, and hosted campgrounds.
    Database-heavy query architecture: joins pre-aggregated SQL subqueries
    directly in SQLite / Turso C layer. Zero Python looping.
    """
    # 1. Wishlist items via single SQL JOIN
    wishlist_rows = db.exec(
        select(Campground.id, Campground.title, Campground.image, Campground.price)
        .join(Wishlist, Wishlist.campground_id == Campground.id)
        .where(Wishlist.user_id == current_user.id)
        .limit(20)
    ).all()
    wishlist_items = [
        WishlistCampgroundItem(
            id=r[0],
            title=r[1],
            image=r[2],
            price=float(r[3]) if r[3] is not None else 0.0
        )
        for r in wishlist_rows
    ]

    total_wishlist_count = db.exec(
        select(func.count(Wishlist.campground_id)).where(Wishlist.user_id == current_user.id)
    ).one() or 0

    # 2. User's hosted campgrounds with metrics computed directly in SQL engine via subqueries
    v_sub = (
        select(Vote.campground_id, func.count(Vote.user_id).label("cnt"))
        .where(Vote.vote_type == 1)
        .group_by(Vote.campground_id)
        .subquery()
    )
    c_sub = (
        select(Comment.campground_id, func.count(Comment.id).label("cnt"))
        .group_by(Comment.campground_id)
        .subquery()
    )
    s_sub = (
        select(VisitorPhoto.campground_id, func.count(VisitorPhoto.id).label("cnt"))
        .group_by(VisitorPhoto.campground_id)
        .subquery()
    )

    my_camps_rows = db.exec(
        select(
            Campground.id,
            Campground.title,
            Campground.image,
            Campground.price,
            func.coalesce(func.nullif(Campground.location_address, ''), Campground.location, '').label("location_address"),
            Campground.avg_rating,
            func.coalesce(v_sub.c.cnt, 0).label("likes_count"),
            func.coalesce(c_sub.c.cnt, 0).label("comments_count"),
            func.coalesce(s_sub.c.cnt, 0).label("stories_count"),
        )
        .outerjoin(v_sub, v_sub.c.campground_id == Campground.id)
        .outerjoin(c_sub, c_sub.c.campground_id == Campground.id)
        .outerjoin(s_sub, s_sub.c.campground_id == Campground.id)
        .where(Campground.author_id == current_user.id)
        .order_by(Campground.id.desc())
    ).all()

    total_posts = len(my_camps_rows)
    total_likes = sum(r[6] for r in my_camps_rows)

    my_campgrounds_list = [
        {
            "id": r[0],
            "title": r[1],
            "image": r[2],
            "price": float(r[3]) if r[3] is not None else 0.0,
            "location_address": r[4] or "",
            "avg_rating": float(r[5] or 0.0),
            "likes_count": r[6],
            "comments_count": r[7],
            "stories_count": r[8],
        }
        for r in my_camps_rows
    ]

    return {
        "username": current_user.username,
        "avatar_url": get_user_avatar_url(current_user.username, current_user.avatar_url),
        "total_posts": total_posts,
        "total_likes": total_likes,
        "wishlist_count": total_wishlist_count,
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
    """
    Retrieve field check-in history for a campsite via a single SQL JOIN.
    Database row mappings stream directly to FastAPI response serializer.
    """
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    checkin_rows = db.exec(
        select(
            CheckIn.id,
            CheckIn.user_id,
            func.coalesce(User.username, "Adventurer").label("username"),
            CheckIn.campground_id,
            CheckIn.timestamp
        )
        .join(User, CheckIn.user_id == User.id, isouter=True)
        .where(CheckIn.campground_id == id)
        .order_by(CheckIn.id.desc())
    ).all()

    return [r._asdict() for r in checkin_rows]

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

    return TripOut(
        id=trip.id,
        name=trip.name,
        owner_id=trip.owner_id,
        member_ids=[m.user_id for m in trip.members]
    )

@router.get("/trips", response_model=List[TripOut])
async def get_my_trips(
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """List trips owned by the authenticated scout."""
    trips = db.exec(select(Trip).where(Trip.owner_id == current_user.id)).all()
    return [
        TripOut(
            id=t.id,
            name=t.name,
            owner_id=t.owner_id,
            member_ids=[m.user_id for m in t.members]
        )
        for t in trips
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

    return TripOut(
        id=trip.id,
        name=trip.name,
        owner_id=trip.owner_id,
        member_ids=[m.user_id for m in trip.members]
    )
