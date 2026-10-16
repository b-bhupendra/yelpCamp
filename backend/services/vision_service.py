import os
import json
import logging
from typing import Optional, List, Dict, Any, Tuple
import requests
from config import settings

logger = logging.getLogger(__name__)

class VisionService:
    """
    Multimodal Vision AI Service for YelpCamp.
    Leverages Google Gemini Flash models to analyze campsite photos and visitor stories,
    extracting atmospheric captions, semantic scene tags, and structured visual descriptions.
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        self.primary_model = settings.VISION_MODEL or "gemini-3.5-flash"
        self.fallback_models = [
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-2.5-flash-lite",
            "gemini-flash-latest",
            "gemini-3.8-flash"
        ]
        self.client = None
        self._init_client()

    def _init_client(self):
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info(f"VisionService initialized with model {self.primary_model}")
            except Exception as e:
                logger.warning(f"Could not initialize GenAI client in VisionService: {e}")
                self.client = None
        else:
            logger.info("VisionService running without GEMINI_API_KEY. Fallback heuristics active.")

    def _fallback_analysis(self, fallback_hint: str = "") -> Dict[str, Any]:
        """Provides heuristic tags and descriptions when offline or API is unavailable."""
        return {
            "suggested_caption": "Scenic natural campsite nestled in tranquil wilderness.",
            "ai_tags": ["campfire", "tent_pitch", "wilderness", "stargazing", "mountain_view"],
            "detailed_visual_description": (
                f"Outdoor campsite scenery featuring rustic wilderness and nature terrain. {fallback_hint}".strip()
            )
        }

    async def analyze_image_bytes(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """
        Analyze raw image bytes via Gemini Flash and return structured metadata.
        Returns dict with: suggested_caption, ai_tags, detailed_visual_description
        """
        if not image_bytes or len(image_bytes) == 0:
            return self._fallback_analysis()

        if not self.client:
            self._init_client()
            if not self.client:
                return self._fallback_analysis()

        from google.genai import types

        prompt = (
            "You are an expert outdoor adventure and campground visual intelligence assistant.\n"
            "Analyze this campsite photograph and return a valid JSON object matching this schema:\n"
            "{\n"
            '  "suggested_caption": "An evocative, atmospheric 1-sentence caption for a camper\'s post",\n'
            '  "ai_tags": ["4 to 6 concise outdoor tags e.g. stargazing, lakefront, campfire, pine_forest, tent_pitch"],\n'
            '  "detailed_visual_description": "2-3 concise sentences detailing terrain, weather/lighting, foliage, and vibe."\n'
            "}\n"
            "Do not include markdown blocks or any text outside of the JSON object."
        )

        models_to_try = [self.primary_model] + [m for m in self.fallback_models if m != self.primary_model]

        for model_name in models_to_try:
            try:
                config = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        prompt
                    ],
                    config=config
                )
                if response and response.text:
                    parsed = json.loads(response.text.strip())
                    tags = parsed.get("ai_tags", [])
                    if isinstance(tags, str):
                        tags = [t.strip() for t in tags.split(",") if t.strip()]
                    return {
                        "suggested_caption": str(parsed.get("suggested_caption", "")).strip(),
                        "ai_tags": [str(t).lower().replace(" ", "_") for t in tags[:8]],
                        "detailed_visual_description": str(parsed.get("detailed_visual_description", "")).strip()
                    }
            except Exception as e:
                logger.warning(f"Vision analysis failed with model {model_name}: {e}")
                continue

        logger.error("All Gemini Vision models failed. Falling back to default heuristics.")
        return self._fallback_analysis()

    async def analyze_image_url(self, image_url: str) -> Dict[str, Any]:
        """Fetch image bytes from URL and run multimodal analysis."""
        if not image_url or not image_url.startswith("http"):
            return self._fallback_analysis()

        try:
            headers = {"User-Agent": "YelpCamp/2.0 (VisionService)"}
            resp = requests.get(image_url, headers=headers, timeout=6, stream=True)
            if resp.status_code != 200:
                logger.warning(f"Could not download image {image_url}, status: {resp.status_code}")
                return self._fallback_analysis()

            content_type = resp.headers.get("Content-Type", "").lower()
            if "png" in content_type:
                mime_type = "image/png"
            elif "webp" in content_type:
                mime_type = "image/webp"
            else:
                mime_type = "image/jpeg"

            data = resp.raw.read(6 * 1024 * 1024)
            return await self.analyze_image_bytes(data, mime_type=mime_type)
        except Exception as e:
            logger.warning(f"Error fetching image from URL {image_url}: {e}")
            return self._fallback_analysis()

vision_service = VisionService()
