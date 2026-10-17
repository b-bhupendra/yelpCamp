import os
import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks, Request
from sqlmodel import Session, select, func

from models import Campground, User, Comment
from database import get_session
from dependencies import is_logged_in, check_campground_author
from schemas import (
    CampgroundCreate, CampgroundUpdate, CampgroundOut, 
    PaginatedCampgrounds, FileUploadResponse
)
from config import settings
from services.cloudinary_service import upload_campground_image, get_user_avatar_url
from services.limiter import limiter
from services.image_validator import sanitize_campground_image, sanitize_gallery_images
from routers.comments import build_comment_tree

logger = logging.getLogger(__name__)

router = APIRouter(tags=["campgrounds"])

# Ensure uploads directory exists (guarded for serverless)
try:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
except Exception:
    pass

def format_campground_out(campground: Campground) -> Dict[str, Any]:
    """Helper to convert a Campground model to a clean dictionary matching CampgroundOut."""
    likes = len([v for v in campground.votes if v.vote_type == 1]) if campground.votes else 0
    dislikes = len([v for v in campground.votes if v.vote_type == -1]) if campground.votes else 0
    author_avatar = get_user_avatar_url(
        campground.author_username,
        campground.author.avatar_url if campground.author else None
    )

    gallery_imgs = []
    if campground.gallery_images:
        try:
            gallery_imgs = json.loads(campground.gallery_images) if isinstance(campground.gallery_images, str) else list(campground.gallery_images)
        except Exception:
            gallery_imgs = []

    amenities_list = []
    if campground.amenities:
        try:
            amenities_list = json.loads(campground.amenities) if isinstance(campground.amenities, str) else list(campground.amenities)
        except Exception:
            amenities_list = []

    rules_dict = {}
    if campground.rules:
        try:
            rules_dict = json.loads(campground.rules) if isinstance(campground.rules, str) else dict(campground.rules)
        except Exception:
            rules_dict = {"notes": str(campground.rules)}

    comments_list = [
        {
            "id": c.id,
            "text": c.text,
            "author_id": c.author_id,
            "author_username": c.author_username,
            "author_avatar": get_user_avatar_url(
                c.author_username,
                c.author_avatar or (c.author.avatar_url if c.author else None)
            ),
            "campground_id": c.campground_id,
            "parent_comment_id": c.parent_comment_id,
            "rating": c.rating,
            "created_at": c.created_at,
            "replies": []
        }
        for c in (campground.comments or [])
    ]

    safe_image = sanitize_campground_image(campground.image, campground.id)
    safe_gallery = sanitize_gallery_images(gallery_imgs, campground.id)

    return {
        "id": campground.id,
        "title": campground.title or "",
        "price": float(campground.price) if campground.price is not None else 0.0,
        "image": safe_image,
        "description": campground.description or "",
        "location": campground.location or "",
        "location_address": campground.location_address or "",
        "gallery_images": safe_gallery,
        "amenities": amenities_list,
        "rules": rules_dict,
        "avg_rating": campground.avg_rating or 0.0,
        "ai_media_caption": campground.ai_media_caption or "",
        "community_summary": campground.community_summary or "",
        "author_id": campground.author_id,
        "author_username": campground.author_username,
        "author_avatar": author_avatar,
        "likes_count": likes,
        "dislikes_count": dislikes,
        "visitor_photos_count": len(campground.visitor_photos) if campground.visitor_photos else 0,
        "comments": comments_list,
        "comments_tree": build_comment_tree(campground.comments or [])
    }

@router.get("/", response_model=PaginatedCampgrounds)
async def list_campgrounds(
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_session)
):
    """List campgrounds with native SQL search, price filtering, and pagination."""
    query = select(Campground)

    # Search filter natively on title or description
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Campground.title.ilike(search_pattern)) | 
            (Campground.description.ilike(search_pattern))
        )

    # Native SQL price filtering
    if min_price is not None:
        query = query.where(Campground.price >= min_price)
    if max_price is not None:
        query = query.where(Campground.price <= max_price)

    # Native SQL sorting
    if sort == "price_asc":
        query = query.order_by(Campground.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Campground.price.desc())
    elif sort == "title":
        query = query.order_by(Campground.title.asc())
    else:
        query = query.order_by(Campground.id.desc())

    # Total count and paginated items
    all_matched = db.exec(query).all()
    total = len(all_matched)
    start = (page - 1) * limit
    paginated_records = db.exec(query.offset(start).limit(limit)).all()
    total_pages = (total + limit - 1) // limit if total > 0 else 1

    return PaginatedCampgrounds(
        items=[format_campground_out(c) for c in paginated_records],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )

@router.post("/upload", response_model=FileUploadResponse)
@limiter.limit("15/minute")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(is_logged_in)
):
    """Upload a campsite image to Cloudinary CDN."""
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Invalid file format. Allowed: JPG, PNG, WEBP, GIF.")

    cdn_url = upload_campground_image(file.file)
    return {
        "url": cdn_url,
        "filename": file.filename
    }

@router.post("/", response_model=CampgroundOut, status_code=201)
@limiter.limit(settings.RATE_LIMIT_CONTENT_CREATE)
async def create_campground(
    request: Request,
    data: CampgroundCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Create a new campground with typed JSON schema."""
    from services.multimodal_embedder import process_campground_ingestion

    clean_image = sanitize_campground_image(data.image, None)
    clean_gallery = sanitize_gallery_images(data.gallery_images, None)

    new_campground = Campground(
        title=data.title,
        image=clean_image,
        price=data.price,
        description=data.description,
        location=data.location or "",
        location_address=data.location_address or "",
        gallery_images=json.dumps(clean_gallery),
        amenities=json.dumps(data.amenities) if data.amenities else "[]",
        rules=json.dumps(data.rules) if data.rules else "",
        author_id=current_user.id,
        author_username=current_user.username
    )
    db.add(new_campground)
    db.commit()
    db.refresh(new_campground)

    background_tasks.add_task(process_campground_ingestion, new_campground.id)
    return format_campground_out(new_campground)

@router.get("/{id}", response_model=CampgroundOut)
async def get_campground(id: int, db: Session = Depends(get_session)):
    """Retrieve full campsite details."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    return format_campground_out(campground)

@router.put("/{id}", response_model=CampgroundOut)
async def update_campground(
    id: int,
    data: CampgroundUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    campground: Campground = Depends(check_campground_author)
):
    """Update campsite details with pure REST PUT."""
    from services.multimodal_embedder import process_campground_ingestion

    if data.title is not None:
        campground.title = data.title
    if data.image is not None:
        campground.image = sanitize_campground_image(data.image, campground.id)
    if data.price is not None:
        campground.price = data.price
    if data.description is not None:
        campground.description = data.description
    if data.location is not None:
        campground.location = data.location
    if data.location_address is not None:
        campground.location_address = data.location_address
    if data.gallery_images is not None:
        campground.gallery_images = json.dumps(sanitize_gallery_images(data.gallery_images, campground.id))
    if data.amenities is not None:
        campground.amenities = json.dumps(data.amenities)
    if data.rules is not None:
        campground.rules = json.dumps(data.rules)

    db.add(campground)
    db.commit()
    db.refresh(campground)

    background_tasks.add_task(process_campground_ingestion, campground.id)
    return format_campground_out(campground)

@router.delete("/{id}")
async def delete_campground(
    id: int,
    db: Session = Depends(get_session),
    campground: Campground = Depends(check_campground_author)
):
    """Cascade delete campsite and all related entities with pure REST DELETE."""
    from models import CampgroundEmbedding, Vote, Wishlist, CheckIn, VisitorPhoto, VisitorPhotoLike, Comment
    from sqlmodel import select, delete

    # 1. Delete vector embeddings
    db.exec(delete(CampgroundEmbedding).where(CampgroundEmbedding.campground_id == id))
    
    # 2. Delete visitor photos and photo child records (likes and photo comments)
    photos = db.exec(select(VisitorPhoto).where(VisitorPhoto.campground_id == id)).all()
    for p in photos:
        db.exec(delete(VisitorPhotoLike).where(VisitorPhotoLike.photo_id == p.id))
        db.exec(delete(Comment).where(Comment.photo_id == p.id))
        db.delete(p)

    # 3. Delete comments on campground (replies first then root comments)
    db.exec(delete(Comment).where(Comment.campground_id == id, Comment.parent_comment_id.is_not(None)))
    db.exec(delete(Comment).where(Comment.campground_id == id))

    # 4. Delete votes, wishlists, and check-ins
    db.exec(delete(Vote).where(Vote.campground_id == id))
    db.exec(delete(Wishlist).where(Wishlist.campground_id == id))
    db.exec(delete(CheckIn).where(CheckIn.campground_id == id))

    # 5. Delete campground entity
    db.delete(campground)
    db.commit()
    return {"message": "Campground deleted successfully", "id": id}
