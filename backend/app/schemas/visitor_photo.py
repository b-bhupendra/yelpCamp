import json
from typing import Optional, List
from pydantic import BaseModel, model_validator, field_validator, computed_field
from app.schemas.comment import CommentOut
from app.services.cloudinary_service import get_user_avatar_url
from app.services.image_validator import sanitize_campground_image

class VisitorPhotoCreate(BaseModel):
    caption: Optional[str] = ""
    is_story: bool = False
    media_type: str = "photo"

class VisitorPhotoOut(BaseModel):
    id: int
    campground_id: Optional[int] = None
    campground_title: Optional[str] = ""
    user_id: int
    user_username: str = ""
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
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        return v or []

    @model_validator(mode="after")
    def sanitize_and_aliases(self) -> "VisitorPhotoOut":
        uname = self.user_username or self.username or ""
        self.user_username = uname
        self.username = uname
        avatar = get_user_avatar_url(uname, self.user_avatar or self.avatar_url)
        self.avatar_url = avatar
        self.user_avatar = avatar
        self.image_url = sanitize_campground_image(self.image_url, self.id)
        return self

class VisitorStoryGroupOut(BaseModel):
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

class VisitorPhotoLikeResponse(BaseModel):
    photo_id: int
    liked: bool
    likes_count: int

    @computed_field
    @property
    def liked_by_me(self) -> bool:
        return self.liked
