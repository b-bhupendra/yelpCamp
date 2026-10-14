import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlmodel import Session, select, func
from database import get_session
from models import Campground, CampgroundEmbedding, Comment
from services.rag_service import rag_service
from services.multimodal_embedder import multimodal_embedder
from services.vector_store import vector_store
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["Vector RAG & AI Chatbot"])

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Natural language semantic search query")
    limit: Optional[int] = Field(default=6, ge=1, le=20)
    min_score: Optional[float] = Field(default=0.25, ge=0.0, le=1.0)

class ChatMessage(BaseModel):
    role: str = Field(..., description="user or model")
    content: str = Field(..., min_length=1)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User's chat message")
    conversation_history: Optional[List[ChatMessage]] = Field(default=[])

@router.post("/search")
def semantic_vector_search(req: SearchRequest, session: Session = Depends(get_session)):
    """Search campgrounds using high-dimensional vector similarity."""
    try:
        results = rag_service.semantic_search(
            session=session,
            query=req.query,
            limit=req.limit,
            min_score=req.min_score
        )
        return {
            "query": req.query,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        logger.error(f"Error during semantic vector search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
def chat_with_aurora_guide(req: ChatRequest, session: Session = Depends(get_session)):
    """Interactive RAG chatbot powered by Google Gemini and Turso Vector."""
    try:
        history_dicts = [{"role": m.role, "content": m.content} for m in req.conversation_history]
        response = rag_service.chat_rag(
            session=session,
            message=req.message,
            conversation_history=history_dicts
        )
        return response
    except Exception as e:
        logger.error(f"Error during RAG chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
def get_rag_status(session: Session = Depends(get_session)):
    """Check health, index status, and Gemini API readiness."""
    total_camps = session.exec(select(func.count(Campground.id))).one()
    total_indexed = session.exec(select(func.count(CampgroundEmbedding.id))).one()
    
    has_api_key = bool(settings.GEMINI_API_KEY)
    client_ready = multimodal_embedder.client is not None

    return {
        "status": "ready" if total_indexed > 0 else "needs_indexing",
        "total_campgrounds": total_camps,
        "indexed_campgrounds": total_indexed,
        "embedding_model": settings.EMBEDDING_MODEL,
        "chat_model": settings.CHAT_MODEL,
        "has_gemini_key": has_api_key,
        "client_active": client_ready
    }

def _index_all_campgrounds_task(session_factory):
    with session_factory() as session:
        camps = session.exec(select(Campground)).all()
        for camp in camps:
            comments = session.exec(select(Comment.text).where(Comment.campground_id == camp.id)).all()
            summary, emb = multimodal_embedder.build_multimodal_profile(
                name=camp.name,
                description=camp.description,
                price=camp.price,
                image_url=camp.image,
                comments=list(comments)
            )
            vector_store.save_embedding(
                session=session,
                campground_id=camp.id,
                embedding=emb,
                content_summary=summary,
                has_image=True
            )

@router.post("/index-all")
def trigger_bulk_indexing(background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    """Trigger background indexing for all existing campgrounds in database."""
    camps = session.exec(select(Campground)).all()
    count = 0
    for camp in camps:
        comments = session.exec(select(Comment.text).where(Comment.campground_id == camp.id)).all()
        summary, emb = multimodal_embedder.build_multimodal_profile(
            name=camp.name,
            description=camp.description,
            price=camp.price,
            image_url=camp.image,
            comments=list(comments)
        )
        vector_store.save_embedding(
            session=session,
            campground_id=camp.id,
            embedding=emb,
            content_summary=summary,
            has_image=True
        )
        count += 1

    return {"message": f"Successfully indexed {count} campgrounds into vector store."}
