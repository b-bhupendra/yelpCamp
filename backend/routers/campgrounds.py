import os
import uuid
import shutil
from typing import Optional, List, Union
from fastapi import APIRouter, Request, Depends, HTTPException, Form, UploadFile, File, Query
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

router = APIRouter(tags=["campgrounds"])

# Ensure uploads directory exists (guarded for serverless)
try:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
except Exception:
    pass

@router.get("/")
async def get_campgrounds(
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: Optional[str] = None,
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_session)
):
    query = select(Campground)

    # Search filter (name or description)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Campground.name.ilike(search_pattern)) | 
            (Campground.description.ilike(search_pattern))
        )

    # Fetch all matching campgrounds
    all_results = db.exec(query).all()

    # Price filtering in Python (since price is stored as string in legacy schema)
    filtered_results = []
    for camp in all_results:
        try:
            p_val = float(camp.price.replace("$", "").strip())
        except (ValueError, AttributeError):
            p_val = 0.0

        if min_price is not None and p_val < min_price:
            continue
        if max_price is not None and p_val > max_price:
            continue
        filtered_results.append(camp)

    # Sorting
    if sort == "price_asc":
        filtered_results.sort(key=lambda c: float(c.price.replace("$", "").strip()) if c.price.replace("$", "").strip().replace(".", "").isdigit() else 0)
    elif sort == "price_desc":
        filtered_results.sort(key=lambda c: float(c.price.replace("$", "").strip()) if c.price.replace("$", "").strip().replace(".", "").isdigit() else 0, reverse=True)
    elif sort == "name":
        filtered_results.sort(key=lambda c: c.name.lower())
    else:
        # Default order (newest/by id descending)
        filtered_results.reverse()

    # If page parameter is not provided, return simple list for backwards compatibility
    if page is None:
        return filtered_results

    # Pagination calculation
    total = len(filtered_results)
    start = (page - 1) * limit
    end = start + limit
    paginated_items = filtered_results[start:end]
    total_pages = (total + limit - 1) // limit if total > 0 else 1

    return {
        "data": paginated_items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": total_pages
    }

@router.post("/upload", response_model=FileUploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(is_logged_in)
):
    from services.cloudinary_service import upload_campground_image

    # Validate file extension
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Invalid file format. Allowed: JPG, PNG, WEBP, GIF.")

    cdn_url = upload_campground_image(file.file)

    return {
        "url": cdn_url,
        "filename": file.filename
    }

@router.post("/")
async def create_campground(
    request: Request,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    name = None
    image = None
    price = "50"
    description = ""

    # Parse JSON or Form payload
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        name = body.get("name")
        image = body.get("image")
        price = str(body.get("price", "50"))
        description = body.get("description", "")
    else:
        form = await request.form()
        name = form.get("name")
        image = form.get("image")
        price = str(form.get("price", "50"))
        description = form.get("description", "")

    if not name:
        raise HTTPException(status_code=400, detail="Campground name is required")

    if not image:
        image = "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80"

    new_campground = Campground(
        name=name,
        image=image,
        price=price,
        description=description,
        author_id=current_user.id,
        author_username=current_user.username
    )
    db.add(new_campground)
    db.commit()
    db.refresh(new_campground)
    return new_campground

@router.get("/{id}")
async def get_campground(id: int, db: Session = Depends(get_session)):
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    
    likes = len([v for v in campground.votes if v.vote_type == 1])
    dislikes = len([v for v in campground.votes if v.vote_type == -1])
    author_avatar = get_user_avatar_url(
        campground.author_username,
        campground.author.avatar_url if campground.author else None
    )
    
    liked_by = [
        {
            "user_id": v.user_id,
            "username": v.user.username if v.user else f"Scout_{v.user_id}",
            "avatar_url": get_user_avatar_url(
                v.user.username if v.user else f"Scout_{v.user_id}",
                v.user.avatar_url if v.user else None
            )
        }
        for v in campground.votes if v.vote_type == 1
    ]

    return {
        "id": campground.id,
        "name": campground.name,
        "price": campground.price,
        "image": campground.image,
        "description": campground.description,
        "author_id": campground.author_id,
        "author_username": campground.author_username,
        "author_avatar": author_avatar,
        "likes_count": likes,
        "dislikes_count": dislikes,
        "liked_by": liked_by[:6],
        "comments": [
            {
                "id": c.id,
                "text": c.text,
                "author_id": c.author_id,
                "author_username": c.author_username,
                "author_avatar": get_user_avatar_url(
                    c.author_username,
                    c.author_avatar or (c.author.avatar_url if c.author else None)
                ),
                "campground_id": c.campground_id
            } for c in campground.comments
        ]
    }

@router.get("/{id}/edit")
async def get_edit_campground(
    id: int,
    campground: Campground = Depends(check_campground_author)
):
    return campground

@router.post("/{id}/edit")
@router.put("/{id}")
async def update_campground(
    id: int,
    request: Request,
    db: Session = Depends(get_session),
    campground: Campground = Depends(check_campground_author)
):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        if "name" in body and body["name"]:
            campground.name = body["name"]
        if "image" in body and body["image"]:
            campground.image = body["image"]
        if "price" in body and body["price"]:
            campground.price = str(body["price"])
        if "description" in body:
            campground.description = body["description"]
    else:
        form = await request.form()
        if form.get("name"):
            campground.name = form.get("name")
        if form.get("image"):
            campground.image = form.get("image")
        if form.get("price"):
            campground.price = str(form.get("price"))
        if form.get("description") is not None:
            campground.description = form.get("description")

    db.add(campground)
    db.commit()
    db.refresh(campground)
    return campground

@router.post("/{id}/delete")
@router.delete("/{id}")
async def delete_campground(
    id: int,
    db: Session = Depends(get_session),
    campground: Campground = Depends(check_campground_author)
):
    db.delete(campground)
    db.commit()
    return {"message": "Campground deleted successfully", "id": id}
