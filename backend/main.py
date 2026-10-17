import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from database import create_db_and_tables
from routers import auth, campgrounds, comments, social, vector_rag, visitor_photos
from services.limiter import limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist
    try:
        create_db_and_tables()
    except Exception as e:
        print("Database schema init notice:", e)
    # Ensure upload directory exists
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    except Exception:
        pass
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-performance, production-ready REST API for YelpCamp with JWT auth, 3D assets, and community interactions.",
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

# SlowAPI rate limiting middleware (ensures baseline limits across routes)
app.add_middleware(SlowAPIMiddleware)

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

# Modern Canonical REST Routers
app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(auth.router, tags=["Auth Root"])
app.include_router(campgrounds.router, prefix="/api/campgrounds", tags=["Campgrounds"])
app.include_router(campgrounds.router, prefix="/campgrounds", tags=["Campgrounds Direct"])
app.include_router(comments.router, prefix="/api/campgrounds/{id}/comments", tags=["Comments"])
app.include_router(comments.router, prefix="/campgrounds/{id}/comments", tags=["Comments Direct"])
app.include_router(social.router, prefix="/api", tags=["Social"])
app.include_router(social.router, tags=["Social Direct"])
app.include_router(visitor_photos.router, prefix="/api", tags=["Stories & Photos"])
app.include_router(visitor_photos.router, tags=["Stories Direct"])
app.include_router(vector_rag.router, prefix="/api/rag", tags=["Vector & RAG"])
app.include_router(vector_rag.router, prefix="/api", tags=["Vector & RAG API"])
app.include_router(vector_rag.agent_router, prefix="/api/agent", tags=["AI Agent"])
app.include_router(vector_rag.agent_router, prefix="/api", tags=["AI Agent API"])


@app.get("/")
async def root():
    return {
        "message": "YelpCamp Production API is running",
        "version": "2.0.0",
        "status": "healthy",
        "docs": "/docs"
    }
