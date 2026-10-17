import os
import time
import json
import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends, HTTPException, Form, UploadFile, File, Query, BackgroundTasks
from sqlmodel import Session, select, func

from database import get_session
from models import VisitorPhoto, VisitorPhotoLike, Campground, User, Comment
from dependencies import get_current_user, is_logged_in
from schemas import (
    VisitorPhotoOut, VisitorPhotoCreate, VisitorPhotoLikeResponse,
    VisitorStoryGroupOut, CommentOut
)
from services.cloudinary_service import upload_visitor_photo, get_user_avatar_url
from services.multimodal_embedder import process_story_ingestion
from services.limiter import limiter
from services.image_validator import sanitize_campground_image
from routers.comments import build_comment_tree
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["visitor_photos"])

def format_photo_out(
    photo: VisitorPhoto,
    current_user_id: Optional[int] = None,
    db: Optional[Session] = None,
    liked_ids: Optional[set] = None,
    comment_counts: Optional[Dict[int, int]] = None
) -> Dict[str, Any]:
    """Helper to convert a VisitorPhoto model to a clean dictionary matching VisitorPhotoOut."""
    tags = []
    if photo.ai_tags:
        try:
            tags = json.loads(photo.ai_tags) if isinstance(photo.ai_tags, str) else list(photo.ai_tags)
        except Exception:
            tags = []

    liked_by_me = False
    if liked_ids is not None:
        liked_by_me = photo.id in liked_ids
    elif current_user_id and db and photo.id:
        like_record = db.exec(
            select(VisitorPhotoLike).where(
                VisitorPhotoLike.photo_id == photo.id,
                VisitorPhotoLike.user_id == current_user_id
            )
        ).first()
        liked_by_me = bool(like_record)

    comments_count = 0
    if comment_counts is not None and photo.id in comment_counts:
        comments_count = comment_counts[photo.id]
    elif hasattr(photo, "comments") and photo.comments:
        comments_count = len(photo.comments)
    elif db and photo.id:
        comments_count = len(db.exec(select(Comment.id).where(Comment.photo_id == photo.id)).all())

    return {
        "id": photo.id,
        "campground_id": photo.campground_id,
        "user_id": photo.user_id,
        "user_username": photo.user_username,
        "user_avatar": get_user_avatar_url(photo.user_username, photo.user_avatar),
        "media_type": photo.media_type or "photo",
        "image_url": sanitize_campground_image(photo.image_url, photo.id),
        "caption": photo.caption or "",
        "ai_tags": tags,
        "ai_media_caption": photo.ai_media_caption or "",
        "likes_count": photo.likes_count or 0,
        "comments_count": comments_count,
        "created_at": photo.created_at,
        "expires_at": photo.expires_at,
        "liked_by_me": liked_by_me,
        "comments": []
    }


# ==========================================
# 1. Campground Visitor Photos & Stories
# ==========================================

@router.post("/campgrounds/{id}/stories")
@router.post("/campgrounds/{id}/photos")
@limiter.limit(settings.RATE_LIMIT_CONTENT_CREATE)
async def create_visitor_photo(
    id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    caption: Optional[str] = Form(""),
    media_type: str = Form("photo"),
    is_story: bool = Form(False),
    expires_hours: Optional[int] = Form(None),
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """
    Upload a visitor photo/story for a campground.
    By user design, photos remain active permanently until explicitly deleted by the user,
    unless an explicit expiration TTL is set via expires_hours.
    """
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    final_image_url = None

    # Check JSON body fallback
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            if "image_url" in body:
                final_image_url = body.get("image_url")
            if "caption" in body:
                caption = body.get("caption")
            if "media_type" in body:
                media_type = body.get("media_type", "photo")
            if "expires_hours" in body:
                expires_hours = body.get("expires_hours")
        except Exception:
            pass

    # 1. Handle file upload
    if file and file.filename:
        try:
            # Upload to Cloudinary
            final_image_url = upload_visitor_photo(file.file)
        except Exception as e:
            logger.warning(f"Cloudinary upload failed for visitor photo, saving locally: {e}")
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            ext = os.path.splitext(file.filename)[1] or ".jpg"
            filename = f"story_{uuid.uuid4().hex}{ext}"
            file_path = os.path.join(settings.UPLOAD_DIR, filename)
            file.file.seek(0)
            with open(file_path, "wb") as buffer:
                buffer.write(file.file.read())
            final_image_url = f"/uploads/{filename}"
    elif image_url:
        final_image_url = image_url

    if not final_image_url:
        raise HTTPException(status_code=400, detail="Image file or image_url is required")

    final_image_url = sanitize_campground_image(final_image_url, id)

    # Expiry calculation: permanent unless explicit positive hours are passed
    expires_at = None
    if expires_hours and expires_hours > 0:
        expires_at = int(time.time()) + (expires_hours * 3600)

    user_avatar = get_user_avatar_url(current_user.username, current_user.avatar_url)

    new_photo = VisitorPhoto(
        campground_id=id,
        user_id=current_user.id,
        user_username=current_user.username,
        user_avatar=user_avatar,
        media_type=media_type,
        image_url=final_image_url,
        caption=caption or "",
        likes_count=0,
        expires_at=expires_at
    )
    db.add(new_photo)
    db.commit()
    db.refresh(new_photo)

    # Queue async background vision tagging & vector ingestion
    background_tasks.add_task(process_story_ingestion, new_photo.id)

    return format_photo_out(new_photo, current_user.id, db)


@router.get("/campgrounds/{id}/stories")
@router.get("/campgrounds/{id}/photos")
async def get_campground_photos(
    id: int,
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Retrieve all active photos/moments for a given campground."""
    now = int(time.time())
    query = select(VisitorPhoto).where(
        VisitorPhoto.campground_id == id,
        (VisitorPhoto.expires_at == None) | (VisitorPhoto.expires_at > now)
    ).order_by(VisitorPhoto.created_at.desc())

    photos = db.exec(query).all()
    user_id = current_user.id if current_user else None

    # Pre-fetch likes and comments for this batch
    photo_ids = [p.id for p in photos if p.id]
    liked_ids = set()
    if user_id and photo_ids:
        liked_ids = set(db.exec(
            select(VisitorPhotoLike.photo_id).where(
                VisitorPhotoLike.user_id == user_id,
                VisitorPhotoLike.photo_id.in_(photo_ids)
            )
        ).all())

    return [format_photo_out(p, user_id, db, liked_ids=liked_ids) for p in photos]


# ==========================================
# 2. Global Story Tray (Instagram-style)
# ==========================================

@router.get("/stories")
@router.get("/social/stories")
async def get_active_stories(
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Returns stories grouped by user for the horizontal story bubble tray.
    Stories stay visible until deleted by the user or expired.
    """
    now = int(time.time())
    statement = select(VisitorPhoto).where(
        (VisitorPhoto.expires_at == None) | (VisitorPhoto.expires_at > now)
    ).order_by(VisitorPhoto.created_at.desc())

    photos = db.exec(statement).all()
    user_id = current_user.id if current_user else None

    # Pre-fetch likes for this batch
    photo_ids = [p.id for p in photos if p.id]
    liked_ids = set()
    if user_id and photo_ids:
        liked_ids = set(db.exec(
            select(VisitorPhotoLike.photo_id).where(
                VisitorPhotoLike.user_id == user_id,
                VisitorPhotoLike.photo_id.in_(photo_ids)
            )
        ).all())

    # Group photos by user
    grouped_users: Dict[int, Dict[str, Any]] = {}
    for p in photos:
        uid = p.user_id
        if uid not in grouped_users:
            grouped_users[uid] = {
                "user_id": uid,
                "user_username": p.user_username,
                "user_avatar": get_user_avatar_url(p.user_username, p.user_avatar),
                "has_unseen": True,
                "latest_timestamp": p.created_at,
                "photos": []
            }
        grouped_users[uid]["photos"].append(format_photo_out(p, user_id, db, liked_ids=liked_ids))

    return list(grouped_users.values())


# ==========================================
# 3. Story Details, Likes & Deletion
# ==========================================

@router.get("/stories/{photo_id}")
@router.get("/photos/{photo_id}")
async def get_photo_detail(
    photo_id: int,
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Retrieve a single photo/story with its full comment hierarchy."""
    photo = db.get(VisitorPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Visitor photo not found")

    user_id = current_user.id if current_user else None
    photo_dict = format_photo_out(photo, user_id, db)
    photo_dict["comments"] = build_comment_tree(photo.comments)
    return photo_dict


@router.delete("/stories/{photo_id}")
@router.delete("/photos/{photo_id}")
async def delete_visitor_photo(
    photo_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Delete a visitor photo/story. Only the author can delete their moment."""
    photo = db.get(VisitorPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Visitor photo not found")

    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this photo")

    # Cascade delete likes
    likes = db.exec(select(VisitorPhotoLike).where(VisitorPhotoLike.photo_id == photo_id)).all()
    for l in likes:
        db.delete(l)

    # Cascade delete comments
    comments = db.exec(select(Comment).where(Comment.photo_id == photo_id)).all()
    for c in comments:
        db.delete(c)

    db.delete(photo)
    db.commit()

    return {"message": "Visitor moment deleted successfully", "photo_id": photo_id}


@router.post("/stories/{photo_id}/like")
@router.post("/photos/{photo_id}/like")
@limiter.limit(settings.RATE_LIMIT_SOCIAL_ACTION)
async def toggle_photo_like(
    photo_id: int,
    request: Request,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Toggle like on a visitor photo/story with atomic count update."""
    photo = db.get(VisitorPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Visitor photo not found")

    existing_like = db.exec(
        select(VisitorPhotoLike).where(
            VisitorPhotoLike.user_id == current_user.id,
            VisitorPhotoLike.photo_id == photo_id
        )
    ).first()

    if existing_like:
        db.delete(existing_like)
        photo.likes_count = max(0, (photo.likes_count or 0) - 1)
        liked = False
    else:
        new_like = VisitorPhotoLike(user_id=current_user.id, photo_id=photo_id)
        db.add(new_like)
        photo.likes_count = (photo.likes_count or 0) + 1
        liked = True

    db.add(photo)
    db.commit()
    db.refresh(photo)

    return {
        "photo_id": photo_id,
        "liked": liked,
        "likes_count": photo.likes_count
    }


# ==========================================
# 4. Comments & Threaded Replies on Photos
# ==========================================

@router.get("/stories/{photo_id}/comments")
@router.get("/photos/{photo_id}/comments")
async def get_photo_comments(
    photo_id: int,
    nested: bool = Query(True, description="Return threaded reply tree"),
    db: Session = Depends(get_session)
):
    """Retrieve comments for a visitor photo (nested tree by default)."""
    photo = db.get(VisitorPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Visitor photo not found")

    comments = db.exec(
        select(Comment).where(Comment.photo_id == photo_id).order_by(Comment.created_at.asc())
    ).all()

    if nested:
        return build_comment_tree(list(comments))

    return [
        {
            "id": c.id,
            "text": c.text,
            "parent_comment_id": c.parent_comment_id,
            "photo_id": c.photo_id,
            "author_id": c.author_id,
            "author_username": c.author_username,
            "author_avatar": get_user_avatar_url(
                c.author_username,
                c.author_avatar or (c.author.avatar_url if c.author else None)
            ),
            "created_at": c.created_at
        }
        for c in comments
    ]


@router.post("/stories/{photo_id}/comments")
@router.post("/photos/{photo_id}/comments")
@limiter.limit("20/minute")
async def create_photo_comment(
    photo_id: int,
    request: Request,
    comment_data: dict,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Post a comment or threaded reply on a visitor photo."""
    photo = db.get(VisitorPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Visitor photo not found")

    text = comment_data.get("text")
    parent_comment_id = comment_data.get("parent_comment_id")

    if not text or not str(text).strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    if parent_comment_id is not None:
        parent = db.get(Comment, parent_comment_id)
        if not parent or parent.photo_id != photo_id:
            raise HTTPException(status_code=400, detail="Parent reply does not exist for this photo")

    author_avatar = get_user_avatar_url(current_user.username, current_user.avatar_url)

    new_comment = Comment(
        text=str(text).strip(),
        parent_comment_id=parent_comment_id,
        photo_id=photo_id,
        author_id=current_user.id,
        author_username=current_user.username,
        author_avatar=author_avatar
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    return {
        "id": new_comment.id,
        "text": new_comment.text,
        "parent_comment_id": new_comment.parent_comment_id,
        "photo_id": new_comment.photo_id,
        "author_id": new_comment.author_id,
        "author_username": new_comment.author_username,
        "author_avatar": new_comment.author_avatar,
        "created_at": new_comment.created_at
    }
