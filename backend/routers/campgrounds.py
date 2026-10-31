import os
import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks, Request
from sqlmodel import Session, select, func, case, delete

from models import Campground, User, Comment, Vote, VisitorPhoto, VisitorPhotoLike, Wishlist, CheckIn, CampgroundEmbedding
from database import get_session
from dependencies import is_logged_in, check_campground_author
from schemas import (
    CampgroundCreate, CampgroundUpdate, CampgroundOut, CampgroundCard,
    PaginatedCampgrounds, FileUploadResponse, CommentOut
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

def build_campground_out(
    campground: Campground,
    likes_count: int,
    dislikes_count: int,
    visitor_photos_count: int,
    comments_raw: List[Comment]
) -> CampgroundOut:
    """Helper to construct a validated CampgroundOut schema with parsed gallery, amenities, and rules."""
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

    author_avatar = get_user_avatar_url(
        campground.author_username,
        campground.author.avatar_url if campground.author else None
    )

    comments_tree = build_comment_tree(comments_raw)

    comments_list = [
        CommentOut(
            id=c.id,
            text=c.text,
            author_id=c.author_id,
            author_username=c.author_username or "",
            author_avatar=get_user_avatar_url(c.author_username, c.author_avatar),
            campground_id=c.campground_id,
            parent_comment_id=c.parent_comment_id,
            rating=c.rating,
            created_at=c.created_at,
            replies=[]
        )
        for c in comments_raw
    ]

    safe_image = sanitize_campground_image(campground.image, campground.id)
    safe_gallery = sanitize_gallery_images(gallery_imgs, campground.id)

    return CampgroundOut(
        id=campground.id,
        title=campground.title or campground.name or "",
        name=campground.name or campground.title or "",
        price=float(campground.price) if campground.price is not None else 0.0,
        image=safe_image,
        description=campground.description or "",
        location=campground.location or "",
        location_address=campground.location_address or "",
        gallery_images=safe_gallery,
        amenities=amenities_list,
        rules=rules_dict,
        avg_rating=float(campground.avg_rating or 0.0),
        ai_media_caption=campground.ai_media_caption or "",
        community_summary=campground.community_summary or "",
        author_id=campground.author_id,
        author_username=campground.author_username or "",
        author_avatar=author_avatar,
        likes_count=likes_count,
        dislikes_count=dislikes_count,
        visitor_photos_count=visitor_photos_count,
        comments=comments_list,
        comments_tree=comments_tree
    )

@router.get("", response_model=PaginatedCampgrounds)
async def list_campgrounds(
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_session)
):
    """
    List campgrounds with pure database-heavy computation:
    Single SQL query performs joins, conditional aggregations (SUM CASE WHEN),
    sorting, and pagination directly in the database engine.
    Zero Python in-memory mapping loops.
    """
    likes_col = func.coalesce(
        func.sum(case((Vote.vote_type == 1, 1), else_=0)), 0
    ).label("likes_count")

    dislikes_col = func.coalesce(
        func.sum(case((Vote.vote_type == -1, 1), else_=0)), 0
    ).label("dislikes_count")

    query = (
        select(
            Campground.id,
            func.coalesce(func.nullif(Campground.title, ''), Campground.name, '').label("title"),
            Campground.price,
            Campground.image,
            Campground.description,
            Campground.location,
            Campground.location_address,
            Campground.avg_rating,
            Campground.author_id,
            Campground.author_username,
            likes_col,
            dislikes_col,
        )
        .outerjoin(Vote, Vote.campground_id == Campground.id)
    )

    count_query = select(func.count(Campground.id))

    # Search filter natively on title or description
    if search:
        search_pattern = f"%{search}%"
        condition = (
            (Campground.title.ilike(search_pattern)) | 
            (Campground.description.ilike(search_pattern))
        )
        query = query.where(condition)
        count_query = count_query.where(condition)

    # Native SQL price filtering
    if min_price is not None:
        query = query.where(Campground.price >= min_price)
        count_query = count_query.where(Campground.price >= min_price)
    if max_price is not None:
        query = query.where(Campground.price <= max_price)
        count_query = count_query.where(Campground.price <= max_price)

    # Database-level grouping for aggregate vote counts
    query = query.group_by(Campground.id)

    # Native SQL sorting
    if sort == "price_asc":
        query = query.order_by(Campground.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Campground.price.desc())
    elif sort == "title":
        query = query.order_by(Campground.title.asc())
    else:
        query = query.order_by(Campground.id.desc())

    # Fast SQL COUNT(*) in engine
    total = db.exec(count_query).one() or 0
    start = (page - 1) * limit
    paginated_rows = db.exec(query.offset(start).limit(limit)).all()
    total_pages = (total + limit - 1) // limit if total > 0 else 1

    # Backend operates strictly as an I/O machine streaming SQL rows into CampgroundCard
    items = [
        CampgroundCard(
            id=r.id,
            title=r.title or "",
            price=float(r.price) if r.price is not None else 0.0,
            image=r.image or "",
            description=r.description or "",
            location=r.location or "",
            location_address=r.location_address or "",
            avg_rating=float(r.avg_rating or 0.0),
            author_id=r.author_id,
            author_username=r.author_username or "",
            likes_count=r.likes_count,
            dislikes_count=r.dislikes_count,
        )
        for r in paginated_rows
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
    return FileUploadResponse(
        url=cdn_url,
        filename=file.filename
    )

@router.post("", response_model=CampgroundOut, status_code=201)
@limiter.limit(settings.RATE_LIMIT_CONTENT_CREATE)
async def create_campground(
    request: Request,
    data: CampgroundCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Create a new campground with typed SQLModel schema."""
    from services.multimodal_embedder import process_campground_ingestion

    clean_image = sanitize_campground_image(data.image, None)
    clean_gallery = sanitize_gallery_images(data.gallery_images, None)

    new_campground = Campground(
        name=data.title,
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
    return build_campground_out(
        campground=new_campground,
        likes_count=0,
        dislikes_count=0,
        visitor_photos_count=0,
        comments_raw=[]
    )

@router.get("/{id}", response_model=CampgroundOut)
async def get_campground(id: int, db: Session = Depends(get_session)):
    """
    Retrieve full campsite details with metrics calculated in the database engine:
    likes, dislikes, and visitor photos are counted via SQL scalar subqueries.
    """
    likes_sub = (
        select(func.count(Vote.user_id))
        .where(Vote.campground_id == id, Vote.vote_type == 1)
        .scalar_subquery()
    )
    dislikes_sub = (
        select(func.count(Vote.user_id))
        .where(Vote.campground_id == id, Vote.vote_type == -1)
        .scalar_subquery()
    )
    stories_sub = (
        select(func.count(VisitorPhoto.id))
        .where(VisitorPhoto.campground_id == id)
        .scalar_subquery()
    )

    row = db.exec(
        select(
            Campground,
            func.coalesce(likes_sub, 0).label("likes_count"),
            func.coalesce(dislikes_sub, 0).label("dislikes_count"),
            func.coalesce(stories_sub, 0).label("visitor_photos_count"),
        ).where(Campground.id == id)
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Campground not found")

    campground, likes_cnt, dislikes_cnt, stories_cnt = row

    comments_raw = db.exec(
        select(Comment)
        .where(Comment.campground_id == id)
        .order_by(Comment.created_at.asc())
    ).all()

    return build_campground_out(
        campground=campground,
        likes_count=likes_cnt,
        dislikes_count=dislikes_cnt,
        visitor_photos_count=stories_cnt,
        comments_raw=list(comments_raw)
    )

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
        campground.name = data.title
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

    # Fetch metric counts from SQL engine
    likes_sub = select(func.count(Vote.user_id)).where(Vote.campground_id == id, Vote.vote_type == 1).scalar_subquery()
    dislikes_sub = select(func.count(Vote.user_id)).where(Vote.campground_id == id, Vote.vote_type == -1).scalar_subquery()
    stories_sub = select(func.count(VisitorPhoto.id)).where(VisitorPhoto.campground_id == id).scalar_subquery()

    row = db.exec(
        select(
            func.coalesce(likes_sub, 0),
            func.coalesce(dislikes_sub, 0),
            func.coalesce(stories_sub, 0),
        )
    ).first()
    likes_cnt, dislikes_cnt, stories_cnt = row if row else (0, 0, 0)

    comments_raw = db.exec(
        select(Comment)
        .where(Comment.campground_id == id)
        .order_by(Comment.created_at.asc())
    ).all()

    return build_campground_out(
        campground=campground,
        likes_count=likes_cnt,
        dislikes_count=dislikes_cnt,
        visitor_photos_count=stories_cnt,
        comments_raw=list(comments_raw)
    )

@router.delete("/{id}")
async def delete_campground(
    id: int,
    db: Session = Depends(get_session),
    campground: Campground = Depends(check_campground_author)
):
    """
    Cascade delete campsite and all related entities directly in the database engine.
    Uses SQL subqueries so zero rows are pulled into Python memory before deletion.
    """
    # 1. Delete vector embeddings
    db.exec(delete(CampgroundEmbedding).where(CampgroundEmbedding.campground_id == id))
    
    # 2. Delete visitor photo likes and comments using subquery predicate (zero in-memory photo fetching)
    photo_ids_sub = select(VisitorPhoto.id).where(VisitorPhoto.campground_id == id).scalar_subquery()
    db.exec(delete(VisitorPhotoLike).where(VisitorPhotoLike.photo_id.in_(photo_ids_sub)))
    db.exec(delete(Comment).where(Comment.photo_id.in_(photo_ids_sub)))
    db.exec(delete(VisitorPhoto).where(VisitorPhoto.campground_id == id))

    # 3. Delete comments on campground (replies and root comments)
    db.exec(delete(Comment).where(Comment.campground_id == id))

    # 4. Delete votes, wishlists, and check-ins
    db.exec(delete(Vote).where(Vote.campground_id == id))
    db.exec(delete(Wishlist).where(Wishlist.campground_id == id))
    db.exec(delete(CheckIn).where(CheckIn.campground_id == id))

    # 5. Delete campground entity
    db.delete(campground)
    db.commit()
    return {"message": "Campground deleted successfully", "id": id}
