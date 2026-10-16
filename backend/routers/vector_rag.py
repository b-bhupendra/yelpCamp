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

from schemas import AgentInteractRequest, AgentInteractResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["Vector RAG & AI Chatbot"])
agent_router = APIRouter(prefix="/agent", tags=["AI Copilot Agent"])

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

@agent_router.post("/interact", response_model=AgentInteractResponse)
@router.post("/interact", response_model=AgentInteractResponse)
async def interact_with_aurora_agent(req: AgentInteractRequest, session: Session = Depends(get_session)):
    """
    Main AI Co-Pilot endpoint supporting:
    - Dynamic UI context injection (route, campground ID, form state)
    - Available client actions (share modal, auto-fill, etc.)
    - 3-Stage Hybrid campsite search (Vector + BM25 + Cross-Encoder)
    - UI Navigation guidance with strict cutoff
    """
    try:
        return await rag_service.interact_with_agent(
            session=session,
            user_message=req.user_message,
            ui_context=req.ui_context,
            available_actions=req.available_actions,
            chat_history=req.chat_history,
        )
    except Exception as e:
        logger.error(f"Error during agent interaction: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
def get_rag_status(session: Session = Depends(get_session)):
    """Check health, index status, and Gemini API readiness."""
    total_camps = session.exec(select(func.count(Campground.id))).one()
    total_indexed = session.exec(select(func.count(CampgroundEmbedding.id))).one()
    matching_indexed = session.exec(
        select(func.count(CampgroundEmbedding.id)).where(CampgroundEmbedding.embedding_dim == multimodal_embedder.dimension)
    ).one()
    
    has_api_key = bool(settings.GEMINI_API_KEY)
    client_ready = multimodal_embedder.client is not None

    return {
        "status": "ready" if matching_indexed > 0 else "needs_indexing",
        "total_campgrounds": total_camps,
        "indexed_campgrounds": total_indexed,
        "synchronized_768_embeddings": matching_indexed,
        "legacy_dimension_count": total_indexed - matching_indexed,
        "embedding_model": settings.EMBEDDING_MODEL,
        "embedding_dimension": multimodal_embedder.dimension,
        "chat_model": settings.CHAT_MODEL,
        "has_gemini_key": has_api_key,
        "client_active": client_ready,
        "in_memory_cached_count": len(vector_store._cache_ids)
    }

@router.post("/index-all")
def trigger_bulk_indexing(session: Session = Depends(get_session)):
    """Fast batched re-indexing for campgrounds into vector store with 768-dim embeddings."""
    camps = session.exec(select(Campground)).all()
    if not camps:
        return {"message": "No campgrounds found to index.", "count": 0}

    BATCH_SIZE = 30
    indexed_count = 0

    for i in range(0, len(camps), BATCH_SIZE):
        batch = camps[i:i + BATCH_SIZE]
        batch_profiles = []

        for camp in batch:
            comments = session.exec(
                select(Comment.text).where(Comment.campground_id == camp.id)
            ).all()

            parts = [
                f"Campsite: {camp.name}",
                f"Price: ${camp.price}/night",
                f"Description: {camp.description}"
            ]
            if comments:
                parts.append(f"Guest Tips & Reviews: {' | '.join(list(comments)[:5])}")
            profile_text = "\n".join(parts)
            batch_profiles.append((camp.id, profile_text))

        texts = [p[1] for p in batch_profiles]
        embeddings = multimodal_embedder.embed_batch(texts)

        for (camp_id, profile_text), emb in zip(batch_profiles, embeddings):
            vector_store.save_embedding(
                session=session,
                campground_id=camp_id,
                embedding=emb,
                content_summary=profile_text,
                has_image=True
            )
            indexed_count += 1

    vector_store.invalidate_cache()
    return {"message": f"Successfully indexed {indexed_count} campgrounds with {multimodal_embedder.dimension}-dim vectors."}
