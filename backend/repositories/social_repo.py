from typing import Optional, List, Dict, Any, Tuple
from sqlmodel import Session, select, func
from sqlalchemy import text, case
from models import Vote, Wishlist, Campground, User, CheckIn, Trip, TripMember, Comment, VisitorPhoto
from schemas import (
    VoteResponse, WishlistToggleResponse, DashboardResponse, WishlistCampgroundItem,
    CheckInOut, TripOut
)
from services.cloudinary_service import get_user_avatar_url

class SocialRepository:
    """Repository handling all Social interactions, Voting, Wishlists, and Dashboard SQL queries."""

    def get_vote_counts(self, session: Session, campground_id: int) -> Tuple[int, int]:
        row = session.exec(
            select(
                func.coalesce(func.sum(case((Vote.vote_type == 1, 1), else_=0)), 0),
                func.coalesce(func.sum(case((Vote.vote_type == -1, 1), else_=0)), 0)
            ).where(Vote.campground_id == campground_id)
        ).first()
        return (int(row[0]), int(row[1])) if row else (0, 0)

    def toggle_vote(
        self,
        session: Session,
        campground_id: int,
        user_id: int,
        vote_type: int
    ) -> VoteResponse:
        existing = session.exec(
            select(Vote).where(Vote.user_id == user_id, Vote.campground_id == campground_id)
        ).first()

        if existing:
            if existing.vote_type == vote_type:
                session.delete(existing)
                message = "Vote removed"
                active_vote = 0
            else:
                existing.vote_type = vote_type
                session.add(existing)
                message = "Vote updated"
                active_vote = vote_type
        else:
            new_vote = Vote(user_id=user_id, campground_id=campground_id, vote_type=vote_type)
            session.add(new_vote)
            message = "Vote recorded"
            active_vote = vote_type

        session.commit()
        likes, dislikes = self.get_vote_counts(session, campground_id)

        return VoteResponse(
            message=message,
            likes=likes,
            dislikes=dislikes,
            user_vote=active_vote
        )

    def get_vote_stats(
        self,
        session: Session,
        campground_id: int,
        current_user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        likes, dislikes = self.get_vote_counts(session, campground_id)
        user_vote = 0
        is_wishlisted = False

        if current_user_id:
            v = session.exec(
                select(Vote.vote_type).where(Vote.campground_id == campground_id, Vote.user_id == current_user_id)
            ).first()
            user_vote = int(v) if v is not None else 0

            w = session.exec(
                select(Wishlist).where(Wishlist.campground_id == campground_id, Wishlist.user_id == current_user_id)
            ).first()
            is_wishlisted = bool(w)

        return {
            "campground_id": campground_id,
            "likes": likes,
            "dislikes": dislikes,
            "net_score": likes - dislikes,
            "user_vote": user_vote,
            "is_wishlisted": is_wishlisted
        }

    def toggle_wishlist(
        self,
        session: Session,
        campground_id: int,
        user_id: int
    ) -> WishlistToggleResponse:
        existing = session.exec(
            select(Wishlist).where(Wishlist.campground_id == campground_id, Wishlist.user_id == user_id)
        ).first()

        if existing:
            session.delete(existing)
            session.commit()
            is_wish = False
            msg = "Removed from wishlist"
        else:
            new_w = Wishlist(campground_id=campground_id, user_id=user_id)
            session.add(new_w)
            session.commit()
            is_wish = True
            msg = "Added to wishlist"

        total_wish = session.exec(
            select(func.count(Wishlist.campground_id)).where(Wishlist.user_id == user_id)
        ).one() or 0

        return WishlistToggleResponse(
            message=msg,
            is_wishlisted=is_wish,
            wishlist_count=total_wish
        )

    def get_dashboard(
        self,
        session: Session,
        current_user: User
    ) -> Dict[str, Any]:
        """Single-query summary for dashboard stats, wishlist, and hosted campgrounds."""
        # 1. Wishlist items
        wishlist_rows = session.exec(
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

        total_wishlist_count = session.exec(
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

        my_camps_rows = session.exec(
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
                "name": r[1],
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

    def create_checkin(
        self,
        session: Session,
        campground_id: int,
        user_id: int
    ) -> CheckIn:
        checkin = CheckIn(campground_id=campground_id, user_id=user_id)
        session.add(checkin)
        session.commit()
        session.refresh(checkin)
        return checkin

    def create_trip(
        self,
        session: Session,
        owner_id: int,
        name: str
    ) -> Trip:
        trip = Trip(owner_id=owner_id, name=name.strip())
        session.add(trip)
        session.commit()
        session.refresh(trip)

        member = TripMember(trip_id=trip.id, user_id=owner_id)
        session.add(member)
        session.commit()
        return trip

    def get_user_trips(
        self,
        session: Session,
        user_id: int
    ) -> List[TripOut]:
        trips = session.exec(
            select(Trip)
            .join(TripMember, TripMember.trip_id == Trip.id)
            .where(TripMember.user_id == user_id)
        ).all()

        out = []
        for t in trips:
            members_rows = session.exec(
                select(User.id, User.username, User.avatar_url)
                .join(TripMember, TripMember.user_id == User.id)
                .where(TripMember.trip_id == t.id)
            ).all()

            members_list = [
                {
                    "user_id": m[0],
                    "username": m[1],
                    "avatar_url": get_user_avatar_url(m[1], m[2])
                }
                for m in members_rows
            ]

            out.append(
                TripOut(
                    id=t.id,
                    name=t.name,
                    owner_id=t.owner_id,
                    member_ids=[m[0] for m in members_rows]
                )
            )
        return out

    def get_checkins(
        self,
        session: Session,
        campground_id: int
    ) -> List[Dict[str, Any]]:
        rows = session.exec(
            select(
                CheckIn.id,
                CheckIn.user_id,
                func.coalesce(User.username, "Adventurer").label("username"),
                CheckIn.campground_id,
                CheckIn.timestamp
            )
            .join(User, CheckIn.user_id == User.id, isouter=True)
            .where(CheckIn.campground_id == campground_id)
            .order_by(CheckIn.id.desc())
        ).all()
        return [r._asdict() for r in rows]

    def add_trip_member(
        self,
        session: Session,
        trip_id: int,
        user_id: int
    ) -> Optional[Trip]:
        trip = session.get(Trip, trip_id)
        if not trip:
            return None
        existing = session.exec(
            select(TripMember).where(TripMember.trip_id == trip_id, TripMember.user_id == user_id)
        ).first()
        if not existing:
            member = TripMember(trip_id=trip_id, user_id=user_id)
            session.add(member)
            session.commit()
            session.refresh(trip)
        return trip

social_repo = SocialRepository()
