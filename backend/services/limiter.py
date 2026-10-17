import logging
from typing import Optional
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from config import settings
from security import decode_access_token

logger = logging.getLogger(__name__)

def get_client_ip(request: Request) -> str:
    """
    Extract client IP address considering reverse proxies, Cloudflare, and load balancers.
    """
    # Cloudflare connecting IP
    cf_connecting_ip = request.headers.get("CF-Connecting-IP")
    if cf_connecting_ip:
        return cf_connecting_ip.strip()

    # Standard X-Forwarded-For header (first IP is the original client)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        parts = [ip.strip() for ip in forwarded_for.split(",") if ip.strip()]
        if parts:
            return parts[0]

    # X-Real-IP fallback (commonly set by Nginx)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Direct client connection fallback
    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"

def get_rate_limit_key(request: Request) -> str:
    """
    Dual-strategy key extractor:
    1. If user is authenticated via cookie or Authorization header, limit by user ID.
    2. If user is anonymous, limit by proxy-aware IP address.
    """
    token: Optional[str] = request.cookies.get("access_token")

    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub") or payload.get("user_id")
                if user_id:
                    return f"user:{user_id}"
        except Exception:
            pass

    client_ip = get_client_ip(request)
    return f"ip:{client_ip}"

# Initialize the global Limiter instance
limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=[settings.RATE_LIMIT_DEFAULT] if settings.RATE_LIMIT_DEFAULT else None,
    storage_uri=settings.REDIS_URL or "memory://",
    enabled=settings.RATE_LIMIT_ENABLED,
    headers_enabled=True,
)

async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom handler for RateLimitExceeded exceptions. Returns standard HTTP 429 response
    with informative error message, retry_after information, and headers for client consumption.
    """
    limit_text = getattr(exc, "detail", "") or "Limit reached"
    if limit_text.startswith("Rate limit exceeded: "):
        limit_text = limit_text[len("Rate limit exceeded: "):]
    
    # Calculate retry-after if available from the limit object
    retry_after: Optional[int] = None
    if hasattr(exc, "retry_after"):
        retry_after = exc.retry_after

    headers = {}
    if retry_after is not None:
        headers["Retry-After"] = str(retry_after)

    client_key = get_rate_limit_key(request)
    logger.warning(f"Rate limit exceeded for [{client_key}] on endpoint [{request.url.path}]: {limit_text}")

    return JSONResponse(
        status_code=429,
        content={
            "error": "Too Many Requests",
            "detail": f"Rate limit reached ({limit_text}). Please slow down and try again.",
            "status_code": 429,
            "retry_after": retry_after,
        },
        headers=headers
    )
