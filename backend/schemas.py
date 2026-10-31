import json
from typing import Optional, List, Dict, Any, Generic, TypeVar
from sqlmodel import SQLModel, Field
from pydantic import BaseModel, model_validator, field_validator, computed_field, ConfigDict
from models import (
    UserBase, CampgroundBase, CommentBase, VisitorPhotoBase,
    CheckInBase, TripBase, UINavigationBase
)
from services.cloudinary_service import get_user_avatar_url
from services.image_validator import sanitize_campground_image, sanitize_gallery_images

T = TypeVar("T")

class PaginatedResponse(SQLModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_prev: bool

# ==============================================================================
# 1. USER SCHEMAS
# ==============================================================================

class UserCreate(SQLModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)

class UserLogin(SQLModel):
    username: str
    password: str

class GoogleLoginRequest(SQLModel):
    token: str

class UserOut(UserBase):
    id: int

    @model_validator(mode="after")
    def ensure_avatar(self) -> "UserOut":
        self.avatar_url = get_user_avatar_url(self.username, self.avatar_url)
        return self

class TokenResponse(SQLModel):
    message: Optional[str] = "Successfully authenticated"
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class AvatarUpdateResponse(SQLModel):
    message: str = "Avatar updated successfully"
    avatar_url: str
    user: UserOut

# ==============================================================================
# 2. COMMENT SCHEMAS
# ==============================================================================

class CommentCreate(SQLModel):
    text: str = Field(min_length=1, max_length=1000)
    parent_comment_id: Optional[int] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    photo_id: Optional[int] = None

class CommentOut(CommentBase):
    id: int
    author_id: Optional[int] = None
    author_username: str = ""
    author_avatar: Optional[str] = None
    created_at: Optional[str] = None
    replies: List["CommentOut"] = []

# ==============================================================================
# 3. VISITOR PHOTOS & STORIES SCHEMAS
# ==============================================================================

class VisitorPhotoCreate(SQLModel):
    caption: Optional[str] = ""
    is_story: bool = False
    media_type: str = "photo"

class VisitorPhotoOut(SQLModel):
    id: int
    campground_id: Optional[int] = None
    campground_title: Optional[str] = ""
    user_id: int
    user_username: str
    username: Optional[str] = None  # Frontend compatibility alias
    user_avatar: Optional[str] = None
    avatar_url: Optional[str] = None  # Frontend compatibility alias
    media_type: str = "photo"
    image_url: str
    caption: Optional[str] = ""
    ai_tags: List[str] = []
    ai_media_caption: Optional[str] = ""
    likes_count: int = 0
    comments_count: int = 0
    created_at: str
    expires_at: Optional[int] = None
    liked_by_me: bool = False
    comments: List[CommentOut] = []

    @field_validator("ai_tags", mode="before")
    @classmethod
    def parse_ai_tags(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    @model_validator(mode="after")
    def sanitize_and_aliases(self) -> "VisitorPhotoOut":
        if not self.username:
            self.username = self.user_username
        self.avatar_url = get_user_avatar_url(self.user_username, self.user_avatar or self.avatar_url)
        self.user_avatar = self.avatar_url
        self.image_url = sanitize_campground_image(self.image_url, self.id)
        return self

class VisitorStoryGroupOut(SQLModel):
    user_id: int
    user_username: str
    username: Optional[str] = None  # Frontend compatibility alias
    user_avatar: Optional[str] = None
    avatar_url: Optional[str] = None  # Frontend compatibility alias
    has_unseen: bool = True
    latest_timestamp: str
    photos: List[VisitorPhotoOut] = []

    @model_validator(mode="after")
    def populate_aliases(self):
        if not self.username:
            self.username = self.user_username
        if not self.avatar_url:
            self.avatar_url = self.user_avatar
        return self

class VisitorPhotoLikeResponse(SQLModel):
    photo_id: int
    liked: bool
    likes_count: int

# ==============================================================================
# 4. CAMPGROUND SCHEMAS
# ==============================================================================

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

    @model_validator(mode="after")
    def sanitize_media_and_avatar(self) -> "CampgroundOut":
        if self.title and not self.name:
            self.name = self.title
        elif self.name and not self.title:
            self.title = self.name
        self.image = sanitize_campground_image(self.image, self.id)
        self.gallery_images = sanitize_gallery_images(self.gallery_images, self.id)
        self.author_avatar = get_user_avatar_url(self.author_username, self.author_avatar)
        return self

class PaginatedCampgrounds(PaginatedResponse[CampgroundCard]):
    pass

# ==============================================================================
# 5. SOCIAL & DASHBOARD SCHEMAS
# ==============================================================================

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

class DashboardResponse(SQLModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    total_posts: int
    total_likes: int
    wishlist_count: int
    wishlist: List[WishlistCampgroundItem]
    my_campgrounds: Optional[List[Dict[str, Any]]] = []

class CheckInCreate(SQLModel):
    timestamp: Optional[str] = None

class CheckInOut(SQLModel):
    id: int
    user_id: int
    username: str
    campground_id: int
    timestamp: str

class TripCreate(TripBase):
    pass

class TripMemberAdd(SQLModel):
    user_id: int

class TripOut(TripBase):
    id: int
    owner_id: int
    member_ids: List[int] = []

class FileUploadResponse(SQLModel):
    url: str
    filename: str

# ==============================================================================
# 6. AI COPILOT & NAVIGATION SCHEMAS
# ==============================================================================

class UINavItem(UINavigationBase):
    parameters: Optional[Dict[str, Any]] = None

class UINavSyncRequest(SQLModel):
    items: List[UINavItem]

class AgentInteractRequest(SQLModel):
    user_message: str = Field(..., min_length=1, description="Adventurer's prompt or question")
    ui_context: Optional[Dict[str, Any]] = Field(default=None, description="Active route, campground_id, modal states")
    available_actions: Optional[List[Dict[str, Any]]] = Field(default=None, description="Dynamic React callbacks executable by agent")
    chat_history: Optional[List[Dict[str, str]]] = Field(default=None, description="Previous message turns")

class AgentInteractResponse(SQLModel):
    reply: str
    campsite_results: List[Dict[str, Any]] = Field(default_factory=list)
    story_results: List[Dict[str, Any]] = Field(default_factory=list)
    trigger_action_id: Optional[str] = None
    action_args: Optional[Dict[str, Any]] = None
    ui_highlight: Optional[Dict[str, Any]] = None
