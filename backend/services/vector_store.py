import json
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sqlmodel import Session, select
from models import Campground, CampgroundEmbedding, Comment
from services.multimodal_embedder import multimodal_embedder

logger = logging.getLogger(__name__)

class VectorStoreService:
    """
    Vector Store management for Turso/SQLite.
    Stores and retrieves high-dimensional embeddings for YelpCamp campgrounds.
    Uses high-speed vectorized NumPy cosine distance with universal support
    for both Turso Cloud and local SQLite.
    """
    def __init__(self):
        pass

    def save_embedding(
        self,
        session: Session,
        campground_id: int,
        embedding: List[float],
        content_summary: str,
        has_image: bool = True,
        has_video: bool = False
    ) -> CampgroundEmbedding:
        """Upsert campground embedding record."""
        existing = session.exec(
            select(CampgroundEmbedding).where(CampgroundEmbedding.campground_id == campground_id)
        ).first()

        embedding_str = json.dumps(embedding)
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if existing:
            existing.embedding_json = embedding_str
            existing.content_summary = content_summary
            existing.has_image_embedding = has_image
            existing.has_video_embedding = has_video
            existing.updated_at = now
            session.add(existing)
            session.commit()
            return existing
        else:
            new_record = CampgroundEmbedding(
                campground_id=campground_id,
                embedding_json=embedding_str,
                embedding_dim=len(embedding),
                content_summary=content_summary,
                has_image_embedding=has_image,
                has_video_embedding=has_video,
                updated_at=now
            )
            session.add(new_record)
            session.commit()
            return new_record

    def search_similar(
        self,
        session: Session,
        query_vector: List[float],
        limit: int = 6,
        min_score: float = 0.35
    ) -> List[Dict[str, Any]]:
        """
        Calculates cosine similarity between query_vector and all indexed campgrounds.
        Returns top matches sorted by similarity score descending.
        """
        records = session.exec(select(CampgroundEmbedding)).all()
        if not records:
            return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []
        q_vec = q_vec / q_norm

        campground_ids = []
        vectors = []
        summaries = {}

        for rec in records:
            try:
                emb = json.loads(rec.embedding_json)
                if len(emb) == len(query_vector):
                    campground_ids.append(rec.campground_id)
                    vectors.append(emb)
                    summaries[rec.campground_id] = rec.content_summary
            except Exception as e:
                continue

        if not vectors:
            return []

        matrix = np.array(vectors, dtype=np.float32)
        # Row-wise normalize
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        matrix_normed = matrix / norms

        # Cosine similarities = dot product of normalized vectors
        scores = np.dot(matrix_normed, q_vec)

        # Pair scores with IDs and filter
        scored_pairs = []
        for idx, score in enumerate(scores):
            raw_score = float(score)
            if raw_score >= min_score:
                scored_pairs.append((campground_ids[idx], raw_score))

        # Sort descending by score
        scored_pairs.sort(key=lambda x: x[1], reverse=True)
        top_pairs = scored_pairs[:limit]

        if not top_pairs:
            return []

        # Hydrate matching campgrounds
        top_ids = [cid for cid, _ in top_pairs]
        camps = session.exec(select(Campground).where(Campground.id.in_(top_ids))).all()
        camps_by_id = {c.id: c for c in camps}

        results = []
        for cid, score in top_pairs:
            camp = camps_by_id.get(cid)
            if not camp:
                continue
            
            # Match percentage rounded to 1 decimal place (clamp 0..100)
            match_pct = max(0, min(100, round((score + 1.0) / 2.0 * 100, 1) if score < 1.0 else round(score * 100, 1)))

            results.append({
                "id": camp.id,
                "name": camp.name,
                "price": camp.price,
                "image": camp.image,
                "description": camp.description,
                "author_username": camp.author_username,
                "similarity_score": round(score, 4),
                "match_percentage": match_pct,
                "summary": summaries.get(cid, "")
            })

        return results

vector_store = VectorStoreService()
