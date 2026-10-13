import secrets
from typing import Optional, List
from fastapi import APIRouter, Request, Response, Depends, HTTPException, Form, UploadFile, File, Query
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from models import User
from database import get_session
from dependencies import get_current_user, is_logged_in
from security import verify_password, get_password_hash, create_access_token
from schemas import UserCreate, UserLogin, UserOut, GoogleLoginRequest
from config import settings
from services.cloudinary_service import get_user_avatar_url, upload_user_avatar
from services.google_auth_service import verify_google_token

router = APIRouter(tags=["authentication"])

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False  # Set True when using HTTPS in production
    )

@router.get("/register")
async def register_page():
    return {"message": "Register endpoint. Send POST request with username and password."}

@router.post("/register")
async def register(
    request: Request,
    response: Response,
    user_data: Optional[UserCreate] = None,
    username: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    db: Session = Depends(get_session)
):
    # Support both JSON payload and FormData
    uname = user_data.username if user_data else username
    pwd = user_data.password if user_data else password

    if not uname or not pwd:
        # Check raw json body if neither caught it
        try:
            body = await request.json()
            uname = body.get("username")
            pwd = body.get("password")
        except Exception:
            pass

    if not uname or not pwd:
        raise HTTPException(status_code=400, detail="Username and password are required")

    existing_user = db.exec(select(User).where(User.username == uname)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    hashed_pwd = get_password_hash(pwd)
    new_user = User(username=uname, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate JWT Token
    token = create_access_token({"sub": str(new_user.id), "username": new_user.username})
    set_auth_cookie(response, token)
    
    # Backwards compatibility session
    if "session" in request.scope:
        request.session["user_id"] = new_user.id
        request.session["user"] = {"id": new_user.id, "username": new_user.username}

    avatar = get_user_avatar_url(new_user.username, new_user.avatar_url)
    return {
        "message": f"Welcome to YelpCamp {new_user.username}",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": new_user.id, "username": new_user.username, "avatar_url": avatar}
    }

@router.get("/login")
async def login_page():
    return {"message": "Login endpoint. Send POST request with username and password."}

@router.post("/login")
async def login(
    request: Request,
    response: Response,
    user_data: Optional[UserLogin] = None,
    username: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    db: Session = Depends(get_session)
):
    # Support both JSON payload and FormData
    uname = user_data.username if user_data else username
    pwd = user_data.password if user_data else password

    if not uname or not pwd:
        try:
            body = await request.json()
            uname = body.get("username")
            pwd = body.get("password")
        except Exception:
            pass

    if not uname or not pwd:
        raise HTTPException(status_code=400, detail="Username and password are required")

    user = db.exec(select(User).where(User.username == uname)).first()
    if not user or not verify_password(pwd, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Generate JWT Token
    token = create_access_token({"sub": str(user.id), "username": user.username})
    set_auth_cookie(response, token)

    avatar = get_user_avatar_url(user.username, user.avatar_url)

    # Backwards compatibility session
    if "session" in request.scope:
        request.session["user_id"] = user.id
        request.session["user"] = {"id": user.id, "username": user.username, "avatar_url": avatar}

    return {
        "message": "Successfully logged in!",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "avatar_url": avatar}
    }

@router.post("/auth/google")
@router.post("/google")
async def google_auth(
    request: Request,
    response: Response,
    payload: Optional[GoogleLoginRequest] = None,
    db: Session = Depends(get_session)
):
    token = None
    if payload and payload.token:
        token = payload.token
    else:
        try:
            body = await request.json()
            token = body.get("token") or body.get("credential")
        except Exception:
            pass

    if not token:
        raise HTTPException(status_code=400, detail="Google token/credential is required")

    # 1. Verify token with Google Identity Services API
    google_info = verify_google_token(token)
    email = google_info["email"]
    picture = google_info.get("picture")
    
    # 2. Derive base username from email (e.g. bhupendrarawat799 from bhupendrarawat799@gmail.com)
    base_username = email.split("@")[0].replace(".", "_").replace("+", "_").lower()
    
    # Check if user already exists
    user = db.exec(select(User).where(User.username == base_username)).first()
    
    if not user:
        # Create new user auto-provisioned with Google profile DP
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
        # User exists: update avatar if Google provides one
        if picture and (not user.avatar_url or "api.dicebear.com" in user.avatar_url):
            user.avatar_url = picture
            db.add(user)
            db.commit()
            db.refresh(user)

    # 3. Issue YelpCamp JWT token
    jwt_token = create_access_token({"sub": str(user.id), "username": user.username})
    set_auth_cookie(response, jwt_token)

    if "session" in request.scope:
        request.session["user_id"] = user.id
        request.session["user"] = {"id": user.id, "username": user.username, "avatar_url": user.avatar_url}

    avatar = get_user_avatar_url(user.username, user.avatar_url)
    return {
        "message": f"Successfully authenticated as {user.username} via Google",
        "access_token": jwt_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "avatar_url": avatar
        }
    }

@router.get("/me")
@router.get("/users/me")
async def get_me(current_user: Optional[User] = Depends(get_current_user)):
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
@router.get("/api/users", response_model=List[UserOut])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_session)
):
    users = db.exec(select(User).offset(skip).limit(limit)).all()
    return [
        UserOut(
            id=u.id,
            username=u.username,
            avatar_url=get_user_avatar_url(u.username, u.avatar_url)
        )
        for u in users
    ]

@router.get("/users/{user_id}", response_model=UserOut)
async def get_user_by_id(user_id: int, db: Session = Depends(get_session)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(
        id=user.id,
        username=user.username,
        avatar_url=get_user_avatar_url(user.username, user.avatar_url)
    )

@router.post("/me/avatar")
@router.post("/users/me/avatar")
async def update_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(is_logged_in),
    db: Session = Depends(get_session)
):
    import os
    from services.cloudinary_service import upload_user_avatar

    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Invalid file format. Allowed: JPG, PNG, WEBP, GIF.")

    cdn_url = upload_user_avatar(file.file, user_id=current_user.id)
    current_user.avatar_url = cdn_url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {
        "message": "Avatar updated successfully",
        "avatar_url": cdn_url,
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "avatar_url": current_user.avatar_url
        }
    }

@router.get("/logout")
@router.post("/logout")
async def logout(request: Request, response: Response):
    response.delete_cookie("access_token")
    if "session" in request.scope:
        request.session.clear()
    return {"message": "Logged you out!!"}

