from typing import Optional, List, Dict, Any, TYPE_CHECKING
from pydantic import field_validator, field_serializer
from sqlalchemy import Column, JSON, ForeignKey, Integer, CheckConstraint
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.comment import Comment
    from app.models.visitor_photo import VisitorPhoto
    from app.models.social import Wishlist, CheckIn

class CampgroundBase(SQLModel):
    title: str = Field(index=True, min_length=1, max_length=150)
    price: float = Field(default=0.0, ge=0.0, index=True)
    image: str = Field(default="")
    description: str = Field(default="")
    location: str = Field(default="", index=True)
    location_address: Optional[str] = Field(default="")
    avg_rating: float = Field(default=0.0)
    ai_media_caption: Optional[str] = Field(default="")
    community_summary: Optional[str] = Field(default="")

    @field_validator("price", mode="before")
    @classmethod
    def parse_price(cls, v):
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            cleaned = v.replace("$", "").strip()
            try:
                return float(cleaned)
            except ValueError:
                return 0.0
        return 0.0

    @field_serializer("price", when_used="always")
    def serialize_price(self, v):
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            try:
                return float(v.replace("$", "").strip())
            except ValueError:
                return 0.0
        return 0.0

class Campground(CampgroundBase, table=True):
    __tablename__ = "campground"
    id: Optional[int] = Field(default=None, primary_key=True)
    gallery_images: List[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    amenities: List[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    rules: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    author_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )

    author: Optional["User"] = Relationship(back_populates="campgrounds")
    comments: List["Comment"] = Relationship(back_populates="campground", cascade_delete=True)
    visitor_photos: List["VisitorPhoto"] = Relationship(back_populates="campground", cascade_delete=True)
    votes: List["Vote"] = Relationship(back_populates="campground", cascade_delete=True)
    wishlisted_by: List["Wishlist"] = Relationship(back_populates="campground", cascade_delete=True)
    check_ins: List["CheckIn"] = Relationship(back_populates="campground", cascade_delete=True)

class Vote(SQLModel, table=True):
    __tablename__ = "vote"
    __table_args__ = (
        CheckConstraint("vote_type IN (1, -1)", name="chk_vote_type"),
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    )
    campground_id: int = Field(
        sa_column=Column(Integer, ForeignKey("campground.id", ondelete="CASCADE"), primary_key=True, index=True)
    )
    vote_type: int = Field(default=1)  # 1 for like, -1 for dislike

    user: Optional["User"] = Relationship(back_populates="votes")
    campground: Optional[Campground] = Relationship(back_populates="votes")

class CampgroundEmbedding(SQLModel, table=True):
    __tablename__ = "campground_embeddings"
    id: Optional[int] = Field(default=None, primary_key=True)
    campground_id: int = Field(
        sa_column=Column(Integer, ForeignKey("campground.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    )
    embedding_json: str = Field(default="[]")
    embedding_dim: int = Field(default=768)
    content_summary: str = Field(default="")
    has_image_embedding: bool = Field(default=False)
    has_video_embedding: bool = Field(default=False)
    updated_at: str = Field(default="")

