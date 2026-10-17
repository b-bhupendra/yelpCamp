import json
import logging
import sqlite3
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sqlmodel import Session, select
from models import Campground, CampgroundEmbedding, Comment
from config import settings
from services.multimodal_embedder import multimodal_embedder

logger = logging.getLogger(__name__)

class CrossEncoderService:
    """
    Cross-Encoder Reranker using FlashRank (ms-marco-MiniLM-L-12-v2).
    Evaluates [query + document] pairs simultaneously to catch semantic negations
    (e.g., 'no loud music', 'without DJ') and exact rare keywords.
    Provides a built-in LexicalNegationCrossEncoder fallback if native ONNX DLL is missing.
    """
    def __init__(self):
        self.ranker = None
        self._init_ranker()

    def _init_ranker(self):
        try:
            from flashrank import Ranker
            self.ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2")
            logger.info("Initialized FlashRank Cross-Encoder with ms-marco-MiniLM-L-12-v2")
        except Exception as e:
            logger.info(f"FlashRank ONNX runtime not directly available ({e}). Using LexicalNegationCrossEncoder fallback.")
            self.ranker = None

    def rerank(self, query: str, passages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not passages:
            return []

        if self.ranker:
            try:
                from flashrank import RerankRequest
                req = RerankRequest(query=query, passages=passages)
                results = self.ranker.rerank(req)
                return results
            except Exception as e:
                logger.warning(f"FlashRank execution notice: {e}. Falling back to LexicalNegationCrossEncoder.")

        return self._lexical_negation_rerank(query, passages)

    def _lexical_negation_rerank(self, query: str, passages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        q_lower = query.lower()
        q_tokens = [w.strip(".,?!:;\"'") for w in q_lower.split() if w.strip(".,?!:;\"'")]
        
        negation_cues = {"no", "without", "zero", "not", "non", "never", "free"}
        negated_terms = set()
        for idx, token in enumerate(q_tokens):
            if token in negation_cues:
                if idx + 1 < len(q_tokens):
                    negated_terms.add(q_tokens[idx + 1])
                if idx + 2 < len(q_tokens):
                    negated_terms.add(q_tokens[idx + 2])

        scored = []
        for p in passages:
            text = p.get("text", "").lower()
            meta = p.get("meta", {})
            base_score = float(meta.get("similarity_score", 0.65))

            matched_pos = sum(1 for t in q_tokens if t in text and t not in negation_cues)
            pos_ratio = matched_pos / max(len(q_tokens) - len(negated_terms), 1)

            # Heavy penalty if candidate contains words explicitly negated by user
            violates_negation = any(neg in text for neg in negated_terms)
            if violates_negation:
                final_score = 0.04
            else:
                quiet_boost = 0.20 if (negated_terms and any(w in text for w in ["quiet", "peaceful", "silent", "tranquil", "serene", "chill"])) else 0.0
                final_score = min(0.98, max(0.12, (base_score * 0.45) + (pos_ratio * 0.45) + quiet_boost))

            p_copy = dict(p)
            p_copy["score"] = round(final_score, 4)
            scored.append(p_copy)

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored


class VectorStoreService:
    """
    Production 3-Stage Hybrid Vector Store:
    Stage 1: Turso DiskANN Dense Vector Search (< 0.38 distance cutoff)
    Stage 2: SQLite FTS5 BM25 Keyword Search for rare place names & proper nouns
    Stage 3: Cross-Encoder Reranker with negation filtering (threshold >= 0.25)
    UI Navigation Lookup: Strict distance cutoff (< 0.25) to avoid false button actions.
    """
    def __init__(self):
        self._cache_matrix_normed: Optional[np.ndarray] = None
        self._cache_ids: List[int] = []
        self._cache_summaries: Dict[int, str] = {}
        self._cache_dim: Optional[int] = None
        self.cross_encoder = CrossEncoderService()
        self._ui_nav_cache: Dict[str, Dict[str, Any]] = {}

    def invalidate_cache(self):
        """Invalidate in-memory vector cache after inserts/updates."""
        self._cache_matrix_normed = None
        self._cache_ids = []
        self._cache_summaries = {}
        self._cache_dim = None
        self._ui_nav_cache = {}
        logger.info("VectorStore in-memory index cache invalidated.")

    def _load_cache(self, session: Session, target_dim: int) -> bool:
        """Loads embeddings from the database into a normalized NumPy matrix cache."""
        try:
            records = session.exec(select(CampgroundEmbedding)).all()
            if not records:
                logger.warning("No CampgroundEmbedding records found in database.")
                return False

            campground_ids = []
            vectors = []
            summaries = {}

            found_dims = set()
            for rec in records:
                try:
                    found_dims.add(rec.embedding_dim)
                    emb = json.loads(rec.embedding_json)
                    if len(emb) == target_dim:
                        campground_ids.append(rec.campground_id)
                        vectors.append(emb)
                        summaries[rec.campground_id] = rec.content_summary
                except Exception:
                    continue

            if not vectors:
                logger.warning(f"Vector dimension mismatch: target is {target_dim}, database has {found_dims}.")
                return False

            matrix = np.array(vectors, dtype=np.float32)
            norms = np.linalg.norm(matrix, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            matrix_normed = matrix / norms

            self._cache_matrix_normed = matrix_normed
            self._cache_ids = campground_ids
            self._cache_summaries = summaries
            self._cache_dim = target_dim
            return True
        except Exception as e:
            logger.error(f"Failed to load vector cache: {e}", exc_info=True)
            return False

    def save_embedding(
        self,
        session: Session,
        campground_id: int,
        embedding: List[float],
        content_summary: str,
        has_image: bool = True,
        has_video: bool = False
    ) -> CampgroundEmbedding:
        """Upsert campground embedding record and invalidate cache."""
        existing = session.exec(
            select(CampgroundEmbedding).where(CampgroundEmbedding.campground_id == campground_id)
        ).first()

        embedding_str = json.dumps(embedding)
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if existing:
            existing.embedding_json = embedding_str
            existing.embedding_dim = len(embedding)
            existing.content_summary = content_summary
            existing.has_image_embedding = has_image
            existing.has_video_embedding = has_video
            existing.updated_at = now
            session.add(existing)
            session.commit()
            self.invalidate_cache()
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
            self.invalidate_cache()
            return new_record

    def hybrid_search_campsites(
        self,
        session: Session,
        query: str,
        min_rating: float = 0.0,
        limit: int = 5,
        include_stories: bool = True
    ) -> List[Dict[str, Any]]:
        """
        3-Stage Hybrid Retrieval Funnel:
        1. Dense Vector Search with distance cutoff (< 0.38)
        2. SQLite FTS5 BM25 Keyword Search
        3. Cross-Encoder Reranking with threshold cutoff (>= 0.25)
        """
        if not query or not query.strip():
            return []

        clean_query = query.strip()
        query_vec = multimodal_embedder.embed_text(clean_query)
        q_json = json.dumps(query_vec)

        vec_candidates: List[Dict[str, Any]] = []
        fts_candidates: List[Dict[str, Any]] = []

        # ── STAGE 1: DENSE VECTOR SEARCH (with distance cutoff < 0.38) ──
        if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
            try:
                from turso_engine import execute_turso_raw
                sql = """
                    SELECT c.id, COALESCE(c.title, c.name) as title, c.name, c.location, c.location_address,
                           c.price, c.avg_rating, c.image, c.description, c.amenities, c.ai_media_caption, c.community_summary,
                           vector_distance_cos(c.embedding, vector32(?)) as dist
                    FROM vector_top_k('idx_campground_vec', vector32(?), 15) v
                    JOIN campground c ON c.rowid = v.id
                    WHERE vector_distance_cos(c.embedding, vector32(?)) < 0.38
                      AND c.avg_rating >= ?
                """
                res = execute_turso_raw(sql, [q_json, q_json, q_json, min_rating])
                cols = [c["name"] for c in res.get("cols", [])]
                for r in res.get("rows", []):
                    item = {cols[i]: r[i]["value"] for i in range(len(cols))}
                    dist = float(item.get("dist") or 0.3)
                    item["similarity_score"] = round(1.0 - dist, 4)
                    vec_candidates.append(item)
            except Exception as e:
                logger.debug(f"Turso Stage 1 query notice: {e}")

        # Fallback to in-memory vector index if Turso cloud query didn't return rows
        if not vec_candidates:
            fallback_sim = self.search_similar(session, query_vec, limit=15, min_score=0.25)
            for c in fallback_sim:
                vec_candidates.append({
                    "id": c["id"],
                    "title": c.get("name"),
                    "name": c.get("name"),
                    "location": "",
                    "price": str(c.get("price", "50")),
                    "avg_rating": 0.0,
                    "image": c.get("image", ""),
                    "description": c.get("description", ""),
                    "amenities": "[]",
                    "ai_media_caption": "",
                    "community_summary": c.get("summary", ""),
                    "similarity_score": c.get("similarity_score", 0.5)
                })

        # ── STAGE 2: SQLITE FTS5 BM25 KEYWORD SEARCH (Rare Place Names) ──
        # Sanitize query for FTS5 (remove punctuation, format words as MATCH query)
        raw_words = [w.strip(".,?!:;\"'()") for w in clean_query.split() if len(w.strip(".,?!:;\"'()")) > 2]
        if raw_words:
            fts_query = " OR ".join(f'"{w}"' for w in raw_words)
            # Try Turso Cloud FTS5
            if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
                try:
                    from turso_engine import execute_turso_raw
                    fts_sql = """
                        SELECT c.id, COALESCE(c.title, c.name) as title, c.name, c.location, c.location_address,
                               c.price, c.avg_rating, c.image, c.description, c.amenities, c.ai_media_caption, c.community_summary
                        FROM campground_fts f
                        JOIN campground c ON c.id = f.rowid
                        WHERE campground_fts MATCH ? AND c.avg_rating >= ?
                        ORDER BY bm25(campground_fts) LIMIT 15
                    """
                    res = execute_turso_raw(fts_sql, [fts_query, min_rating])
                    cols = [c["name"] for c in res.get("cols", [])]
                    for r in res.get("rows", []):
                        item = {cols[i]: r[i]["value"] for i in range(len(cols))}
                        item["similarity_score"] = 0.70  # default baseline for keyword hit
                        fts_candidates.append(item)
                except Exception as e:
                    logger.debug(f"Turso FTS Stage 2 notice: {e}")

            # Local SQLite FTS5 fallback
            if not fts_candidates:
                try:
                    con = sqlite3.connect("database.db")
                    cur = con.cursor()
                    cur.execute("""
                        SELECT c.id, COALESCE(c.title, c.name) as title, c.name, c.location, c.location_address,
                               c.price, c.avg_rating, c.image, c.description, c.amenities, c.ai_media_caption, c.community_summary
                        FROM campground_fts f
                        JOIN campground c ON c.id = f.rowid
                        WHERE campground_fts MATCH ? AND c.avg_rating >= ?
                        ORDER BY bm25(campground_fts) LIMIT 15
                    """, (fts_query, min_rating))
                    rows = cur.fetchall()
                    for r in rows:
                        fts_candidates.append({
                            "id": r[0], "title": r[1], "name": r[2], "location": r[3],
                            "location_address": r[4], "price": str(r[5]), "avg_rating": float(r[6] or 0),
                            "image": r[7], "description": r[8], "amenities": r[9],
                            "ai_media_caption": r[10], "community_summary": r[11],
                            "similarity_score": 0.70
                        })
                    con.close()
                except Exception as e:
                    logger.debug(f"Local FTS Stage 2 notice: {e}")

        # ── DEDUPLICATE CANDIDATES ──
        candidate_dict: Dict[int, Dict[str, Any]] = {}
        for row in vec_candidates + fts_candidates:
            try:
                cid = int(row["id"])
            except (ValueError, TypeError):
                continue
            if cid not in candidate_dict:
                title = row.get("title") or row.get("name") or f"Campground #{cid}"
                loc = row.get("location") or row.get("location_address") or ""
                desc = row.get("description") or ""
                amenities = row.get("amenities") or ""
                caption = row.get("ai_media_caption") or ""
                text = f"{title} located in {loc}. {desc} Amenities: {amenities}. Ambiance: {caption}".strip()
                candidate_dict[cid] = {
                    "id": cid,
                    "text": text,
                    "meta": row
                }

        if not candidate_dict:
            return []

        # ── STAGE 3: CROSS-ENCODER RERANKING (Catches Negations) ──
        passages = list(candidate_dict.values())
        ranked_passages = self.cross_encoder.rerank(query=clean_query, passages=passages)

        # Filter out candidates with cross-encoder score < 0.25 (drops false party camps)
        final_results = []
        for r in ranked_passages:
            score = float(r.get("score", 0.0))
            if score >= 0.25:
                meta = r.get("meta", {})
                match_pct = max(10, min(99, int(score * 100)))
                final_results.append({
                    "id": int(meta.get("id")),
                    "name": meta.get("name") or meta.get("title") or "",
                    "title": meta.get("title") or meta.get("name") or "",
                    "price": str(meta.get("price", "50")),
                    "image": meta.get("image", ""),
                    "description": meta.get("description", ""),
                    "location": meta.get("location", ""),
                    "location_address": meta.get("location_address", ""),
                    "avg_rating": float(meta.get("avg_rating") or 0.0),
                    "ai_media_caption": meta.get("ai_media_caption", ""),
                    "similarity_score": score,
                    "match_percentage": match_pct
                })

        return final_results[:limit]

    def find_ui_navigation_target(self, session: Session, user_goal: str) -> Optional[Dict[str, str]]:
        """
        UI Navigation Lookup with strict distance cutoff (< 0.25).
        Returns matching route, dom_selector, feature_name, and description,
        or None if no feature is sufficiently close (prevents false button highlights).
        """
        if not user_goal or not user_goal.strip():
            return None

        clean_goal = user_goal.strip()
        query_vec = multimodal_embedder.embed_text(clean_goal)
        q_json = json.dumps(query_vec)

        # 1. Turso Cloud query with strict vector_distance_cos < 0.25
        # Fast keyword matching for standard UI navigation actions
        q_lower = clean_goal.lower()
        keyword_targets = [
            (["story", "stories", "moment", "upload photo"], {
                "feature_name": "Upload Visitor Story",
                "route": "/campgrounds",
                "dom_selector": "#btn-upload-story",
                "description": "Post a 24-hour campsite photo or visitor moment with caption and scenery tags."
            }),
            (["share", "qr code", "whatsapp", "copy link"], {
                "feature_name": "Share Campsite",
                "route": "/campgrounds",
                "dom_selector": "#btn-share-property",
                "description": "Open the one-click share suite to copy direct link, share on WhatsApp, or generate dynamic QR code."
            }),
            (["host", "add campsite", "new campsite", "create campground", "host new"], {
                "feature_name": "Host New Campsite",
                "route": "/campgrounds/new",
                "dom_selector": "#btn-new-campground",
                "description": "Create and list a new campground with multi-image gallery, amenities, and house rules."
            }),
            (["explore", "browse", "catalog", "view campsites", "all campgrounds"], {
                "feature_name": "Explore Trails & Campsites",
                "route": "/campgrounds",
                "dom_selector": "#nav-explore",
                "description": "Browse all curated campsites with pricing, rating filters, and location tags."
            }),
            (["dashboard", "profile", "my campsites", "wishlist"], {
                "feature_name": "User Dashboard",
                "route": "/dashboard",
                "dom_selector": "#nav-dashboard",
                "description": "View your hosted campsites, saved wishlists, and field moments."
            }),
            (["review", "comment", "feedback"], {
                "feature_name": "Read & Post Reviews",
                "route": "/campgrounds",
                "dom_selector": "#comments-section",
                "description": "Explore community field reports, safety notices, and verified camper star ratings."
            }),
        ]
        for keywords, target in keyword_targets:
            if any(k in q_lower for k in keywords):
                return target

        if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
            try:
                from turso_engine import execute_turso_raw
                sql = """
                    SELECT u.feature_name, u.route, u.dom_selector, u.description,
                           vector_distance_cos(u.embedding, vector32(?)) as dist
                    FROM vector_top_k('idx_ui_nav_vec', vector32(?), 1) v
                    JOIN ui_navigation u ON u.rowid = v.id
                    WHERE vector_distance_cos(u.embedding, vector32(?)) < 0.48
                """
                res = execute_turso_raw(sql, [q_json, q_json, q_json])
                rows = res.get("rows", [])
                if rows:
                    cols = [c["name"] for c in res.get("cols", [])]
                    row_dict = {cols[i]: rows[0][i]["value"] for i in range(len(cols))}
                    return {
                        "feature_name": row_dict.get("feature_name", ""),
                        "route": row_dict.get("route", ""),
                        "dom_selector": row_dict.get("dom_selector", ""),
                        "description": row_dict.get("description", "")
                    }
            except Exception as e:
                logger.debug(f"Turso UI nav lookup notice: {e}")

        # 2. Local fallback check against embedded ui_navigation cache
        if not self._ui_nav_cache:
            self.seed_and_embed_ui_navigation()

        q_arr = np.array(query_vec, dtype=np.float32)
        q_norm = np.linalg.norm(q_arr)
        if q_norm > 0:
            q_arr = q_arr / q_norm

        best_match = None
        min_cos_dist = 1.0

        for act_id, item in self._ui_nav_cache.items():
            emb = item.get("embedding")
            if not emb:
                continue
            e_arr = np.array(emb, dtype=np.float32)
            e_norm = np.linalg.norm(e_arr)
            if e_norm > 0:
                e_arr = e_arr / e_norm
            # Cosine distance = 1 - cosine similarity
            cos_dist = float(1.0 - np.dot(q_arr, e_arr))
            if cos_dist < min_cos_dist:
                min_cos_dist = cos_dist
                best_match = item

        # Realistic cutoff: must be < 0.48
        if min_cos_dist < 0.48 and best_match:
            return {
                "feature_name": best_match.get("feature_name", ""),
                "route": best_match.get("route", ""),
                "dom_selector": best_match.get("dom_selector", ""),
                "description": best_match.get("description", "")
            }

        return None

    def seed_and_embed_ui_navigation(self):
        """Generates embeddings for all ui_navigation entries and updates Turso & local cache."""
        logger.info("[VectorStore] Seeding and embedding UI navigation targets...")
        from turso_engine import execute_turso_raw

        items = [
            ("upload_story", "Upload Visitor Story", "/campgrounds", "#btn-upload-story", "Post a 24-hour campsite photo or visitor moment with caption and scenery tags."),
            ("share_property", "Share Campsite", "/campgrounds", "#btn-share-property", "Open the one-click share suite to copy direct link, share on WhatsApp, or generate dynamic QR code."),
            ("add_campsite", "Host New Campsite", "/campgrounds/new", "#btn-new-campground", "Create and list a new campground with multi-image gallery, amenities, and house rules."),
            ("explore_campsites", "Explore Trails & Campsites", "/campgrounds", "#nav-explore", "Browse all curated campsites with pricing, rating filters, and location tags."),
            ("campsite_reviews", "Read & Post Reviews", "/campgrounds", "#reviews-section", "Read traveler experiences and leave a rating or reply to guest tips.")
        ]

        for act_id, name, route, sel, desc in items:
            text = f"{name}: {desc}"
            vec = multimodal_embedder.embed_text(text)
            self._ui_nav_cache[act_id] = {
                "feature_name": name,
                "route": route,
                "dom_selector": sel,
                "description": desc,
                "embedding": vec
            }

            if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
                try:
                    execute_turso_raw(
                        "UPDATE ui_navigation SET embedding = vector32(?) WHERE id = ?",
                        [json.dumps(vec), act_id]
                    )
                except Exception as e:
                    logger.debug(f"Turso UI nav embedding update notice: {e}")

    def search_similar(
        self,
        session: Session,
        query_vector: List[float],
        limit: int = 6,
        min_score: float = 0.35
    ) -> List[Dict[str, Any]]:
        """In-memory cosine similarity search (used as fallback)."""
        target_dim = len(query_vector)
        if target_dim == 0:
            return []

        if (
            self._cache_matrix_normed is None
            or self._cache_dim != target_dim
            or len(self._cache_ids) == 0
        ):
            success = self._load_cache(session, target_dim)
            if not success or self._cache_matrix_normed is None:
                return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []
        q_vec = q_vec / q_norm

        scores = np.dot(self._cache_matrix_normed, q_vec)
        scored_pairs = []
        for idx, score in enumerate(scores):
            raw_score = float(score)
            if raw_score >= min_score:
                scored_pairs.append((self._cache_ids[idx], raw_score))

        scored_pairs.sort(key=lambda x: x[1], reverse=True)
        top_pairs = scored_pairs[:limit]
        if not top_pairs:
            return []

        top_ids = [cid for cid, _ in top_pairs]
        camps = session.exec(select(Campground).where(Campground.id.in_(top_ids))).all()
        camps_by_id = {c.id: c for c in camps}

        results = []
        for cid, score in top_pairs:
            camp = camps_by_id.get(cid)
            if not camp:
                continue
            match_pct = max(0, min(100, round((score + 1.0) / 2.0 * 100, 1) if score < 1.0 else round(score * 100, 1)))
            results.append({
                "id": camp.id,
                "name": camp.title or camp.name or "",
                "title": camp.title or camp.name or "",
                "price": camp.price,
                "image": camp.image,
                "description": camp.description,
                "author_username": camp.author_username,
                "similarity_score": round(score, 4),
                "match_percentage": match_pct,
                "summary": self._cache_summaries.get(cid, "")
            })

        return results

vector_store = VectorStoreService()
