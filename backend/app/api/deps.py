from typing import Generator, Optional
from fastapi import Request, Depends, HTTPException, status
from sqlmodel import Session
from app.core.database import get_session
from app.models.user import User
from app.models.campground import Campground
from app.models.comment import Comment
from app.core.security import decode_access_token

def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session for requests, supporting dependency_overrides in tests."""
    yield from get_session()

def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """
    Extract current user from either HTTP-only cookie or Authorization Bearer header.
    Returns None if not authenticated or invalid.
    """
    token = request.cookies.get("access_token")

    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

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
    """Enforce authenticated session; raises 401 Unauthorized if not logged in."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in."
        )
    return current_user

def check_campground_author(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_logged_in)
) -> Campground:
    """Verify campsite exists and current user is the author."""
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
    db: Session = Depends(get_db),
    current_user: User = Depends(is_logged_in)
) -> Comment:
    """Verify comment exists and current user is the author."""
    comment = db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit/delete this comment"
        )
    return comment

