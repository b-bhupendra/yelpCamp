import logging
from typing import Optional, List
from fastapi import APIRouter, Request, Depends, HTTPException, Form, UploadFile, File, BackgroundTasks
from sqlmodel import Session
from app.api.deps import get_db, get_current_user, is_logged_in
from app.models.user import User
from app.schemas.visitor_photo import (
    VisitorPhotoOut, VisitorStoryGroupOut, VisitorPhotoLikeResponse
)
from app.schemas.comment import CommentOut, CommentCreate
from app.services.story_service import story_service
from app.services.comment_service import comment_service
from app.services.limiter import limiter
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["visitor_photos"])

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
    db: Session = Depends(get_db),
    current_user: User = Depends(is_logged_in)
):
    """Upload a visitor photo/story for a campsite."""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            if "image_url" in body:
                image_url = body.get("image_url")
            if "caption" in body:
                caption = body.get("caption")
            if "media_type" in body:
                media_type = body.get("media_type", "photo")
            if "expires_hours" in body:
                expires_hours = body.get("expires_hours")
        except Exception:
            pass

    return await story_service.create_photo(
        session=db,
        campground_id=id,
        current_user=current_user,
        background_tasks=background_tasks,
        file=file,
        image_url=image_url,
        caption=caption,
        media_type=media_type,
        expires_hours=expires_hours
    )

@router.get("/campgrounds/{id}/stories", response_model=List[VisitorPhotoOut])
def get_campground_photos(
    id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Retrieve active visitor stories for a given campground."""
    user_id = current_user.id if current_user else None
    return story_service.get_campground_photos(db, id, user_id)

@router.get("/stories", response_model=List[VisitorStoryGroupOut])
def get_active_stories(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Horizontal story tray grouped by user."""
    user_id = current_user.id if current_user else None
    return story_service.get_active_story_tray(db, user_id)

@router.get("/me/moments", response_model=List[VisitorPhotoOut])
def get_my_moments(
    db: Session = Depends(get_db),
    current_user: User = Depends(is_logged_in)
):
    """Retrieve photos and moments shared by the authenticated user."""
    return story_service.get_user_moments(db, current_user.id)

@router.get("/stories/{photo_id}", response_model=VisitorPhotoOut)
def get_photo_detail(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Retrieve details and comment hierarchy of a single photo."""
    user_id = current_user.id if current_user else None
    return story_service.get_photo_detail(db, photo_id, user_id)

@router.delete("/stories/{photo_id}")
def delete_visitor_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_logged_in)
):
    """Delete a visitor photo (author-only)."""
    return story_service.delete_photo(db, photo_id, current_user)

@router.post("/stories/{photo_id}/like", response_model=VisitorPhotoLikeResponse)
@limiter.limit(settings.RATE_LIMIT_SOCIAL_ACTION)
def toggle_photo_like(
    photo_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_logged_in)
):
    """Toggle like on a visitor story."""
    return story_service.toggle_like(db, photo_id, current_user.id)

@router.get("/stories/{photo_id}/comments")
def get_photo_comments(
    photo_id: int,
    db: Session = Depends(get_db)
):
    """Retrieve comment tree for a visitor photo."""
    return comment_service.get_photo_comments(db, photo_id)

@router.post("/stories/{photo_id}/comments", response_model=CommentOut)
@limiter.limit("20/minute")
def create_photo_comment(
    photo_id: int,
    request: Request,
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_logged_in)
):
    """Post a comment or threaded reply on a visitor story."""
    return comment_service.create_photo_comment(db, photo_id, current_user, comment_data)

