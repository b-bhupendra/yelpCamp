from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Column, ForeignKey, Integer, CheckConstraint
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.campground import Campground
    from app.models.visitor_photo import VisitorPhoto

class CommentBase(SQLModel):
    text: str = Field(min_length=1, max_length=1000)
    parent_comment_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("comment.id", ondelete="CASCADE"), nullable=True, index=True)
    )
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    campground_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("campground.id", ondelete="CASCADE"), nullable=True, index=True)
    )
    photo_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("visitor_photos.id", ondelete="CASCADE"), nullable=True, index=True)
    )

class Comment(CommentBase, table=True):
    __tablename__ = "comment"
    __table_args__ = (
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="chk_comment_rating"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    author_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    author: Optional["User"] = Relationship(back_populates="comments")
    campground: Optional["Campground"] = Relationship(back_populates="comments")
    visitor_photo: Optional["VisitorPhoto"] = Relationship(back_populates="comments")

