from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlmodel import Session
from app.models.comment import Comment
from app.models.campground import Campground
from app.models.user import User
from app.models.visitor_photo import VisitorPhoto
from app.schemas.comment import CommentCreate, CommentOut
from app.repositories.comment_repo import comment_repo
from app.services.cloudinary_service import get_user_avatar_url

class CommentService:
    """Business logic for campground and photo comments."""

    def get_campground_comments(self, session: Session, campground_id: int) -> List[CommentOut]:
        return comment_repo.get_campground_comment_tree(session, campground_id)

    def create_campground_comment(
        self,
        session: Session,
        campground_id: int,
        current_user: User,
        data: CommentCreate
    ) -> CommentOut:
        campground = session.get(Campground, campground_id)
        if not campground:
            raise HTTPException(status_code=404, detail="Campground not found")

        text = str(data.text).strip()
        if not text:
            raise HTTPException(status_code=400, detail="Comment text cannot be empty")

        if data.parent_comment_id is not None:
            parent = session.get(Comment, data.parent_comment_id)
            if not parent or parent.campground_id != campground_id:
                raise HTTPException(status_code=400, detail="Parent comment does not exist for this campsite")

        if data.rating is not None and not (1 <= data.rating <= 5):
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

        new_comment = comment_repo.create(
            session=session,
            author_id=current_user.id,
            text=text,
            campground_id=campground_id,
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

    def update_comment(
        self,
        session: Session,
        comment: Comment,
        data: CommentCreate
    ) -> CommentOut:
        text = str(data.text).strip()
        if not text:
            raise HTTPException(status_code=400, detail="Comment text cannot be empty")

        updated = comment_repo.update(session, comment, text)
        author = session.get(User, updated.author_id)
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

    def delete_comment(self, session: Session, comment: Comment) -> Dict[str, Any]:
        c_id = comment.id
        comment_repo.delete(session, comment)
        return {"message": "Comment deleted successfully", "id": c_id}

    def get_photo_comments(self, session: Session, photo_id: int) -> List[CommentOut]:
        photo = session.get(VisitorPhoto, photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Visitor photo not found")
        return comment_repo.get_photo_comment_tree(session, photo_id)

    def create_photo_comment(
        self,
        session: Session,
        photo_id: int,
        current_user: User,
        data: CommentCreate
    ) -> CommentOut:
        photo = session.get(VisitorPhoto, photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Visitor photo not found")

        text = (data.text or "").strip()
        parent_comment_id = data.parent_comment_id

        if not text:
            raise HTTPException(status_code=400, detail="Comment text cannot be empty")

        if parent_comment_id is not None:
            parent = session.get(Comment, parent_comment_id)
            if not parent or parent.photo_id != photo_id:
                raise HTTPException(status_code=400, detail="Parent reply does not exist for this photo")

        new_comment = comment_repo.create(
            session=session,
            author_id=current_user.id,
            text=text,
            photo_id=photo_id,
            parent_comment_id=parent_comment_id
        )

        avatar = get_user_avatar_url(current_user.username, current_user.avatar_url)
        return CommentOut(
            id=new_comment.id,
            text=new_comment.text,
            parent_comment_id=new_comment.parent_comment_id,
            photo_id=new_comment.photo_id,
            author_id=new_comment.author_id,
            author_username=current_user.username,
            author_avatar=avatar,
            created_at=new_comment.created_at,
            replies=[]
        )

comment_service = CommentService()

