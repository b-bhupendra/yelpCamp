import secrets
import os
from typing import Optional, List, Dict, Any
from sqlmodel import Session, select
from fastapi import HTTPException, UploadFile
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin, GoogleLoginRequest, UserOut
from app.core.security import verify_password, get_password_hash, create_access_token
from app.services.cloudinary_service import get_user_avatar_url, upload_user_avatar
from app.services.google_auth_service import verify_google_token
from app.core.config import settings

class AuthService:
    """Business logic for User Authentication, Registration, and Profile Management."""

    def register(self, db: Session, user_data: UserCreate) -> Dict[str, Any]:
        existing_user = db.exec(select(User).where(User.username == user_data.username)).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")

        hashed_pwd = get_password_hash(user_data.password)
        new_user = User(username=user_data.username, hashed_password=hashed_pwd)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        token = create_access_token({"sub": str(new_user.id), "username": new_user.username})
        return {
            "message": f"Welcome to Meadows {new_user.username}",
            "access_token": token,
            "token_type": "bearer",
            "user": new_user
        }

    def login(self, db: Session, user_data: UserLogin) -> Dict[str, Any]:
        user = db.exec(select(User).where(User.username == user_data.username)).first()
        if not user or not verify_password(user_data.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        token = create_access_token({"sub": str(user.id), "username": user.username})
        return {
            "message": "Successfully logged in!",
            "access_token": token,
            "token_type": "bearer",
            "user": user
        }

    def authenticate_google(self, db: Session, payload: GoogleLoginRequest) -> Dict[str, Any]:
        google_info = verify_google_token(payload.token)
        email = google_info["email"]
        picture = google_info.get("picture")

        base_username = email.split("@")[0].replace(".", "_").replace("+", "_").lower()
        user = db.exec(select(User).where(User.username == base_username)).first()

        if not user:
            rand_pwd = secrets.token_urlsafe(32)
            hashed_pwd = get_password_hash(rand_pwd)
            user = User(
                username=base_username,
                hashed_password=hashed_pwd,
                avatar_url=picture
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            if picture and (not user.avatar_url or "api.dicebear.com" in user.avatar_url):
                user.avatar_url = picture
                db.add(user)
                db.commit()
                db.refresh(user)

        jwt_token = create_access_token({"sub": str(user.id), "username": user.username})
        return {
            "message": f"Successfully authenticated as {user.username} via Google",
            "access_token": jwt_token,
            "token_type": "bearer",
            "user": user
        }

    def update_avatar(self, db: Session, user: User, file: UploadFile) -> Dict[str, Any]:
        allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
        ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
        if ext not in allowed_exts:
            raise HTTPException(status_code=400, detail="Invalid file format. Allowed: JPG, PNG, WEBP, GIF.")

        cdn_url = upload_user_avatar(file.file, user_id=user.id)
        user.avatar_url = cdn_url
        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "message": "Avatar updated successfully",
            "avatar_url": cdn_url,
            "user": {
                "id": user.id,
                "username": user.username,
                "avatar_url": user.avatar_url
            }
        }

    def get_users(self, db: Session, skip: int = 0, limit: int = 20) -> List[UserOut]:
        users = db.exec(select(User).offset(skip).limit(limit)).all()
        return [
            UserOut(
                id=u.id,
                username=u.username,
                avatar_url=get_user_avatar_url(u.username, u.avatar_url)
            )
            for u in users
        ]

    def get_user_by_id(self, db: Session, user_id: int) -> UserOut:
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserOut(
            id=user.id,
            username=user.username,
            avatar_url=get_user_avatar_url(user.username, user.avatar_url)
        )

auth_service = AuthService()

