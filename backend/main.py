import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from config import settings
from database import create_db_and_tables
from routers import auth, campgrounds, comments, social, vector_rag

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

# Session middleware for backwards-compatibility support
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

# CORS middleware configured for React frontend communication with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Include Routers
app.include_router(auth.router)
app.include_router(campgrounds.router, prefix="/index")
app.include_router(comments.router, prefix="/index/{id}/comments")
# Mount social router at both /{id}/social (for campground context) and /social
app.include_router(social.router, prefix="/index/{id}/social")
app.include_router(social.router, prefix="/social")
app.include_router(vector_rag.router, prefix="/api")
app.include_router(vector_rag.router)

@app.get("/")
async def root():
    return {
        "message": "YelpCamp Production API is running",
        "version": "2.0.0",
        "status": "healthy",
        "docs": "/docs"
    }
