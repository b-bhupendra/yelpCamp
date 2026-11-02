from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import Column, JSON, ForeignKey, Integer
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.campground import Campground
    from app.models.comment import Comment

class VisitorPhotoBase(SQLModel):
    campground_id: int = Field(
        sa_column=Column(Integer, ForeignKey("campground.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    media_type: str = Field(default="photo")  # "photo" | "video"
    image_url: str
    caption: Optional[str] = Field(default="")
    ai_tags: List[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    ai_media_caption: Optional[str] = Field(default="")
    expires_at: Optional[int] = Field(default=None, index=True)  # Unix timestamp for 24h stories; None for permanent

class VisitorPhoto(VisitorPhotoBase, table=True):
    __tablename__ = "visitor_photos"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    campground: Optional["Campground"] = Relationship(back_populates="visitor_photos")
    user: Optional["User"] = Relationship(back_populates="visitor_photos")
    comments: List["Comment"] = Relationship(back_populates="visitor_photo", cascade_delete=True)
    likes: List["VisitorPhotoLike"] = Relationship(back_populates="photo", cascade_delete=True)

class VisitorPhotoLike(SQLModel, table=True):
    __tablename__ = "visitor_photo_likes"
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    )
    photo_id: int = Field(
        sa_column=Column(Integer, ForeignKey("visitor_photos.id", ondelete="CASCADE"), primary_key=True, index=True)
    )

    photo: Optional[VisitorPhoto] = Relationship(back_populates="likes")
