from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Query, BackgroundTasks, Request
from sqlmodel import Session
from app.api.deps import get_db, get_current_user, is_logged_in, check_campground_author
from app.models.user import User
from app.models.campground import Campground
from app.schemas.campground import (
    CampgroundCreate, CampgroundUpdate, CampgroundOut, PaginatedCampgrounds
)
from app.schemas.common import FileUploadResponse
from app.services.campground_service import campground_service
from app.services.limiter import limiter
from app.core.config import settings

router = APIRouter(tags=["campgrounds"])

@router.get("", response_model=PaginatedCampgrounds)
def list_campgrounds(
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    tag: Optional[str] = None,
    sort: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List campgrounds with filtering, sorting, and pagination."""
    return campground_service.list_campgrounds(
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
    """Upload a campsite image to Cloudinary CDN."""
    return campground_service.upload_image(file)

@router.post("", response_model=CampgroundOut, status_code=201)
@limiter.limit(settings.RATE_LIMIT_CONTENT_CREATE)
def create_campground(
    request: Request,
    data: CampgroundCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_logged_in)
):
    """Create a new campsite."""
    return campground_service.create_campground(
        session=db,
        data=data,
        user_id=current_user.id,
        background_tasks=background_tasks
    )

@router.get("/{id}", response_model=CampgroundOut)
def get_campground(
    id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Retrieve campsite details with ratings, community stats, and user state."""
    user_id = current_user.id if current_user else None
    return campground_service.get_campground(db, id, user_id)

@router.put("/{id}", response_model=CampgroundOut)
def update_campground(
    id: int,
    data: CampgroundUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    campground: Campground = Depends(check_campground_author)
):
    """Update campsite details (author-only)."""
    return campground_service.update_campground(
        session=db,
        campground=campground,
        data=data,
        background_tasks=background_tasks
    )

@router.delete("/{id}")
def delete_campground(
    id: int,
    db: Session = Depends(get_db),
    campground: Campground = Depends(check_campground_author)
):
    """Cascade delete campsite and related entities (author-only)."""
    return campground_service.delete_campground(db, campground)
