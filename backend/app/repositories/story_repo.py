import json
import time
from typing import Optional, List
from sqlmodel import Session, select, func, delete
from sqlalchemy import text
from app.models.visitor_photo import VisitorPhoto, VisitorPhotoLike
from app.models.campground import Campground
from app.models.user import User
from app.models.comment import Comment
from app.schemas.visitor_photo import VisitorPhotoOut, VisitorStoryGroupOut, VisitorPhotoLikeResponse
from app.services.image_validator import sanitize_campground_image
from app.services.cloudinary_service import get_user_avatar_url

class StoryRepository:
    """Repository handling all Visitor Stories and Moments SQL queries."""

    def get_active_story_tray(
        self,
        session: Session,
        current_user_id: Optional[int] = None,
        limit: int = 40
    ) -> List[VisitorStoryGroupOut]:
        """
        Retrieves active stories grouped by user directly inside SQLite / Turso C layer
        using json_group_array and json_object.
        Zero Python in-memory looping or partitioning.
        """
        uid = current_user_id or 0
        now = int(time.time())
        sql = text("""
            WITH enriched_photos AS (
                SELECT
                    vp.id,
                    vp.campground_id,
                    c.title AS campground_title,
                    vp.user_id,
                    u.username,
                    COALESCE(NULLIF(u.avatar_url, ''), 'https://api.dicebear.com/7.x/adventurer/svg?seed=' || LOWER(u.username)) AS avatar_url,
                    vp.media_type,
                    vp.image_url,
                    vp.caption,
                    vp.ai_tags,
                    vp.created_at,
                    vp.expires_at,
                    COUNT(DISTINCT vpl.user_id) AS likes_count,
                    COUNT(DISTINCT cm.id) AS comments_count,
                    MAX(CASE WHEN vpl.user_id = :uid THEN 1 ELSE 0 END) AS liked_by_me
                FROM visitor_photos vp
                JOIN user u ON u.id = vp.user_id
                JOIN campground c ON c.id = vp.campground_id
                LEFT JOIN visitor_photo_likes vpl ON vpl.photo_id = vp.id
                LEFT JOIN comment cm ON cm.photo_id = vp.id
                WHERE vp.expires_at IS NULL OR vp.expires_at > :now
                GROUP BY vp.id
                ORDER BY vp.created_at DESC
                LIMIT :limit
            )
            SELECT
                user_id,
                username,
                avatar_url,
                MAX(created_at) AS latest_timestamp,
                json_group_array(
                    json_object(
                        'id', id,
                        'campground_id', campground_id,
                        'campground_title', campground_title,
                        'user_id', user_id,
                        'username', username,
                        'user_username', username,
                        'avatar_url', avatar_url,
                        'user_avatar', avatar_url,
                        'media_type', media_type,
                        'image_url', image_url,
                        'caption', caption,
                        'ai_tags', COALESCE(ai_tags, '[]'),
                        'likes_count', likes_count,
                        'comments_count', comments_count,
                        'liked_by_me', CASE WHEN liked_by_me = 1 THEN json('true') ELSE json('false') END,
                        'created_at', created_at,
                        'expires_at', expires_at
                    )
                ) AS photos
            FROM enriched_photos
            GROUP BY user_id
            ORDER BY latest_timestamp DESC;
        """)

        results = session.exec(sql, params={"uid": uid, "limit": limit, "now": now}).all()

        groups: List[VisitorStoryGroupOut] = []
        for r in results:
            user_id = r[0]
            username = r[1]
            avatar_url = r[2]
            latest_timestamp = r[3]
            raw_photos_json = r[4]

            try:
                parsed_photos = json.loads(raw_photos_json) if isinstance(raw_photos_json, str) else (raw_photos_json or [])
            except Exception:
                parsed_photos = []

            photos_out = []
            for p in parsed_photos:
                p["image_url"] = sanitize_campground_image(p.get("image_url", ""), p.get("id"))
                photos_out.append(VisitorPhotoOut(**p))

            groups.append(
                VisitorStoryGroupOut(
                    user_id=user_id,
                    user_username=username,
                    username=username,
                    user_avatar=avatar_url,
                    avatar_url=avatar_url,
                    has_unseen=True,
                    latest_timestamp=latest_timestamp or "",
                    photos=photos_out
                )
            )

        return groups

    def get_campground_photos(
        self,
        session: Session,
        campground_id: int,
        current_user_id: Optional[int] = None,
        limit: int = 50
    ) -> List[VisitorPhotoOut]:
        uid = current_user_id or 0
        now = int(time.time())
        sql = text("""
            SELECT
                vp.id,
                vp.campground_id,
                c.title AS campground_title,
                vp.user_id,
                u.username,
                COALESCE(NULLIF(u.avatar_url, ''), 'https://api.dicebear.com/7.x/adventurer/svg?seed=' || LOWER(u.username)) AS avatar_url,
                vp.media_type,
                vp.image_url,
                vp.caption,
                vp.ai_tags,
                vp.created_at,
                vp.expires_at,
                COUNT(DISTINCT vpl.user_id) AS likes_count,
                COUNT(DISTINCT cm.id) AS comments_count,
                MAX(CASE WHEN vpl.user_id = :uid THEN 1 ELSE 0 END) AS liked_by_me
            FROM visitor_photos vp
            JOIN user u ON u.id = vp.user_id
            JOIN campground c ON c.id = vp.campground_id
            LEFT JOIN visitor_photo_likes vpl ON vpl.photo_id = vp.id
            LEFT JOIN comment cm ON cm.photo_id = vp.id
            WHERE vp.campground_id = :campground_id
              AND (vp.expires_at IS NULL OR vp.expires_at > :now)
            GROUP BY vp.id
            ORDER BY vp.created_at DESC
            LIMIT :limit;
        """)

        rows = session.exec(sql, params={"uid": uid, "campground_id": campground_id, "limit": limit, "now": now}).all()
        return [
            VisitorPhotoOut(
                id=r[0],
                campground_id=r[1],
                campground_title=r[2],
                user_id=r[3],
                user_username=r[4],
                username=r[4],
                user_avatar=r[5],
                avatar_url=r[5],
                media_type=r[6],
                image_url=sanitize_campground_image(r[7], r[0]),
                caption=r[8] or "",
                ai_tags=json.loads(r[9]) if isinstance(r[9], str) else (r[9] or []),
                created_at=r[10],
                expires_at=r[11],
                likes_count=int(r[12] or 0),
                comments_count=int(r[13] or 0),
                liked_by_me=bool(r[14]),
                comments=[]
            )
            for r in rows
        ]

    def get_user_moments(
        self,
        session: Session,
        user_id: int
    ) -> List[VisitorPhotoOut]:
        sql = text("""
            SELECT
                vp.id,
                vp.campground_id,
                c.title AS campground_title,
                vp.user_id,
                u.username,
                COALESCE(NULLIF(u.avatar_url, ''), 'https://api.dicebear.com/7.x/adventurer/svg?seed=' || LOWER(u.username)) AS avatar_url,
                vp.media_type,
                vp.image_url,
                vp.caption,
                vp.ai_tags,
                vp.created_at,
                vp.expires_at,
                COUNT(DISTINCT vpl.user_id) AS likes_count,
                COUNT(DISTINCT cm.id) AS comments_count,
                MAX(CASE WHEN vpl.user_id = :uid THEN 1 ELSE 0 END) AS liked_by_me
            FROM visitor_photos vp
            JOIN user u ON u.id = vp.user_id
            JOIN campground c ON c.id = vp.campground_id
            LEFT JOIN visitor_photo_likes vpl ON vpl.photo_id = vp.id
            LEFT JOIN comment cm ON cm.photo_id = vp.id
            WHERE vp.user_id = :uid
            GROUP BY vp.id
            ORDER BY vp.created_at DESC;
        """)

        rows = session.exec(sql, params={"uid": user_id}).all()
        return [
            VisitorPhotoOut(
                id=r[0],
                campground_id=r[1],
                campground_title=r[2],
                user_id=r[3],
                user_username=r[4],
                username=r[4],
                user_avatar=r[5],
                avatar_url=r[5],
                media_type=r[6],
                image_url=sanitize_campground_image(r[7], r[0]),
                caption=r[8] or "",
                ai_tags=json.loads(r[9]) if isinstance(r[9], str) else (r[9] or []),
                created_at=r[10],
                expires_at=r[11],
                likes_count=int(r[12] or 0),
                comments_count=int(r[13] or 0),
                liked_by_me=bool(r[14]),
                comments=[]
            )
            for r in rows
        ]

    def get_by_id(
        self,
        session: Session,
        photo_id: int,
        current_user_id: Optional[int] = None
    ) -> Optional[VisitorPhotoOut]:
        photo = session.get(VisitorPhoto, photo_id)
        if not photo:
            return None

        campground = session.get(Campground, photo.campground_id) if photo.campground_id else None
        user = session.get(User, photo.user_id) if photo.user_id else None
        username = user.username if user else ""
        avatar = get_user_avatar_url(username, user.avatar_url if user else None)

        liked_by_me = False
        if current_user_id:
            liked_by_me = bool(
                session.exec(
                    select(VisitorPhotoLike).where(
                        VisitorPhotoLike.photo_id == photo_id,
                        VisitorPhotoLike.user_id == current_user_id
                    )
                ).first()
            )

        likes_cnt = session.exec(
            select(func.count(VisitorPhotoLike.user_id)).where(VisitorPhotoLike.photo_id == photo_id)
        ).one() or 0

        from app.repositories.comment_repo import comment_repo
        comments_tree = comment_repo.get_photo_comment_tree(session, photo_id)

        return VisitorPhotoOut(
            id=photo.id,
            campground_id=photo.campground_id,
            campground_title=campground.title if campground else "",
            user_id=photo.user_id,
            user_username=username,
            username=username,
            user_avatar=avatar,
            avatar_url=avatar,
            media_type=photo.media_type,
            image_url=sanitize_campground_image(photo.image_url, photo.id),
            caption=photo.caption or "",
            ai_tags=photo.ai_tags or [],
            ai_media_caption=photo.ai_media_caption or "",
            likes_count=likes_cnt,
            comments_count=len(comments_tree),
            created_at=photo.created_at,
            expires_at=photo.expires_at,
            liked_by_me=liked_by_me,
            comments=comments_tree
        )

    def create(
        self,
        session: Session,
        campground_id: int,
        user_id: int,
        image_url: str,
        caption: str = "",
        media_type: str = "photo",
        expires_hours: Optional[int] = None
    ) -> VisitorPhoto:
        expires_at = None
        if expires_hours and expires_hours > 0:
            expires_at = int(time.time()) + (expires_hours * 3600)

        new_photo = VisitorPhoto(
            campground_id=campground_id,
            user_id=user_id,
            media_type=media_type,
            image_url=image_url,
            caption=caption or "",
            expires_at=expires_at
        )
        session.add(new_photo)
        session.commit()
        session.refresh(new_photo)
        return new_photo

    def delete(self, session: Session, photo: VisitorPhoto) -> int:
        photo_id = photo.id
        session.exec(delete(VisitorPhotoLike).where(VisitorPhotoLike.photo_id == photo_id))
        session.exec(delete(Comment).where(Comment.photo_id == photo_id))
        session.delete(photo)
        session.commit()
        return photo_id

    def toggle_like(
        self,
        session: Session,
        photo_id: int,
        user_id: int
    ) -> VisitorPhotoLikeResponse:
        existing = session.exec(
            select(VisitorPhotoLike).where(
                VisitorPhotoLike.photo_id == photo_id,
                VisitorPhotoLike.user_id == user_id
            )
        ).first()

        if existing:
            session.delete(existing)
            session.commit()
            liked = False
        else:
            new_like = VisitorPhotoLike(user_id=user_id, photo_id=photo_id)
            session.add(new_like)
            session.commit()
            liked = True

        total_likes = session.exec(
            select(func.count(VisitorPhotoLike.user_id)).where(VisitorPhotoLike.photo_id == photo_id)
        ).one() or 0

        return VisitorPhotoLikeResponse(
            photo_id=photo_id,
            liked=liked,
            likes_count=total_likes
        )

story_repo = StoryRepository()

