from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from models import Comment, Campground, User
from database import get_session
from dependencies import is_logged_in, check_comment_author
from schemas import CommentCreate, CommentOut
from services.cloudinary_service import get_user_avatar_url

router = APIRouter(tags=["comments"])

def build_comment_tree(comments: List[Comment]) -> List[Dict[str, Any]]:
    """Builds a clean recursive tree of threaded comments preserving reply hierarchy."""
    nodes: Dict[int, Dict[str, Any]] = {}
    roots: List[Dict[str, Any]] = []

    for c in comments:
        nodes[c.id] = {
            "id": c.id,
            "text": c.text,
            "parent_comment_id": c.parent_comment_id,
            "rating": c.rating,
            "photo_id": c.photo_id,
            "campground_id": c.campground_id,
            "author_id": c.author_id,
            "author_username": c.author_username,
            "author_avatar": get_user_avatar_url(
                c.author_username,
                c.author_avatar or (c.author.avatar_url if c.author else None)
            ),
            "created_at": c.created_at,
            "replies": []
        }

    for c in comments:
        c_dict = nodes[c.id]
        if c.parent_comment_id and c.parent_comment_id in nodes:
            nodes[c.parent_comment_id]["replies"].append(c_dict)
        else:
            roots.append(c_dict)

    return roots

@router.get("/", response_model=List[CommentOut])
async def get_comments(
    id: int, 
    db: Session = Depends(get_session)
):
    """Retrieve all comments for a campground organized as a threaded hierarchy."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    return build_comment_tree(campground.comments)

@router.post("/", response_model=CommentOut, status_code=201)
async def create_comment(
    id: int,
    data: CommentCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
):
    """Post a new comment or nested reply with typed JSON schema."""
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    text = str(data.text).strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    # Validate parent_comment_id if present
    if data.parent_comment_id is not None:
        parent = db.get(Comment, data.parent_comment_id)
        if not parent or parent.campground_id != id:
            raise HTTPException(status_code=400, detail="Parent comment does not exist for this campsite")

    # Validate rating
    if data.rating is not None:
        if not (1 <= data.rating <= 5):
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    author_avatar = get_user_avatar_url(current_user.username, current_user.avatar_url)

    new_comment = Comment(
        text=text,
        parent_comment_id=data.parent_comment_id,
        rating=data.rating,
        author_id=current_user.id,
        author_username=current_user.username,
        author_avatar=author_avatar,
        campground_id=id
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    # Recalculate campground average rating if root review rating was posted
    if data.rating is not None and data.parent_comment_id is None:
        avg_statement = select(func.avg(Comment.rating)).where(
            Comment.campground_id == id,
            Comment.rating != None,
            Comment.parent_comment_id == None
        )
        avg_res = db.exec(avg_statement).one_or_none()
        if avg_res is not None:
            campground.avg_rating = round(float(avg_res), 1)
            db.add(campground)
            db.commit()

    return {
        "id": new_comment.id,
        "text": new_comment.text,
        "parent_comment_id": new_comment.parent_comment_id,
        "rating": new_comment.rating,
        "photo_id": new_comment.photo_id,
        "campground_id": new_comment.campground_id,
        "author_id": new_comment.author_id,
        "author_username": new_comment.author_username,
        "author_avatar": new_comment.author_avatar,
        "created_at": new_comment.created_at,
        "replies": []
    }

@router.put("/{comment_id}", response_model=CommentOut)
async def update_comment(
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

    comment.text = text
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id,
        "text": comment.text,
        "parent_comment_id": comment.parent_comment_id,
        "rating": comment.rating,
        "photo_id": comment.photo_id,
        "campground_id": comment.campground_id,
        "author_id": comment.author_id,
        "author_username": comment.author_username,
        "author_avatar": comment.author_avatar,
        "created_at": comment.created_at,
        "replies": []
    }

@router.delete("/{comment_id}")
async def delete_comment(
    id: int,
    comment_id: int,
    db: Session = Depends(get_session),
    comment: Comment = Depends(check_comment_author)
):
    """Delete a comment with pure REST DELETE."""
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted successfully", "id": comment_id}
