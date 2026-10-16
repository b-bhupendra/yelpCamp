import os
import json
import logging
import hashlib
import sqlite3
from typing import List, Optional, Tuple, Any, Dict
import requests
import numpy as np
from config import settings
from services.vision_service import vision_service

logger = logging.getLogger(__name__)

class MultimodalEmbedder:
    """
    Production Multimodal Embedding & Background Ingestion Service.
    Generates 768-dimensional normalized embeddings for campgrounds, visitor stories,
    and UI navigation actions using Google Gemini embedding models ('gemini-embedding-2').
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        self.embedding_model = settings.EMBEDDING_MODEL or "gemini-embedding-2"
        self.vision_model = settings.CHAT_MODEL or "gemini-3.5-flash"
        self.dimension = 768
        self.client = None
        self._init_client()

    def _init_client(self):
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info(f"Initialized Google GenAI client with model {self.embedding_model}")
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI Client: {e}. Fallback vector mode enabled.")
                self.client = None
        else:
            logger.info("No GEMINI_API_KEY detected. Running in offline fallback vector mode.")

    def _deterministic_embedding(self, text: str, dim: int = 768) -> List[float]:
        """
        Deterministic pseudo-embedding fallback when offline or in test environments.
        Produces consistent, normalized vectors based on token n-grams and hashing.
        """
        logger.warning("Generating offline deterministic fallback embedding.")
        vec = np.zeros(dim, dtype=np.float32)
        tokens = text.lower().split()
        if not tokens:
            tokens = ["campsite", "nature"]
            
        for idx, token in enumerate(tokens):
            h = int(hashlib.sha256(token.encode('utf-8')).hexdigest(), 16)
            pos = h % dim
            weight = 1.0 / (idx + 1) ** 0.5
            vec[pos] += weight
            vec[(pos * 7 + 13) % dim] += weight * 0.5
            
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def embed_text(self, text: str) -> List[float]:
        """
        Generate a normalized 768-dimension embedding vector for text content.
        """
        if not text or not str(text).strip():
            raise ValueError("Cannot generate an embedding for an empty string.")

        clean_text = str(text).strip()

        if self.client:
            for attempt in range(3):
                try:
                    from google.genai import types
                    config = types.EmbedContentConfig(output_dimensionality=self.dimension)
                    response = self.client.models.embed_content(
                        model=self.embedding_model,
                        contents=clean_text,
                        config=config
                    )
                    if hasattr(response, 'embeddings') and len(response.embeddings) > 0:
                        vals = list(response.embeddings[0].values)
                        return self._normalize(vals)
                    elif hasattr(response, 'embedding') and hasattr(response.embedding, 'values'):
                        vals = list(response.embedding.values)
                        return self._normalize(vals)
                    raise ValueError("Embedding model returned empty vector response.")
                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        logger.warning(f"Embedding rate limit hit (attempt {attempt+1}/3). Waiting 5s...")
                        import time
                        time.sleep(5)
                        continue
                    logger.error(f"Gemini API embed_content failed: {e}")
                    break
            return self._deterministic_embedding(clean_text, self.dimension)
        
        return self._deterministic_embedding(clean_text, self.dimension)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Batch embed multiple texts using Google GenAI API.
        """
        valid_indices = []
        valid_texts = []
        for idx, t in enumerate(texts):
            if t and str(t).strip():
                valid_indices.append(idx)
                valid_texts.append(str(t).strip())

        if not valid_texts:
            return []

        if self.client:
            for attempt in range(3):
                try:
                    from google.genai import types
                    config = types.EmbedContentConfig(output_dimensionality=self.dimension)
                    contents = [
                        types.Content(parts=[types.Part.from_text(text=t)])
                        for t in valid_texts
                    ]
                    response = self.client.models.embed_content(
                        model=self.embedding_model,
                        contents=contents,
                        config=config
                    )
                    if hasattr(response, 'embeddings') and len(response.embeddings) == len(valid_texts):
                        return [self._normalize(list(e.values)) for e in response.embeddings]
                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        logger.warning(f"Batch embedding rate limit hit (attempt {attempt+1}/3). Waiting 5s...")
                        import time
                        time.sleep(5)
                        continue
                    logger.warning(f"Batch embedding failed: {e}. Falling back to sequential embeds.")
                    return [self.embed_text(t) for t in valid_texts]

        return [self._deterministic_embedding(t, self.dimension) for t in valid_texts]

    def _normalize(self, vec: List[float]) -> List[float]:
        arr = np.array(vec, dtype=np.float32)
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm
        return arr.tolist()

    async def process_campground_ingestion(self, campground_id: int):
        """
        Asynchronous background task triggered when a campground is created or updated:
        1. Analyzes cover photo with Gemini Flash Vision if ai_media_caption is empty
        2. Aggregates title, location, description, amenities, rules, and guest reviews
        3. Generates 768-d embedding
        4. Persists vector to Turso / SQLite and synchronizes campground_fts virtual table
        """
        logger.info(f"[Async Ingestion] Processing campground ID {campground_id}...")
        from database import engine
        from sqlmodel import Session, select
        from models import Campground, Comment
        from services.vector_store import vector_store
        from turso_engine import execute_turso_raw

        with Session(engine) as session:
            camp = session.get(Campground, campground_id)
            if not camp:
                logger.warning(f"Campground {campground_id} not found during async ingestion.")
                return

            # Fetch top reviews
            comments = session.exec(
                select(Comment.text).where(Comment.campground_id == campground_id).limit(5)
            ).all()

            # 1. Vision AI Analysis if needed
            visual_caption = camp.ai_media_caption or ""
            visual_desc = ""
            if not visual_caption and camp.image:
                try:
                    vision_res = await vision_service.analyze_image_url(camp.image)
                    visual_caption = vision_res.get("suggested_caption", "")
                    visual_desc = vision_res.get("detailed_visual_description", "")
                    camp.ai_media_caption = visual_caption
                    session.add(camp)
                    session.commit()
                except Exception as e:
                    logger.warning(f"Failed to generate vision caption for camp {campground_id}: {e}")

            # 2. Synthesize Context
            camp_name = camp.title or camp.name or f"Campground #{camp.id}"
            parts = [
                f"Campsite: {camp_name}",
                f"Location: {camp.location} {camp.location_address or ''}".strip(),
                f"Price: ${camp.price}/night",
                f"Description: {camp.description or ''}"
            ]
            if camp.amenities and camp.amenities != "[]":
                try:
                    amenities_list = json.loads(camp.amenities)
                    parts.append(f"Amenities: {', '.join(amenities_list)}")
                except Exception:
                    parts.append(f"Amenities: {camp.amenities}")

            if camp.rules:
                parts.append(f"Rules & Guidelines: {camp.rules}")

            if visual_desc or visual_caption:
                parts.append(f"Visual Ambiance: {visual_desc or visual_caption}")

            if comments:
                parts.append(f"Camper Tips & Reviews: {' | '.join(list(comments))}")

            if camp.community_summary:
                parts.append(f"Community Sentiment: {camp.community_summary}")

            profile_text = "\n".join(parts)

            # 3. Generate Vector Embedding
            embedding = self.embed_text(profile_text)
            emb_json = json.dumps(embedding)

            # 4. Save to CampgroundEmbedding & Vector Store Cache
            vector_store.save_embedding(
                session=session,
                campground_id=campground_id,
                embedding=embedding,
                content_summary=profile_text,
                has_image=bool(camp.image)
            )

            # 5. Write to Turso Cloud vector column
            if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
                try:
                    execute_turso_raw(
                        "UPDATE campground SET ai_media_caption = ?, embedding = vector32(?) WHERE id = ?",
                        [visual_caption, emb_json, campground_id]
                    )
                except Exception as e:
                    logger.warning(f"Turso vector update notice for camp {campground_id}: {e}")

            # 6. Synchronize SQLite & Turso FTS5 Virtual Table
            self._sync_campground_fts(
                campground_id=campground_id,
                title=camp_name,
                description=camp.description or "",
                location=camp.location or "",
                location_address=camp.location_address or "",
                amenities=camp.amenities or "[]",
                ai_media_caption=visual_caption
            )

        logger.info(f"[Async Ingestion] Successfully indexed campground {campground_id} into Vector Store & FTS5.")

    async def process_story_ingestion(self, photo_id: int):
        """
        Asynchronous background task triggered when a visitor story/photo is uploaded:
        1. Analyzes image with Gemini Flash Vision for tags and scenic caption
        2. Generates 768-d embedding
        3. Updates visitor_photos row with tags, caption, and vector32 embedding
        """
        logger.info(f"[Async Ingestion] Processing visitor photo ID {photo_id}...")
        from database import engine
        from sqlmodel import Session
        from models import VisitorPhoto
        from turso_engine import execute_turso_raw

        with Session(engine) as session:
            photo = session.get(VisitorPhoto, photo_id)
            if not photo:
                logger.warning(f"VisitorPhoto {photo_id} not found during async ingestion.")
                return

            # Analyze image with Vision AI if tags or caption are missing
            if (not photo.ai_tags or photo.ai_tags == "[]") and photo.image_url:
                try:
                    res = await vision_service.analyze_image_url(photo.image_url)
                    photo.ai_tags = json.dumps(res.get("ai_tags", []))
                    if not photo.caption:
                        photo.caption = res.get("suggested_caption", "")
                    photo.ai_media_caption = res.get("detailed_visual_description", "")
                    session.add(photo)
                    session.commit()
                except Exception as e:
                    logger.warning(f"Failed to extract vision tags for photo {photo_id}: {e}")

            # Synthesize text for vector embedding
            text_parts = [
                f"Visitor Moment: {photo.caption or ''}",
                f"Visual Tags: {photo.ai_tags}",
                f"Visual Atmosphere: {photo.ai_media_caption or ''}"
            ]
            story_text = "\n".join(text_parts)
            embedding = self.embed_text(story_text)
            emb_json = json.dumps(embedding)

            # Update Turso Cloud vector column
            if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
                try:
                    execute_turso_raw(
                        "UPDATE visitor_photos SET ai_tags = ?, ai_media_caption = ?, embedding = vector32(?) WHERE id = ?",
                        [photo.ai_tags, photo.ai_media_caption, emb_json, photo_id]
                    )
                except Exception as e:
                    logger.warning(f"Turso vector update notice for photo {photo_id}: {e}")

        logger.info(f"[Async Ingestion] Successfully ingested visitor photo {photo_id}.")

    def _sync_campground_fts(
        self,
        campground_id: int,
        title: str,
        description: str,
        location: str,
        location_address: str,
        amenities: str,
        ai_media_caption: str
    ):
        """Synchronize an updated campground row into campground_fts."""
        from turso_engine import execute_turso_raw

        # Local SQLite
        try:
            con = sqlite3.connect("database.db")
            cur = con.cursor()
            cur.execute("DELETE FROM campground_fts WHERE rowid = ?", (campground_id,))
            cur.execute("""
                INSERT INTO campground_fts (rowid, title, description, location, location_address, amenities, ai_media_caption)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (campground_id, title, description, location, location_address, amenities, ai_media_caption))
            con.commit()
            con.close()
        except Exception as e:
            logger.debug(f"Local FTS sync notice for camp {campground_id}: {e}")

        # Turso Cloud
        if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
            try:
                execute_turso_raw("DELETE FROM campground_fts WHERE rowid = ?", [campground_id])
                execute_turso_raw("""
                    INSERT INTO campground_fts (rowid, title, description, location, location_address, amenities, ai_media_caption)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, [campground_id, title, description, location, location_address, amenities, ai_media_caption])
            except Exception as e:
                logger.debug(f"Turso FTS sync notice for camp {campground_id}: {e}")

multimodal_embedder = MultimodalEmbedder()
process_campground_ingestion = multimodal_embedder.process_campground_ingestion
process_story_ingestion = multimodal_embedder.process_story_ingestion
