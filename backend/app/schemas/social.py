from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel
from app.models.social import TripBase
from app.schemas.campground import WishlistCampgroundItem

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

