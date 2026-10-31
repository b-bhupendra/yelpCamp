import os
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks, Request
from sqlmodel import Session

from models import Campground, User, Comment
from database import get_session
from dependencies import is_logged_in, check_campground_author, get_current_user
from schemas import (
    CampgroundCreate, CampgroundUpdate, CampgroundOut, CampgroundCard,
    PaginatedCampgrounds, FileUploadResponse
)
from config import settings
from services.cloudinary_service import upload_campground_image
from services.limiter import limiter
from repositories.campground_repo import campground_repo
from repositories.comment_repo import comment_repo

logger = logging.getLogger(__name__)

router = APIRouter(tags=["campgrounds"])

# Ensure uploads directory exists (guarded for serverless)
try:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
except Exception:
    pass

def build_campground_out(
    campground: Campground,
    likes_count: int = 0,
    dislikes_count: int = 0,
    visitor_photos_count: int = 0,
    comments_raw: Optional[List[Comment]] = None,
    user_vote: int = 0,
    is_wishlisted: bool = False
) -> Dict[str, Any]:
    """Helper preserving legacy signature if called by external tests/modules."""
    data = campground.model_dump()
    data.update({
        "title": campground.title,
        "name": campground.title,
        "price": float(campground.price) if campground.price is not None else 0.0,
        "likes_count": likes_count,
        "dislikes_count": dislikes_count,
        "visitor_photos_count": visitor_photos_count,
        "user_vote": user_vote,
        "is_wishlisted": is_wishlisted,
        "comments": comments_raw or [],
        "comments_tree": comments_raw or [],
    })
    return data

@router.get("", response_model=PaginatedCampgrounds)
def list_campgrounds(
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    tag: Optional[str] = None,
    sort: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_session)
):
    """
    List campgrounds with pure database-heavy computation offloaded to SQLite/Turso.
    Executed in worker threadpool via def to prevent event loop starvation.
    """
    return campground_repo.get_paginated(
        session=db,
        page=page,
        limit=limit,
        search=search,
        min_price=min_price,
        max_price=max_price,
        tag=tag,
        sort=sort
    )

@router.post("/upload", response_model=FileUploadResponse)
@limiter.limit("15/minute")
def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(is_logged_in)
):
    """Upload a campsite image to Cloudinary CDN via threadpool worker."""
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Invalid file format. Allowed: JPG, PNG, WEBP, GIF.")

    cdn_url = upload_campground_image(file.file)
    return FileUploadResponse(
        url=cdn_url,
        filename=file.filename or "image.jpg"
    )

@router.post("", response_model=CampgroundOut, status_code=201)
@limiter.limit(settings.RATE_LIMIT_CONTENT_CREATE)
def create_campground(
    request: Request,
    data: CampgroundCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Create a new campground with typed SQLModel schema via repository."""
    from services.multimodal_embedder import process_campground_ingestion

    new_campground = campground_repo.create(db, data, current_user.id)
    background_tasks.add_task(process_campground_ingestion, new_campground.id)

    res = campground_repo.get_by_id(db, new_campground.id, current_user.id)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to retrieve created campground")
    return res

@router.get("/{id}", response_model=CampgroundOut)
def get_campground(
    id: int,
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Retrieve full campsite details with metrics, user vote, and wishlist status
    evaluated in a single SQL roundtrip via repository.
    """
    user_id = current_user.id if current_user else None
    campground_out = campground_repo.get_by_id(db, id, user_id)
    if not campground_out:
        raise HTTPException(status_code=404, detail="Campground not found")
    return campground_out

@router.put("/{id}", response_model=CampgroundOut)
def update_campground(
    id: int,
    data: CampgroundUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    campground: Campground = Depends(check_campground_author)
):
    """Update campsite details with pure REST PUT via repository."""
    from services.multimodal_embedder import process_campground_ingestion

    updated_campground = campground_repo.update(db, campground, data)
    background_tasks.add_task(process_campground_ingestion, updated_campground.id)

    res = campground_repo.get_by_id(db, updated_campground.id, campground.author_id)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to retrieve updated campground")
    return res

@router.delete("/{id}")
def delete_campground(
    id: int,
    db: Session = Depends(get_session),
    campground: Campground = Depends(check_campground_author)
):
    """
    Cascade delete campsite and all related entities directly in the database engine
    in a single atomic statement using native PRAGMA foreign_keys = ON.
    """
    campground_repo.delete(db, campground)
    return {"message": "Campground deleted successfully", "id": id}
