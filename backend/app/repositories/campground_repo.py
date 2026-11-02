import math
from typing import Optional, List, Dict, Any
from sqlmodel import Session, select, func, delete
from sqlalchemy import case

from app.models.campground import Campground, Vote, CampgroundEmbedding
from app.models.user import User
from app.models.visitor_photo import VisitorPhoto, VisitorPhotoLike
from app.models.social import Wishlist, CheckIn
from app.models.comment import Comment
from app.schemas.campground import (
    CampgroundCreate, CampgroundUpdate, CampgroundOut, CampgroundCard,
    PaginatedCampgrounds
)
from app.services.image_validator import sanitize_campground_image, sanitize_gallery_images

class CampgroundRepository:
    """Repository handling all pure SQL execution and aggregations for Campgrounds in Meadows."""

    def get_paginated(
        self,
        session: Session,
        page: int = 1,
        limit: int = 12,
        search: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        tag: Optional[str] = None,
        sort: Optional[str] = None
    ) -> PaginatedCampgrounds:
        offset = (page - 1) * limit

        # Pre-aggregate vote counts per campground
        v_sub = (
            select(
                Vote.campground_id,
                func.coalesce(func.sum(case((Vote.vote_type == 1, 1), else_=0)), 0).label("likes"),
                func.coalesce(func.sum(case((Vote.vote_type == -1, 1), else_=0)), 0).label("dislikes")
            )
            .group_by(Vote.campground_id)
            .subquery()
        )

        base_query = (
            select(
                Campground.id,
                Campground.title,
                Campground.price,
                Campground.image,
                Campground.description,
                Campground.location,
                Campground.location_address,
                Campground.avg_rating,
                Campground.author_id,
                func.coalesce(User.username, "").label("author_username"),
                func.coalesce(v_sub.c.likes, 0).label("likes_count"),
                func.coalesce(v_sub.c.dislikes, 0).label("dislikes_count"),
            )
            .outerjoin(User, User.id == Campground.author_id)
            .outerjoin(v_sub, v_sub.c.campground_id == Campground.id)
        )

        count_query = select(func.count(Campground.id))

        if search and search.strip():
            term = f"%{search.strip()}%"
            filter_pred = (
                Campground.title.ilike(term)
                | Campground.description.ilike(term)
                | Campground.location.ilike(term)
                | Campground.location_address.ilike(term)
            )
            base_query = base_query.where(filter_pred)
            count_query = count_query.where(filter_pred)

        if min_price is not None:
            base_query = base_query.where(Campground.price >= min_price)
            count_query = count_query.where(Campground.price >= min_price)

        if max_price is not None:
            base_query = base_query.where(Campground.price <= max_price)
            count_query = count_query.where(Campground.price <= max_price)

        if tag and tag.strip():
            tag_term = f"%{tag.strip()}%"
            tag_pred = (Campground.amenities.ilike(tag_term) | Campground.location.ilike(tag_term))
            base_query = base_query.where(tag_pred)
            count_query = count_query.where(tag_pred)

        total = session.exec(count_query).one() or 0
        total_pages = math.ceil(total / limit) if total > 0 else 1

        if sort == "price_asc":
            order_clause = Campground.price.asc()
        elif sort == "price_desc":
            order_clause = Campground.price.desc()
        elif sort == "title":
            order_clause = Campground.title.asc()
        else:
            order_clause = Campground.id.desc()

        rows = session.exec(
            base_query.order_by(order_clause).offset(offset).limit(limit)
        ).all()

        items = [
            CampgroundCard(
                id=r[0],
                title=r[1],
                price=float(r[2] or 0.0),
                image=r[3] or "",
                description=r[4] or "",
                location=r[5] or "",
                location_address=r[6] or "",
                avg_rating=float(r[7] or 0.0),
                author_id=r[8],
                author_username=r[9] or "",
                likes_count=int(r[10] or 0),
                dislikes_count=int(r[11] or 0)
            )
            for r in rows
        ]

        return PaginatedCampgrounds(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )

    def get_by_id(
        self,
        session: Session,
        campground_id: int,
        current_user_id: Optional[int] = None
    ) -> Optional[CampgroundOut]:
        campground = session.get(Campground, campground_id)
        if not campground:
            return None

        author = session.get(User, campground.author_id) if campground.author_id else None
        author_username = author.username if author else ""
        author_avatar = author.avatar_url if author else None

        likes_sub = select(func.count(Vote.user_id)).where(Vote.campground_id == campground_id, Vote.vote_type == 1).scalar_subquery()
        dislikes_sub = select(func.count(Vote.user_id)).where(Vote.campground_id == campground_id, Vote.vote_type == -1).scalar_subquery()
        stories_sub = select(func.count(VisitorPhoto.id)).where(VisitorPhoto.campground_id == campground_id).scalar_subquery()

        if current_user_id:
            user_vote_sub = select(Vote.vote_type).where(Vote.campground_id == campground_id, Vote.user_id == current_user_id).scalar_subquery()
            is_wish_sub = select(func.count(Wishlist.user_id)).where(Wishlist.campground_id == campground_id, Wishlist.user_id == current_user_id).scalar_subquery()
        else:
            user_vote_sub = select(func.coalesce(None, 0)).scalar_subquery()
            is_wish_sub = select(func.coalesce(None, 0)).scalar_subquery()

        stats_row = session.exec(
            select(
                func.coalesce(likes_sub, 0),
                func.coalesce(dislikes_sub, 0),
                func.coalesce(stories_sub, 0),
                func.coalesce(user_vote_sub, 0),
                func.coalesce(is_wish_sub, 0),
            )
        ).first()

        likes_cnt, dislikes_cnt, stories_cnt, user_vote, is_wishlisted = (
            stats_row if stats_row else (0, 0, 0, 0, 0)
        )

        from app.repositories.comment_repo import comment_repo
        comments_tree = comment_repo.get_campground_comment_tree(session, campground_id)

        return CampgroundOut(
            id=campground.id,
            title=campground.title,
            price=campground.price,
            image=campground.image,
            description=campground.description,
            location=campground.location,
            location_address=campground.location_address,
            avg_rating=campground.avg_rating,
            ai_media_caption=campground.ai_media_caption,
            community_summary=campground.community_summary,
            gallery_images=campground.gallery_images or [],
            amenities=campground.amenities or [],
            rules=campground.rules or {},
            author_id=campground.author_id,
            author_username=author_username,
            author_avatar=author_avatar,
            likes_count=likes_cnt,
            dislikes_count=dislikes_cnt,
            visitor_photos_count=stories_cnt,
            is_wishlisted=bool(is_wishlisted),
            user_vote=int(user_vote),
            comments_tree=comments_tree,
            comments=comments_tree
        )

    def create(
        self,
        session: Session,
        data: CampgroundCreate,
        author_id: int
    ) -> Campground:
        new_camp = Campground(
            title=data.title.strip(),
            price=data.price,
            image=data.image.strip() if data.image else "",
            description=data.description.strip() if data.description else "",
            location=data.location.strip() if data.location else "",
            location_address=data.location_address.strip() if data.location_address else "",
            gallery_images=data.gallery_images or [],
            amenities=data.amenities or [],
            rules=data.rules or {},
            author_id=author_id
        )
        session.add(new_camp)
        session.commit()
        session.refresh(new_camp)
        return new_camp

    def update(
        self,
        session: Session,
        campground: Campground,
        data: CampgroundUpdate
    ) -> Campground:
        if data.title is not None:
            campground.title = data.title.strip()
        if data.price is not None:
            campground.price = data.price
        if data.image is not None:
            campground.image = sanitize_campground_image(data.image.strip(), campground.id)
        if data.description is not None:
            campground.description = data.description.strip()
        if data.location is not None:
            campground.location = data.location.strip()
        if data.location_address is not None:
            campground.location_address = data.location_address.strip()
        if data.gallery_images is not None:
            campground.gallery_images = sanitize_gallery_images(data.gallery_images, campground.id)
        if data.amenities is not None:
            campground.amenities = data.amenities
        if data.rules is not None:
            campground.rules = data.rules

        session.add(campground)
        session.commit()
        session.refresh(campground)
        return campground

    def delete(self, session: Session, campground: Campground) -> int:
        """
        Executes atomic cascade delete directly in the DB engine using SQL subqueries.
        Safely cascades across all dependent entities (embeddings, photos, comments, votes, wishlists).
        """
        camp_id = campground.id

        session.exec(delete(CampgroundEmbedding).where(CampgroundEmbedding.campground_id == camp_id))
        photo_ids = select(VisitorPhoto.id).where(VisitorPhoto.campground_id == camp_id).scalar_subquery()
        session.exec(delete(VisitorPhotoLike).where(VisitorPhotoLike.photo_id.in_(photo_ids)))
        session.exec(delete(Comment).where(Comment.photo_id.in_(photo_ids)))
        session.exec(delete(VisitorPhoto).where(VisitorPhoto.campground_id == camp_id))
        session.exec(delete(Comment).where(Comment.campground_id == camp_id))
        session.exec(delete(Vote).where(Vote.campground_id == camp_id))
        session.exec(delete(Wishlist).where(Wishlist.campground_id == camp_id))
        session.exec(delete(CheckIn).where(CheckIn.campground_id == camp_id))

        session.delete(campground)
        session.commit()
        return camp_id

campground_repo = CampgroundRepository()

