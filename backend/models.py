from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import field_validator, field_serializer
from sqlalchemy import Column, JSON, ForeignKey, Integer, CheckConstraint
from sqlmodel import Field, SQLModel, Relationship

# ==============================================================================
# 1. USER MODELS
# ==============================================================================

class UserBase(SQLModel):
    username: str = Field(index=True, unique=True, min_length=3, max_length=50)
    avatar_url: Optional[str] = Field(default=None)

class User(UserBase, table=True):
    __tablename__ = "user"
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str

    campgrounds: List["Campground"] = Relationship(back_populates="author", cascade_delete=True)
    comments: List["Comment"] = Relationship(back_populates="author", cascade_delete=True)
    visitor_photos: List["VisitorPhoto"] = Relationship(back_populates="user", cascade_delete=True)
    votes: List["Vote"] = Relationship(back_populates="user", cascade_delete=True)
    wishlists: List["Wishlist"] = Relationship(back_populates="user", cascade_delete=True)
    check_ins: List["CheckIn"] = Relationship(back_populates="user", cascade_delete=True)
    managed_trips: List["Trip"] = Relationship(back_populates="owner", cascade_delete=True)

# ==============================================================================
# 2. CAMPGROUND MODELS
# ==============================================================================

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

    author: Optional[User] = Relationship(back_populates="campgrounds")
    comments: List["Comment"] = Relationship(back_populates="campground", cascade_delete=True)
    visitor_photos: List["VisitorPhoto"] = Relationship(back_populates="campground", cascade_delete=True)
    votes: List["Vote"] = Relationship(back_populates="campground", cascade_delete=True)
    wishlisted_by: List["Wishlist"] = Relationship(back_populates="campground", cascade_delete=True)
    check_ins: List["CheckIn"] = Relationship(back_populates="campground", cascade_delete=True)

# ==============================================================================
# 3. VISITOR PHOTOS & STORIES
# ==============================================================================

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

    campground: Optional[Campground] = Relationship(back_populates="visitor_photos")
    user: Optional[User] = Relationship(back_populates="visitor_photos")
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

# ==============================================================================
# 4. COMMENTS & REVIEWS
# ==============================================================================

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

    author: Optional[User] = Relationship(back_populates="comments")
    campground: Optional[Campground] = Relationship(back_populates="comments")
    visitor_photo: Optional[VisitorPhoto] = Relationship(back_populates="comments")

# ==============================================================================
# 5. SOCIAL & TRIPS
# ==============================================================================

class Wishlist(SQLModel, table=True):
    __tablename__ = "wishlist"
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    )
    campground_id: int = Field(
        sa_column=Column(Integer, ForeignKey("campground.id", ondelete="CASCADE"), primary_key=True, index=True)
    )

    user: Optional[User] = Relationship(back_populates="wishlists")
    campground: Optional[Campground] = Relationship(back_populates="wishlisted_by")

class CheckInBase(SQLModel):
    campground_id: int = Field(
        sa_column=Column(Integer, ForeignKey("campground.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CheckIn(CheckInBase, table=True):
    __tablename__ = "checkin"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )

    user: Optional[User] = Relationship(back_populates="check_ins")
    campground: Optional[Campground] = Relationship(back_populates="check_ins")

class TripBase(SQLModel):
    name: str = Field(min_length=1, max_length=100)

class Trip(TripBase, table=True):
    __tablename__ = "trip"
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )

    owner: Optional[User] = Relationship(back_populates="managed_trips")
    members: List["TripMember"] = Relationship(back_populates="trip", cascade_delete=True)

class TripMember(SQLModel, table=True):
    __tablename__ = "tripmember"
    trip_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trip.id", ondelete="CASCADE"), primary_key=True)
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    )

    trip: Optional[Trip] = Relationship(back_populates="members")

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

    user: Optional[User] = Relationship(back_populates="votes")
    campground: Optional[Campground] = Relationship(back_populates="votes")

# ==============================================================================
# 6. VECTOR EMBEDDINGS & AI NAVIGATION
# ==============================================================================

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

class UINavigationBase(SQLModel):
    id: str = Field(primary_key=True)
    feature_name: str
    route: str
    dom_selector: str
    description: str
    risk_level: str = Field(default="SAFE")

class UINavigation(UINavigationBase, table=True):
    __tablename__ = "ui_navigation"
    embedding: Optional[str] = Field(default=None)
