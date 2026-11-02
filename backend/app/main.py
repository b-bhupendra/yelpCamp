import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.core.config import settings
from app.core.database import apply_migrations
from app.services.limiter import limiter, rate_limit_exceeded_handler
from app.api.v1.api import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Apply Alembic database migrations and extensions
    try:
        apply_migrations()
    except Exception as e:
        print("Database schema migration notice:", e)

    # Ensure upload directory exists
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    except Exception:
        pass
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-performance, production-ready REST API for Meadows with JWT auth, 3D assets, and community interactions.",
    version="2.0.0",
    lifespan=lifespan
)

# Attach rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# CORS middleware configured for React frontend communication with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SlowAPI rate limiting middleware
app.add_middleware(SlowAPIMiddleware)

# Cloud Run / Proxy headers middleware (ensures X-Forwarded-Proto https is respected)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# Static file serving for user uploaded images (guarded for serverless)
upload_dir = settings.UPLOAD_DIR
if not os.path.exists(upload_dir):
    try:
        os.makedirs(upload_dir, exist_ok=True)
    except Exception:
        upload_dir = "/tmp/uploads" if os.name != "nt" else "uploads"
        try:
            os.makedirs(upload_dir, exist_ok=True)
        except Exception:
            pass

if os.path.exists(upload_dir):
    app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

# Exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

# Canonical REST API v1 router
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "message": "Meadows Production API is running",
        "version": "2.0.0",
        "status": "healthy",
        "docs": "/docs"
    }

