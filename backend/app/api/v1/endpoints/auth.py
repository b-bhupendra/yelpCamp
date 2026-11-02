from typing import Optional, List
from fastapi import APIRouter, Request, Response, Depends, HTTPException, UploadFile, File, Query
from sqlmodel import Session
from app.api.deps import get_db, get_current_user, is_logged_in
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin, UserOut, GoogleLoginRequest, TokenResponse, AvatarUpdateResponse
from app.core.config import settings
from app.services.auth_service import auth_service
from app.services.limiter import limiter
from app.services.cloudinary_service import get_user_avatar_url

router = APIRouter(tags=["authentication"])

def set_auth_cookie(response: Response, token: str):
    is_prod = (getattr(settings, "ENVIRONMENT", "").lower() == "production")
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="none" if is_prod else "lax",
        secure=is_prod
    )

@router.post("/register", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH_REGISTER)
def register(
    request: Request,
    response: Response,
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    result = auth_service.register(db, user_data)
    set_auth_cookie(response, result["access_token"])
    return result

@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH_LOGIN)
def login(
    request: Request,
    response: Response,
    user_data: UserLogin,
    db: Session = Depends(get_db)
):
    result = auth_service.login(db, user_data)
    set_auth_cookie(response, result["access_token"])
    return result

@router.post("/auth/google", response_model=TokenResponse)
@limiter.limit("10/minute")
def google_auth(
    request: Request,
    response: Response,
    payload: GoogleLoginRequest,
    db: Session = Depends(get_db)
):
    result = auth_service.authenticate_google(db, payload)
    set_auth_cookie(response, result["access_token"])
    return result

@router.get("/me")
def get_me(current_user: Optional[User] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "avatar_url": get_user_avatar_url(current_user.username, current_user.avatar_url)
        }
    }

@router.get("/users", response_model=List[UserOut])
def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return auth_service.get_users(db, skip=skip, limit=limit)

@router.get("/users/{user_id}", response_model=UserOut)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    return auth_service.get_user_by_id(db, user_id)

@router.post("/me/avatar", response_model=AvatarUpdateResponse)
@limiter.limit("10/minute")
def update_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(is_logged_in),
    db: Session = Depends(get_db)
):
    return auth_service.update_avatar(db, current_user, file)

@router.post("/logout")
def logout(response: Response):
    is_prod = (getattr(settings, "ENVIRONMENT", "").lower() == "production")
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="none" if is_prod else "lax",
        secure=is_prod
    )
    return {"message": "Logged you out successfully"}
