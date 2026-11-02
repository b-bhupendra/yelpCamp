from typing import List
from fastapi import APIRouter, Depends, Request
from sqlmodel import Session
from app.api.deps import get_db, is_logged_in, check_comment_author
from app.models.user import User
from app.models.comment import Comment
from app.schemas.comment import CommentCreate, CommentOut
from app.services.comment_service import comment_service
from app.services.limiter import limiter

router = APIRouter(tags=["comments"])

@router.get("", response_model=List[CommentOut])
def get_comments(
    id: int,
    db: Session = Depends(get_db)
):
    """Retrieve all comments for a campground organized as a threaded hierarchy."""
    return comment_service.get_campground_comments(db, id)

@router.post("", response_model=CommentOut, status_code=201)
@limiter.limit("15/minute")
def create_comment(
    id: int,
    request: Request,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_logged_in)
):
    """Post a new comment or threaded reply for a campground."""
    return comment_service.create_campground_comment(db, id, current_user, data)

@router.put("/{comment_id}", response_model=CommentOut)
def update_comment(
    id: int,
    comment_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    comment: Comment = Depends(check_comment_author)
):
    """Update a comment (author-only)."""
    return comment_service.update_comment(db, comment, data)

@router.delete("/{comment_id}")
def delete_comment(
    id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    comment: Comment = Depends(check_comment_author)
):
    """Delete a comment (author-only)."""
    return comment_service.delete_comment(db, comment)

