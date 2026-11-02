from typing import Optional, List, Dict
from sqlmodel import Session, select
from app.models.comment import Comment
from app.models.user import User
from app.schemas.comment import CommentOut
from app.services.cloudinary_service import get_user_avatar_url

def build_tree(comments: List[Comment], author_map: Dict[int, User]) -> List[CommentOut]:
    """Builds a typed recursive tree of threaded comments preserving reply hierarchy."""
    nodes: Dict[int, CommentOut] = {}
    roots: List[CommentOut] = []

    for c in comments:
        author = author_map.get(c.author_id)
        author_username = author.username if author else ""
        author_avatar = get_user_avatar_url(author_username, author.avatar_url if author else None)

        nodes[c.id] = CommentOut(
            id=c.id,
            text=c.text,
            parent_comment_id=c.parent_comment_id,
            rating=c.rating,
            photo_id=c.photo_id,
            campground_id=c.campground_id,
            author_id=c.author_id,
            author_username=author_username,
            author_avatar=author_avatar,
            created_at=c.created_at,
            replies=[]
        )

    for c in comments:
        c_node = nodes[c.id]
        if c.parent_comment_id and c.parent_comment_id in nodes:
            nodes[c.parent_comment_id].replies.append(c_node)
        else:
            roots.append(c_node)

    return roots

class CommentRepository:
    """Repository handling all threaded comment queries and persistence."""

    def get_campground_comment_tree(
        self,
        session: Session,
        campground_id: int
    ) -> List[CommentOut]:
        comments = session.exec(
            select(Comment)
            .where(Comment.campground_id == campground_id)
            .order_by(Comment.created_at.asc())
        ).all()

        author_ids = list({c.author_id for c in comments if c.author_id})
        authors = session.exec(select(User).where(User.id.in_(author_ids))).all() if author_ids else []
        author_map = {u.id: u for u in authors}

        return build_tree(list(comments), author_map)

    def get_photo_comment_tree(
        self,
        session: Session,
        photo_id: int
    ) -> List[CommentOut]:
        comments = session.exec(
            select(Comment)
            .where(Comment.photo_id == photo_id)
            .order_by(Comment.created_at.asc())
        ).all()

        author_ids = list({c.author_id for c in comments if c.author_id})
        authors = session.exec(select(User).where(User.id.in_(author_ids))).all() if author_ids else []
        author_map = {u.id: u for u in authors}

        return build_tree(list(comments), author_map)

    def create(
        self,
        session: Session,
        author_id: int,
        text: str,
        campground_id: Optional[int] = None,
        photo_id: Optional[int] = None,
        parent_comment_id: Optional[int] = None,
        rating: Optional[int] = None
    ) -> Comment:
        new_comment = Comment(
            text=text.strip(),
            parent_comment_id=parent_comment_id,
            rating=rating,
            campground_id=campground_id,
            photo_id=photo_id,
            author_id=author_id
        )
        session.add(new_comment)
        session.commit()
        session.refresh(new_comment)
        return new_comment

    def update(self, session: Session, comment: Comment, text: str) -> Comment:
        comment.text = text.strip()
        session.add(comment)
        session.commit()
        session.refresh(comment)
        return comment

    def delete(self, session: Session, comment: Comment) -> int:
        comment_id = comment.id
        session.delete(comment)
        session.commit()
        return comment_id

comment_repo = CommentRepository()

