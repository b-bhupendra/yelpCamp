from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# User Schemas
class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)

class UserLogin(BaseModel):
    username: str
    password: str

class GoogleLoginRequest(BaseModel):
    token: str

class UserOut(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class AvatarUpdateResponse(BaseModel):
    message: str = "Avatar updated successfully"
    avatar_url: str
    user: UserOut

# Comment Schemas
class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    parent_comment_id: Optional[int] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    photo_id: Optional[int] = None

class CommentOut(BaseModel):
    id: int
    text: str
    parent_comment_id: Optional[int] = None
    rating: Optional[int] = None
    photo_id: Optional[int] = None
    author_id: Optional[int] = None
    author_username: str
    author_avatar: Optional[str] = None
    campground_id: Optional[int] = None
    created_at: Optional[str] = None
    replies: List["CommentOut"] = []

# Visitor Photo & Story Schemas
class VisitorPhotoCreate(BaseModel):
    caption: Optional[str] = ""
    is_story: bool = False  # Permanent highlight by default; stays until user deletes it
    media_type: str = "photo"

class VisitorPhotoOut(BaseModel):
    id: int
    campground_id: Optional[int] = None
    user_id: int
    user_username: str
    user_avatar: Optional[str] = None
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

class VisitorStoryGroupOut(BaseModel):
    user_id: int
    user_username: str
    user_avatar: Optional[str] = None
    has_unseen: bool = True
    latest_timestamp: str
    photos: List[VisitorPhotoOut] = []

class VisitorPhotoLikeResponse(BaseModel):
    photo_id: int
    liked: bool
    likes_count: int

# Campground Schemas
class CampgroundCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    price: float = Field(default=50.0, ge=0.0)
    image: str = Field(default="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80")
    description: str = Field(default="")
    location: Optional[str] = ""
    location_address: Optional[str] = ""
    gallery_images: List[str] = []
    amenities: List[str] = []
    rules: Optional[Dict[str, Any]] = None

class CampgroundUpdate(BaseModel):
    title: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    location_address: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    rules: Optional[Dict[str, Any]] = None

class CampgroundOut(BaseModel):
    id: int
    title: str
    price: float
    image: str
    description: str
    location: Optional[str] = ""
    location_address: Optional[str] = ""
    gallery_images: List[str] = []
    amenities: List[str] = []
    rules: Dict[str, Any] = {}
    avg_rating: float = 0.0
    ai_media_caption: Optional[str] = ""
    community_summary: Optional[str] = ""
    author_id: Optional[int] = None
    author_username: str
    comments: List[CommentOut] = []
    visitor_photos_count: int = 0
    likes_count: Optional[int] = 0
    dislikes_count: Optional[int] = 0

class PaginatedCampgrounds(BaseModel):
    items: List[CampgroundOut]
    total: int
    page: int
    limit: int
    total_pages: int


# Social Schemas
class VoteResponse(BaseModel):
    message: str
    likes: int
    dislikes: int
    user_vote: int

class WishlistToggleResponse(BaseModel):
    message: str
    is_wishlisted: bool
    wishlist_count: int

class WishlistCampgroundItem(BaseModel):
    id: int
    title: str
    image: str
    price: Optional[float] = None

class DashboardResponse(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    total_posts: int
    total_likes: int
    wishlist_count: int
    wishlist: List[WishlistCampgroundItem]
    my_campgrounds: Optional[List[Dict[str, Any]]] = []

class CheckInCreate(BaseModel):
    timestamp: Optional[str] = None

class CheckInOut(BaseModel):
    id: int
    user_id: int
    username: str
    campground_id: int
    timestamp: str

class TripCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

class TripMemberAdd(BaseModel):
    user_id: int

class TripOut(BaseModel):
    id: int
    name: str
    owner_id: int
    member_ids: List[int] = []

class FileUploadResponse(BaseModel):
    url: str
    filename: str

class AgentInteractRequest(BaseModel):
    user_message: str = Field(..., min_length=1, description="Adventurer's prompt or question")
    ui_context: Optional[Dict[str, Any]] = Field(default=None, description="Active route, campground_id, modal states")
    available_actions: Optional[List[Dict[str, Any]]] = Field(default=None, description="Dynamic React callbacks executable by agent")
    chat_history: Optional[List[Dict[str, str]]] = Field(default=None, description="Previous message turns")

class AgentInteractResponse(BaseModel):
    reply: str
    campsite_results: List[Dict[str, Any]] = Field(default_factory=list)
    story_results: List[Dict[str, Any]] = Field(default_factory=list)
    trigger_action_id: Optional[str] = None
    action_args: Optional[Dict[str, Any]] = None
    ui_highlight: Optional[Dict[str, Any]] = None
