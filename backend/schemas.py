from typing import Optional, List
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

class CommentOut(BaseModel):
    id: int
    text: str
    author_id: Optional[int] = None
    author_username: str
    author_avatar: Optional[str] = None
    campground_id: Optional[int] = None

# Campground Schemas
class CampgroundCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: str = Field(default="50")
    image: str = Field(default="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80")
    description: str = Field(default="")

class CampgroundUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[str] = None
    image: Optional[str] = None
    description: Optional[str] = None

class CampgroundOut(BaseModel):
    id: int
    name: str
    price: str
    image: str
    description: str
    author_id: Optional[int] = None
    author_username: str
    comments: List[CommentOut] = []
    likes_count: Optional[int] = 0
    dislikes_count: Optional[int] = 0

class PaginatedCampgrounds(BaseModel):
    data: List[CampgroundOut]
    total: int
    page: int
    limit: int
    pages: int

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
    name: str
    image: str
    price: Optional[str] = None

class DashboardResponse(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    total_posts: int
    total_likes: int
    wishlist_count: int
    wishlist: List[WishlistCampgroundItem]

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
