from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from models import Comment, Campground, User
from database import get_session
from dependencies import is_logged_in, check_comment_author
from schemas import CommentCreate, CommentOut
from services.limiter import limiter
from services.cloudinary_service import get_user_avatar_url
from repositories.comment_repo import comment_repo, build_tree

router = APIRouter(tags=["comments"])

def build_comment_tree(comments: List[Comment]) -> List[CommentOut]:
    """Helper preserving legacy signature; builds a typed recursive tree of comments."""
    # When comments are already CommentOut instances
    if comments and isinstance(comments[0], CommentOut):
        return comments
    author_map: Dict[int, User] = {}
    return build_tree(comments, author_map)

@router.get("", response_model=List[CommentOut])
def get_comments(
    id: int, 
    db: Session = Depends(get_session)
):
    """Retrieve all comments for a campground organized as a threaded hierarchy."""
    return comment_repo.get_campground_comment_tree(db, id)

@router.post("", response_model=CommentOut, status_code=201)
@limiter.limit("15/minute")
def create_comment(
    id: int,
    request: Request,
    data: CommentCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """
    Post a new comment or nested reply with typed SQLModel schema.
    SQLite triggers automatically update Campground.avg_rating in the C engine.
    """
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    text = str(data.text).strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    if data.parent_comment_id is not None:
        parent = db.get(Comment, data.parent_comment_id)
        if not parent or parent.campground_id != id:
            raise HTTPException(status_code=400, detail="Parent comment does not exist for this campsite")

    if data.rating is not None and not (1 <= data.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    new_comment = comment_repo.create(
        session=db,
        author_id=current_user.id,
        text=text,
        campground_id=id,
        parent_comment_id=data.parent_comment_id,
        rating=data.rating
    )

    avatar = get_user_avatar_url(current_user.username, current_user.avatar_url)
    return CommentOut(
        id=new_comment.id,
        text=new_comment.text,
        parent_comment_id=new_comment.parent_comment_id,
        rating=new_comment.rating,
        photo_id=new_comment.photo_id,
        campground_id=new_comment.campground_id,
        author_id=new_comment.author_id,
        author_username=current_user.username,
        author_avatar=avatar,
        created_at=new_comment.created_at,
        replies=[]
    )

@router.put("/{comment_id}", response_model=CommentOut)
def update_comment(
    id: int,
    comment_id: int,
    data: CommentCreate,
    db: Session = Depends(get_session),
    comment: Comment = Depends(check_comment_author)
):
    """Update a comment with pure REST PUT."""
    text = str(data.text).strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    updated = comment_repo.update(db, comment, text)
    author = db.get(User, updated.author_id)
    username = author.username if author else ""
    avatar = get_user_avatar_url(username, author.avatar_url if author else None)

    return CommentOut(
        id=updated.id,
        text=updated.text,
        parent_comment_id=updated.parent_comment_id,
        rating=updated.rating,
        photo_id=updated.photo_id,
        campground_id=updated.campground_id,
        author_id=updated.author_id,
        author_username=username,
        author_avatar=avatar,
        created_at=updated.created_at,
        replies=[]
    )

@router.delete("/{comment_id}")
def delete_comment(
    id: int,
    comment_id: int,
    db: Session = Depends(get_session),
    comment: Comment = Depends(check_comment_author)
):
    """Delete a comment with pure REST DELETE; rating trigger recalculates avg_rating."""
    comment_repo.delete(db, comment)
    return {"message": "Comment deleted successfully", "id": comment_id}
