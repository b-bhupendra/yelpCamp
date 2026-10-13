from typing import Optional
from fastapi import Request, Depends, HTTPException, status
from sqlmodel import Session
from database import get_session
from models import User, Campground, Comment
from security import decode_access_token

def get_current_user(request: Request, db: Session = Depends(get_session)) -> Optional[User]:
    # 1. First check HTTP-only cookie
    token = request.cookies.get("access_token")
    
    # 2. Check Authorization Bearer header fallback
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            
    # 3. Check legacy session fallback
    if not token and "session" in request.scope:
        legacy_id = request.session.get("user_id")
        if legacy_id:
            return db.get(User, legacy_id)
            
    if not token:
        return None
        
    payload = decode_access_token(token)
    if not payload:
        return None
        
    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        return None
        
    try:
        user = db.get(User, int(user_id))
        return user
    except (ValueError, TypeError):
        return None

def is_logged_in(current_user: Optional[User] = Depends(get_current_user)) -> User:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in."
        )
    return current_user

def check_campground_author(
    id: int, 
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
) -> Campground:
    campground = db.get(Campground, id)
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")
    if campground.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit/delete this campground"
        )
    return campground

def check_comment_author(
    id: int, 
    comment_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(is_logged_in)
) -> Comment:
    comment = db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit/delete this comment"
        )
    return comment
