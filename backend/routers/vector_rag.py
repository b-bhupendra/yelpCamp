import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select, func
from database import get_session
from models import Campground, CampgroundEmbedding, Comment
from services.rag_service import rag_service
from services.multimodal_embedder import multimodal_embedder
from services.vector_store import vector_store
from services.limiter import limiter
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
@limiter.limit(settings.RATE_LIMIT_AI_SEARCH)
def semantic_vector_search(request: Request, req: SearchRequest, session: Session = Depends(get_session)):
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
@limiter.limit(settings.RATE_LIMIT_AI_CHAT)
def chat_with_aurora_guide(request: Request, req: ChatRequest, session: Session = Depends(get_session)):
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
@limiter.limit(settings.RATE_LIMIT_AI_INTERACT)
async def interact_with_aurora_agent(request: Request, req: AgentInteractRequest, session: Session = Depends(get_session)):
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

class UINavItem(BaseModel):
    id: str
    feature_name: str
    route: str
    dom_selector: str
    description: str
    risk_level: Optional[str] = "SAFE"
    parameters: Optional[Dict[str, Any]] = None

class UINavSyncRequest(BaseModel):
    items: List[UINavItem]

@agent_router.post("/sync-ui")
@router.post("/sync-ui")
@limiter.limit("15/minute")
def sync_ui_navigation_manifest(request: Request, payload: UINavSyncRequest):
    """
    Zero-config FDE endpoint: receives the frontend's UI_CAPABILITY_MANIFEST,
    batch-embeds all feature descriptions with 768-d vectors, and upserts them
    into Turso Cloud (ui_navigation) and the in-memory VectorStore cache.
    """
    import sqlite3
    import json
    from turso_engine import execute_turso_raw

    if not payload.items:
        return {"status": "noop", "synced": 0}

    texts = [f"{item.feature_name}: {item.description}" for item in payload.items]
    embeddings = multimodal_embedder.embed_batch(texts)

    # 1. Update in-memory cache immediately
    for item, vec in zip(payload.items, embeddings):
        vector_store._ui_nav_cache[item.id] = {
            "feature_name": item.feature_name,
            "route": item.route,
            "dom_selector": item.dom_selector,
            "description": item.description,
            "risk_level": item.risk_level or "SAFE",
            "parameters": item.parameters or {},
            "embedding": vec,
        }

    # 2. Upsert into Local SQLite
    try:
        con = sqlite3.connect("database.db")
        cur = con.cursor()
        for item in payload.items:
            cur.execute(
                """
                INSERT OR REPLACE INTO ui_navigation (id, feature_name, route, dom_selector, description)
                VALUES (?, ?, ?, ?, ?)
                """,
                (item.id, item.feature_name, item.route, item.dom_selector, item.description),
            )
        con.commit()
        con.close()
    except Exception as e:
        logger.debug(f"Local SQLite UI sync notice: {e}")

    # 3. Upsert into Turso Cloud with DiskANN vector32()
    if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
        for item, vec in zip(payload.items, embeddings):
            try:
                execute_turso_raw(
                    """
                    INSERT INTO ui_navigation (id, feature_name, route, dom_selector, description, embedding)
                    VALUES (?, ?, ?, ?, ?, vector32(?))
                    ON CONFLICT(id) DO UPDATE SET
                        feature_name = excluded.feature_name,
                        route = excluded.route,
                        dom_selector = excluded.dom_selector,
                        description = excluded.description,
                        embedding = excluded.embedding
                    """,
                    [item.id, item.feature_name, item.route, item.dom_selector, item.description, json.dumps(vec)],
                )
            except Exception as e:
                logger.warning(f"Turso UI sync notice for {item.id}: {e}")

    return {"status": "synced", "synced_count": len(payload.items)}

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
@limiter.limit("3/minute")
def trigger_bulk_indexing(request: Request, session: Session = Depends(get_session)):
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
