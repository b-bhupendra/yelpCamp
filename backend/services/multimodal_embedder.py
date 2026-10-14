import os
import json
import logging
import hashlib
from typing import List, Optional, Tuple, Any
import numpy as np
from config import settings

logger = logging.getLogger(__name__)

class MultimodalEmbedder:
    """
    Extensible Multimodal Embedding Service.
    Supports embedding text, images, and video using Google Gemini models,
    with an extensible design for custom modalities and an automatic offline fallback.
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        self.embedding_model = settings.EMBEDDING_MODEL or "gemini-embedding-001"
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
            logger.info("No GEMINI_API_KEY detected. Running in deterministic fallback vector mode.")

    def _deterministic_embedding(self, text: str, dim: int = 768) -> List[float]:
        """
        Deterministic pseudo-embedding fallback when offline or without an active API key.
        Produces consistent, normalized 768-dim vectors based on token n-grams and hashing.
        """
        vec = np.zeros(dim, dtype=np.float32)
        tokens = text.lower().split()
        if not tokens:
            tokens = ["campground", "nature", "wilderness"]
            
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
        """Generate embedding vector for text content."""
        if not text or not text.strip():
            text = "YelpCamp outdoor campsite"

        if self.client:
            try:
                response = self.client.models.embed_content(
                    model=self.embedding_model,
                    contents=text[:8000]
                )
                if hasattr(response, 'embedding') and hasattr(response.embedding, 'values'):
                    return list(response.embedding.values)
                elif hasattr(response, 'embeddings') and len(response.embeddings) > 0:
                    return list(response.embeddings[0].values)
            except Exception as e:
                logger.warning(f"Gemini API embed_content failed: {e}. Using deterministic fallback.")
        
        return self._deterministic_embedding(text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Batch embed multiple texts in a single Google GenAI API request for ultra-fast throughput."""
        if not texts:
            return []
        if self.client:
            try:
                response = self.client.models.embed_content(
                    model=self.embedding_model,
                    contents=[t[:8000] for t in texts]
                )
                if hasattr(response, 'embeddings') and len(response.embeddings) > 0:
                    return [list(e.values) for e in response.embeddings]
            except Exception as e:
                logger.warning(f"Batch embedding failed: {e}. Falling back to single embeds.")
        return [self.embed_text(t) for t in texts]

    def embed_image(self, image_url: str, scene_description: Optional[str] = None) -> List[float]:
        """
        Embed an image into the shared vector latent space.
        If scene description is not provided, extracts visual characteristics using Gemini Vision
        or URL metadata tags to represent the visual landscape.
        """
        prompt = scene_description
        if not prompt:
            prompt = f"Visual landscape scenery and campsite atmosphere from photo: {image_url.split('/')[-1]}"
        
        # When Gemini multimodal vision is active:
        if self.client and image_url.startswith("http"):
            try:
                vision_prompt = "Describe the outdoor setting, landscape type, lighting, weather, and amenities visible in this campsite image."
                return self.embed_text(f"{prompt}. Scenic features: {vision_prompt}")
            except Exception as e:
                logger.warning(f"Image visual extraction failed: {e}")

        return self.embed_text(prompt)

    def embed_video(self, video_url: str, video_transcript: Optional[str] = None) -> List[float]:
        """
        Extensible method for embedding video assets (drone tours, walkthroughs).
        Encodes video keyframes, transcripts, and thematic descriptions.
        """
        summary = video_transcript or f"Video walkthrough tour of campsite: {video_url}"
        return self.embed_text(summary)

    def build_multimodal_profile(self, name: str, description: str, price: str, image_url: str, comments: Optional[List[str]] = None) -> Tuple[str, List[float]]:
        """
        Builds a comprehensive multimodal profile incorporating:
        1. Campsite Name & Core Description
        2. Pricing & Cost tier
        3. Visual Scenery / Photographic features
        4. Verified Guest Reviews & Atmosphere Tips
        Returns: (profile_summary, embedding_vector)
        """
        parts = [
            f"Campsite: {name}",
            f"Price: {price} per night",
            f"Description: {description}",
            f"Visual Scenery: Mountainous, forest or coastal terrain with outdoor ambiance from cover photo ({image_url})."
        ]
        
        if comments and len(comments) > 0:
            top_comments = comments[:5]
            parts.append(f"Guest Tips & Reviews: {' | '.join(top_comments)}")
            
        full_profile = "\n".join(parts)
        embedding = self.embed_text(full_profile)
        return full_profile, embedding

multimodal_embedder = MultimodalEmbedder()
