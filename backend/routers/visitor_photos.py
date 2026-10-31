import os
import time
import uuid
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Request, Depends, HTTPException, Form, UploadFile, File, Query, BackgroundTasks
from sqlmodel import Session

from database import get_session
from models import VisitorPhoto, Campground, User, Comment
from dependencies import get_current_user, is_logged_in
from schemas import (
    VisitorPhotoOut, VisitorPhotoCreate, VisitorPhotoLikeResponse,
    VisitorStoryGroupOut, CommentOut, CommentCreate
)
from services.cloudinary_service import upload_visitor_photo, get_user_avatar_url
from services.multimodal_embedder import process_story_ingestion
from services.limiter import limiter
from services.image_validator import sanitize_campground_image
from repositories.story_repo import story_repo
from repositories.comment_repo import comment_repo
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["visitor_photos"])

def build_photo_out(
    photo: VisitorPhoto,
    comments_count: int = 0,
    liked_by_me: bool = False,
    comments: Optional[List[CommentOut]] = None,
    campground_title: Optional[str] = None
) -> Dict[str, Any]:
    """Helper preserving legacy signature if called by external modules."""
    avatar = get_user_avatar_url(getattr(photo, "user_username", "") or "", getattr(photo, "user_avatar", None))
    safe_image = sanitize_campground_image(photo.image_url, photo.id)

    data = photo.model_dump()
    data.update({
        "image_url": safe_image,
        "user_avatar": avatar,
        "avatar_url": avatar,
        "comments_count": comments_count,
        "liked_by_me": liked_by_me,
        "comments": comments or [],
        "campground_title": campground_title or ""
    })
    return data

# ==========================================
# 1. Campground Visitor Stories
# ==========================================

@router.post("/campgrounds/{id}/stories", response_model=VisitorPhotoOut)
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
    Photos remain active permanently until explicitly deleted by the user,
    unless an explicit expiration TTL is set via expires_hours.
    """
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    final_image_url = None

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

    if file and file.filename:
        try:
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

    new_photo = story_repo.create(
        session=db,
        campground_id=id,
        user_id=current_user.id,
        image_url=final_image_url,
        caption=caption or "",
        media_type=media_type,
        expires_hours=expires_hours
    )

    background_tasks.add_task(process_story_ingestion, new_photo.id)

    res = story_repo.get_by_id(db, new_photo.id, current_user.id)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to retrieve created photo")
    return res

@router.get("/campgrounds/{id}/stories", response_model=List[VisitorPhotoOut])
def get_campground_photos(
    id: int,
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Retrieve all active photos/moments for a given campground.
    Evaluates comments_count, liked_by_me, and campground_title in a single SQL query via repository.
    """
    user_id = current_user.id if current_user else None
    return story_repo.get_campground_photos(db, id, user_id)

# ==========================================
# 2. Global Story Tray & User Moments
# ==========================================

@router.get("/stories", response_model=List[VisitorStoryGroupOut])
def get_active_stories(
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Returns stories grouped by user for the horizontal story bubble tray.
    Grouped directly in SQLite engine via json_group_array(json_object(...)).
    """
    user_id = current_user.id if current_user else None
    return story_repo.get_active_story_tray(db, user_id)

@router.get("/me/moments", response_model=List[VisitorPhotoOut])
def get_my_moments(
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """
    Retrieve all visitor photos/moments created by the authenticated user,
    with comments_count, liked_by_me, and campground_title computed in SQL.
    """
    return story_repo.get_user_moments(db, current_user.id)

# ==========================================
# 3. Story Details, Likes & Deletion
# ==========================================

@router.get("/stories/{photo_id}", response_model=VisitorPhotoOut)
def get_photo_detail(
    photo_id: int,
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Retrieve a single photo/story with its full comment hierarchy via repository."""
    user_id = current_user.id if current_user else None
    photo_out = story_repo.get_by_id(db, photo_id, user_id)
    if not photo_out:
        raise HTTPException(status_code=404, detail="Visitor photo not found")
    return photo_out

@router.delete("/stories/{photo_id}")
def delete_visitor_photo(
    photo_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Delete a visitor photo/story with atomic cascade delete in database engine."""
    photo = db.get(VisitorPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Visitor photo not found")

    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this photo")

    story_repo.delete(db, photo)
    return {"message": "Visitor moment deleted successfully", "photo_id": photo_id}

@router.post("/stories/{photo_id}/like", response_model=VisitorPhotoLikeResponse)
@limiter.limit(settings.RATE_LIMIT_SOCIAL_ACTION)
def toggle_photo_like(
    photo_id: int,
    request: Request,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Toggle like on a visitor photo/story with atomic count update."""
    photo = db.get(VisitorPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Visitor photo not found")

    return story_repo.toggle_like(db, photo_id, current_user.id)

# ==========================================
# 4. Comments & Threaded Replies on Photos
# ==========================================

@router.get("/stories/{photo_id}/comments")
def get_photo_comments(
    photo_id: int,
    nested: bool = Query(True, description="Return threaded reply tree"),
    db: Session = Depends(get_session)
):
    """Retrieve comments for a visitor photo (nested tree by default)."""
    photo = db.get(VisitorPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Visitor photo not found")

    return comment_repo.get_photo_comment_tree(db, photo_id)

@router.post("/stories/{photo_id}/comments", response_model=CommentOut)
@limiter.limit("20/minute")
def create_photo_comment(
    photo_id: int,
    request: Request,
    comment_data: CommentCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Post a comment or threaded reply on a visitor photo."""
    photo = db.get(VisitorPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Visitor photo not found")

    text = (comment_data.text or "").strip()
    parent_comment_id = comment_data.parent_comment_id

    if not text:
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    if parent_comment_id is not None:
        parent = db.get(Comment, parent_comment_id)
        if not parent or parent.photo_id != photo_id:
            raise HTTPException(status_code=400, detail="Parent reply does not exist for this photo")

    new_comment = comment_repo.create(
        session=db,
        author_id=current_user.id,
        text=text,
        photo_id=photo_id,
        parent_comment_id=parent_comment_id
    )

    avatar = get_user_avatar_url(current_user.username, current_user.avatar_url)
    return CommentOut(
        id=new_comment.id,
        text=new_comment.text,
        parent_comment_id=new_comment.parent_comment_id,
        photo_id=new_comment.photo_id,
        author_id=new_comment.author_id,
        author_username=current_user.username,
        author_avatar=avatar,
        created_at=new_comment.created_at,
        replies=[]
    )
