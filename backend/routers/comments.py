from typing import Optional
from fastapi import APIRouter, Request, Depends, HTTPException, Form
from sqlmodel import Session
from models import Comment, Campground, User
from database import get_session
from dependencies import is_logged_in, check_comment_author
from schemas import CommentCreate, CommentOut

from config import settings
from services.cloudinary_service import get_user_avatar_url

router = APIRouter(tags=["comments"])

@router.get("/")
async def get_comments(id: int, db: Session = Depends(get_session)):
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    return [
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
        }
        for c in campground.comments
    ]

@router.post("/")
async def create_comment(
    id: int,
    request: Request,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    text = None
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        text = body.get("text")
    else:
        form = await request.form()
        text = form.get("text")

    if not text or not str(text).strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    author_avatar = get_user_avatar_url(current_user.username, current_user.avatar_url)

    new_comment = Comment(
        text=str(text).strip(),
        author_id=current_user.id,
        author_username=current_user.username,
        author_avatar=author_avatar,
        campground_id=id
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    return new_comment

@router.get("/{comment_id}/edit")
async def get_edit_comment(
    id: int,
    comment_id: int,
    comment: Comment = Depends(check_comment_author)
):
    return comment

@router.post("/{comment_id}/edit")
@router.put("/{comment_id}")
async def update_comment(
    id: int,
    comment_id: int,
    request: Request,
    db: Session = Depends(get_session),
    comment: Comment = Depends(check_comment_author)
):
    text = None
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        text = body.get("text")
    else:
        form = await request.form()
        text = form.get("text")

    if not text or not str(text).strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    comment.text = str(text).strip()
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment

@router.post("/{comment_id}/delete")
@router.delete("/{comment_id}")
async def delete_comment(
    id: int,
    comment_id: int,
    db: Session = Depends(get_session),
    comment: Comment = Depends(check_comment_author)
):
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted successfully", "id": comment_id}
