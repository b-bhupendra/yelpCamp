from datetime import datetime, timezone
from typing import Optional, List
from pydantic import field_validator
from sqlmodel import Field, SQLModel, Relationship

# ==============================================================================
# 1. USER MODELS
# ==============================================================================

class UserBase(SQLModel):
    username: str = Field(index=True, unique=True)
    avatar_url: Optional[str] = Field(default=None)

class User(UserBase, table=True):
    __tablename__ = "user"
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str

    campgrounds: List["Campground"] = Relationship(back_populates="author")
    comments: List["Comment"] = Relationship(back_populates="author")
    wishlist: List["Wishlist"] = Relationship(back_populates="user")
    check_ins: List["CheckIn"] = Relationship(back_populates="user")
    managed_trips: List["Trip"] = Relationship(back_populates="owner")
    votes: List["Vote"] = Relationship(back_populates="user")
    visitor_photos: List["VisitorPhoto"] = Relationship(back_populates="user")

# ==============================================================================
# 2. CAMPGROUND MODELS
# ==============================================================================

class CampgroundBase(SQLModel):
    name: str = Field(default="")
    title: str = Field(default="", index=True)
    price: float = Field(default=0.0, index=True)
    image: str = Field(default="")
    description: str = Field(default="")
    location: str = Field(default="")
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

class Campground(CampgroundBase, table=True):
    __tablename__ = "campground"
    id: Optional[int] = Field(default=None, primary_key=True)
    gallery_images: str = Field(default="[]")  # JSON list of image URLs
    amenities: str = Field(default="[]")       # JSON list of amenity tags
    rules: Optional[str] = Field(default="")
    author_id: Optional[int] = Field(default=None, foreign_key="user.id")
    author_username: str = Field(default="")
    
    author: Optional[User] = Relationship(back_populates="campgrounds")
    comments: List["Comment"] = Relationship(back_populates="campground", cascade_delete=True)
    wishlisted_by: List["Wishlist"] = Relationship(back_populates="campground")
    check_ins: List["CheckIn"] = Relationship(back_populates="campground")
    votes: List["Vote"] = Relationship(back_populates="campground")
    visitor_photos: List["VisitorPhoto"] = Relationship(back_populates="campground", cascade_delete=True)

# ==============================================================================
# 3. VISITOR PHOTOS & STORIES
# ==============================================================================

class VisitorPhotoBase(SQLModel):
    campground_id: int = Field(foreign_key="campground.id", index=True)
    media_type: str = Field(default="photo")  # "photo" | "video"
    image_url: str
    caption: Optional[str] = Field(default="")
    ai_tags: str = Field(default="[]")       # JSON list of tags e.g. ["campfire", "stargazing"]
    ai_media_caption: Optional[str] = Field(default="")
    likes_count: int = Field(default=0)
    expires_at: Optional[int] = Field(default=None, index=True)  # Unix timestamp for 24h stories; None for permanent

class VisitorPhoto(VisitorPhotoBase, table=True):
    __tablename__ = "visitor_photos"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    user_username: str
    user_avatar: Optional[str] = Field(default=None)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    campground: Optional[Campground] = Relationship(back_populates="visitor_photos")
    user: Optional[User] = Relationship(back_populates="visitor_photos")
    comments: List["Comment"] = Relationship(back_populates="visitor_photo", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class VisitorPhotoLike(SQLModel, table=True):
    __tablename__ = "visitor_photo_likes"
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    photo_id: int = Field(foreign_key="visitor_photos.id", primary_key=True)

# ==============================================================================
# 4. COMMENTS & REVIEWS
# ==============================================================================

class CommentBase(SQLModel):
    text: str
    parent_comment_id: Optional[int] = Field(default=None, foreign_key="comment.id", index=True)
    rating: Optional[int] = Field(default=None)
    campground_id: Optional[int] = Field(default=None, foreign_key="campground.id")
    photo_id: Optional[int] = Field(default=None, foreign_key="visitor_photos.id", index=True)

class Comment(CommentBase, table=True):
    __tablename__ = "comment"
    id: Optional[int] = Field(default=None, primary_key=True)
    author_id: Optional[int] = Field(default=None, foreign_key="user.id")
    author_username: str = Field(default="")
    author_avatar: Optional[str] = Field(default=None)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    author: Optional[User] = Relationship(back_populates="comments")
    campground: Optional[Campground] = Relationship(back_populates="comments")
    visitor_photo: Optional[VisitorPhoto] = Relationship(back_populates="comments")

# ==============================================================================
# 5. SOCIAL & TRIPS
# ==============================================================================

class Wishlist(SQLModel, table=True):
    __tablename__ = "wishlist"
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    campground_id: int = Field(foreign_key="campground.id", primary_key=True)
    
    user: User = Relationship(back_populates="wishlist")
    campground: Campground = Relationship(back_populates="wishlisted_by")

class CheckInBase(SQLModel):
    campground_id: int = Field(foreign_key="campground.id")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CheckIn(CheckInBase, table=True):
    __tablename__ = "checkin"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    
    user: User = Relationship(back_populates="check_ins")
    campground: Campground = Relationship(back_populates="check_ins")

class TripBase(SQLModel):
    name: str

class Trip(TripBase, table=True):
    __tablename__ = "trip"
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id")
    
    owner: User = Relationship(back_populates="managed_trips")
    members: List["TripMember"] = Relationship(back_populates="trip")

class TripMember(SQLModel, table=True):
    __tablename__ = "tripmember"
    trip_id: int = Field(foreign_key="trip.id", primary_key=True)
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    
    trip: Trip = Relationship(back_populates="members")

class Vote(SQLModel, table=True):
    __tablename__ = "vote"
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    campground_id: int = Field(foreign_key="campground.id", primary_key=True)
    vote_type: int = Field(default=1) # 1 for like, -1 for dislike
    
    user: User = Relationship(back_populates="votes")
    campground: Campground = Relationship(back_populates="votes")

# ==============================================================================
# 6. VECTOR EMBEDDINGS & AI NAVIGATION
# ==============================================================================

class CampgroundEmbedding(SQLModel, table=True):
    __tablename__ = "campground_embeddings"
    id: Optional[int] = Field(default=None, primary_key=True)
    campground_id: int = Field(foreign_key="campground.id", index=True, unique=True)
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
