from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel
from pydantic import model_validator, computed_field
from app.models.campground import CampgroundBase
from app.schemas.comment import CommentOut
from app.schemas.common import PaginatedResponse
from app.services.cloudinary_service import get_user_avatar_url
from app.services.image_validator import sanitize_campground_image, sanitize_gallery_images

class CampgroundCreate(CampgroundBase):
    gallery_images: List[str] = []
    amenities: List[str] = []
    rules: Optional[Dict[str, Any]] = None

class CampgroundUpdate(SQLModel):
    title: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    location_address: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    rules: Optional[Dict[str, Any]] = None

class CampgroundCard(CampgroundBase):
    id: int
    author_id: Optional[int] = None
    author_username: str = ""
    likes_count: int = 0
    dislikes_count: int = 0

    @computed_field
    @property
    def name(self) -> str:
        return self.title

class CampgroundOut(CampgroundBase):
    id: int
    gallery_images: List[str] = []
    amenities: List[str] = []
    rules: Dict[str, Any] = {}
    author_id: Optional[int] = None
    author_username: str = ""
    author_avatar: Optional[str] = None
    likes_count: int = 0
    dislikes_count: int = 0
    visitor_photos_count: int = 0
    is_wishlisted: bool = False
    user_vote: int = 0
    comments: List[CommentOut] = []
    comments_tree: List[CommentOut] = []

    @computed_field
    @property
    def name(self) -> str:
        return self.title

    @model_validator(mode="after")
    def sanitize_media_and_avatar(self) -> "CampgroundOut":
        self.image = sanitize_campground_image(self.image, self.id)
        self.gallery_images = sanitize_gallery_images(self.gallery_images, self.id)
        if self.author_username:
            self.author_avatar = get_user_avatar_url(self.author_username, self.author_avatar)
        return self

class PaginatedCampgrounds(PaginatedResponse[CampgroundCard]):
    @computed_field
    @property
    def campgrounds(self) -> List[CampgroundCard]:
        return self.items

    @computed_field
    @property
    def pages(self) -> int:
        return self.total_pages

class VoteResponse(SQLModel):
    message: str
    likes: int
    dislikes: int
    user_vote: int

class WishlistToggleResponse(SQLModel):
    message: str
    is_wishlisted: bool
    wishlist_count: int

class WishlistCampgroundItem(SQLModel):
    id: int
    title: str
    image: str
    price: Optional[float] = None
