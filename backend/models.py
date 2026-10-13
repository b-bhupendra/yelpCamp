from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    avatar_url: Optional[str] = Field(default=None)

    campgrounds: List["Campground"] = Relationship(back_populates="author")
    comments: List["Comment"] = Relationship(back_populates="author")
    wishlist: List["Wishlist"] = Relationship(back_populates="user")
    check_ins: List["CheckIn"] = Relationship(back_populates="user")
    managed_trips: List["Trip"] = Relationship(back_populates="owner")
    votes: List["Vote"] = Relationship(back_populates="user")

class Campground(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    price: str
    image: str
    description: str
    
    author_id: Optional[int] = Field(default=None, foreign_key="user.id")
    author_username: str
    
    author: Optional[User] = Relationship(back_populates="campgrounds")
    comments: List["Comment"] = Relationship(back_populates="campground", cascade_delete=True)
    wishlisted_by: List["Wishlist"] = Relationship(back_populates="campground")
    check_ins: List["CheckIn"] = Relationship(back_populates="campground")
    votes: List["Vote"] = Relationship(back_populates="campground")

class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    
    author_id: Optional[int] = Field(default=None, foreign_key="user.id")
    author_username: str
    author_avatar: Optional[str] = Field(default=None)
    
    campground_id: Optional[int] = Field(default=None, foreign_key="campground.id")
    
    author: Optional[User] = Relationship(back_populates="comments")
    campground: Optional[Campground] = Relationship(back_populates="comments")

class Wishlist(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    campground_id: int = Field(foreign_key="campground.id", primary_key=True)
    
    user: User = Relationship(back_populates="wishlist")
    campground: Campground = Relationship(back_populates="wishlisted_by")

class CheckIn(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    campground_id: int = Field(foreign_key="campground.id")
    timestamp: str # Simplified for now
    
    user: User = Relationship(back_populates="check_ins")
    campground: Campground = Relationship(back_populates="check_ins")

class Trip(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    owner_id: int = Field(foreign_key="user.id")
    
    owner: User = Relationship(back_populates="managed_trips")
    members: List["TripMember"] = Relationship(back_populates="trip")

class TripMember(SQLModel, table=True):
    trip_id: int = Field(foreign_key="trip.id", primary_key=True)
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    
    trip: Trip = Relationship(back_populates="members")

class Vote(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    campground_id: int = Field(foreign_key="campground.id", primary_key=True)
    vote_type: int = Field(default=1) # 1 for like, -1 for dislike
    
    user: User = Relationship(back_populates="votes")
    campground: Campground = Relationship(back_populates="votes")
