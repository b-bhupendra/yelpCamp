from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.campground import Campground, Vote
    from app.models.comment import Comment
    from app.models.visitor_photo import VisitorPhoto
    from app.models.social import Wishlist, CheckIn, Trip

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

