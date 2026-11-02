from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    campgrounds,
    comments,
    visitor_photos,
    social,
    vector_rag,
)

api_router = APIRouter()

api_router.include_router(auth.router, tags=["Auth"])
api_router.include_router(campgrounds.router, prefix="/campgrounds", tags=["Campgrounds"])
api_router.include_router(comments.router, prefix="/campgrounds/{id}/comments", tags=["Comments"])
api_router.include_router(social.router, tags=["Social"])
api_router.include_router(visitor_photos.router, tags=["Stories"])
api_router.include_router(vector_rag.router, tags=["Vector & RAG"])
api_router.include_router(vector_rag.agent_router, tags=["AI Agent"])

