from typing import Optional, List
from sqlmodel import SQLModel, Field
from pydantic import model_validator
from app.models.comment import CommentBase
from app.services.cloudinary_service import get_user_avatar_url

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

    @model_validator(mode="after")
    def populate_avatar(self) -> "CommentOut":
        if self.author_username:
            self.author_avatar = get_user_avatar_url(self.author_username, self.author_avatar)
        return self
