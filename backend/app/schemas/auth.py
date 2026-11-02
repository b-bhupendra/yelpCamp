from typing import Optional
from sqlmodel import SQLModel, Field
from pydantic import model_validator
from app.models.user import UserBase
from app.services.cloudinary_service import get_user_avatar_url

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
