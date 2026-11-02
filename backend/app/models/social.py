from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.campground import Campground

class Wishlist(SQLModel, table=True):
    __tablename__ = "wishlist"
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    )
    campground_id: int = Field(
        sa_column=Column(Integer, ForeignKey("campground.id", ondelete="CASCADE"), primary_key=True, index=True)
    )

    user: Optional["User"] = Relationship(back_populates="wishlists")
    campground: Optional["Campground"] = Relationship(back_populates="wishlisted_by")

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

    user: Optional["User"] = Relationship(back_populates="check_ins")
    campground: Optional["Campground"] = Relationship(back_populates="check_ins")

class TripBase(SQLModel):
    name: str = Field(min_length=1, max_length=100)

class Trip(TripBase, table=True):
    __tablename__ = "trip"
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )

    owner: Optional["User"] = Relationship(back_populates="managed_trips")
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

