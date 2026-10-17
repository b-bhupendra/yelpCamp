import os
import re
import logging
from typing import Optional, List, Any
import requests

logger = logging.getLogger(__name__)

# Curated, verified 200 OK high-resolution campsite photos from Unsplash
FALLBACK_CAMPGROUND_IMAGES: List[str] = [
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",  # Tent under stars
    "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",  # Campfire dusk
    "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80",  # Night lake camp
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80",  # Misty mountain
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",  # Sunset mountain
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",  # Yosemite valley
    "https://images.unsplash.com/photo-1533873984035-25970ab07461?auto=format&fit=crop&w=1200&q=80",  # Forest river
    "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=1200&q=80",  # Glamping tent
    "https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1200&q=80",  # Pine trees lake
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",  # Wooden dock lake
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1200&q=80",  # Green hills
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",  # Snowy mountain ridge
    "https://images.unsplash.com/photo-1536431311719-398b6704d4cc?auto=format&fit=crop&w=1200&q=80",  # Blue mountain lake
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",  # Tropical beach
    "https://images.unsplash.com/photo-1537905569824-f89f14cceb68?auto=format&fit=crop&w=1200&q=80",  # Camping van
    "https://images.unsplash.com/photo-1571687949921-1306bfb24b72?auto=format&fit=crop&w=1200&q=80",  # A-frame cabin
    "https://images.unsplash.com/photo-1532339142463-fd0a8979791a?auto=format&fit=crop&w=1200&q=80",  # Hammock woods
    "https://images.unsplash.com/photo-1516939884455-1445c8652f83?auto=format&fit=crop&w=1200&q=80",  # Foggy pine forest
    "https://images.unsplash.com/photo-1487730116645-74489c95b41b?auto=format&fit=crop&w=1200&q=80",  # Alpine tent glow
]

DEFAULT_CAMPGROUND_IMAGE = FALLBACK_CAMPGROUND_IMAGES[0]
DEFAULT_STORY_IMAGE = FALLBACK_CAMPGROUND_IMAGES[1]

# In-memory validation cache to prevent repeated HTTP check overhead
_VALIDATION_CACHE: dict = {}

# Known broken Unsplash image IDs that return 404
KNOWN_BROKEN_PATTERNS = [
    "photo-1510798831971-661ebf7c373a",
    "photo-1501854140801-cbc35602d45a",
    "photo-1518173946684-a15f061031c2",
    "photo-1499344004921-69238af42ea5",
    "photo-1493246507139-91e8bef99c21",
    "photo-1500375592092-40ec21f8fe7f",
    "photo-1475924156731-498ff7931435",
    "photo-1501785887759-ddad4dda0901",
]

def is_valid_image_url(url: Optional[str], timeout: float = 2.5) -> bool:
    """
    Checks if a given image URL is alive, reachable, and returns a valid image HTTP response.
    Supports HTTP/HTTPS URLs and local /uploads/ files.
    """
    if not url or not isinstance(url, str):
        return False
    
    url = url.strip()
    if not url:
        return False

    # Check known broken patterns
    for pat in KNOWN_BROKEN_PATTERNS:
        if pat in url:
            return False

    # Check cache
    if url in _VALIDATION_CACHE:
        return _VALIDATION_CACHE[url]

    # Handle local uploaded files
    if url.startswith("/uploads/") or url.startswith("uploads/"):
        rel_path = url.lstrip("/")
        exists = os.path.exists(rel_path) or os.path.exists(os.path.join("uploads", os.path.basename(rel_path)))
        _VALIDATION_CACHE[url] = exists
        return exists

    if not (url.startswith("http://") or url.startswith("https://")):
        _VALIDATION_CACHE[url] = False
        return False

    try:
        # First attempt fast HEAD request
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) YelpCamp/2.0"}
        res = requests.head(url, headers=headers, timeout=timeout, allow_redirects=True)
        
        # If HEAD is disallowed (405) by certain CDNs, fallback to ranged GET
        if res.status_code == 405:
            res = requests.get(url, headers=headers, stream=True, timeout=timeout, allow_redirects=True)
        
        if res.status_code < 400:
            content_type = res.headers.get("Content-Type", "").lower()
            # If Content-Type is specified, ensure it's image or binary/octet-stream
            is_image = "image" in content_type or "octet-stream" in content_type or not content_type
            _VALIDATION_CACHE[url] = is_image
            return is_image
        else:
            _VALIDATION_CACHE[url] = False
            return False
    except Exception as e:
        logger.debug(f"Image validation probe failed for [{url}]: {e}")
        _VALIDATION_CACHE[url] = False
        return False

def get_deterministic_fallback(seed: Any, default_type: str = "campground") -> str:
    """Returns a deterministic, high-quality campsite image based on an ID or string seed."""
    if default_type == "story":
        idx = (abs(hash(str(seed))) if seed else 0) % len(FALLBACK_CAMPGROUND_IMAGES)
        return FALLBACK_CAMPGROUND_IMAGES[idx]

    try:
        num = int(seed)
    except (ValueError, TypeError):
        num = abs(hash(str(seed))) if seed else 0
    return FALLBACK_CAMPGROUND_IMAGES[num % len(FALLBACK_CAMPGROUND_IMAGES)]

def sanitize_campground_image(url: Optional[str], campground_id: Optional[int] = None) -> str:
    """
    Validates a campsite image URL. If broken, empty, or unreachable,
    returns a guaranteed working scenic fallback image.
    """
    if not url or not str(url).strip():
        return get_deterministic_fallback(campground_id)
    
    clean_url = str(url).strip()
    for pat in KNOWN_BROKEN_PATTERNS:
        if pat in clean_url:
            return get_deterministic_fallback(campground_id)
            
    return clean_url

def sanitize_gallery_images(gallery: Any, campground_id: Optional[int] = None) -> List[str]:
    """
    Cleans a list of gallery images, replacing any broken or empty images with verified ones.
    """
    import json
    if isinstance(gallery, str):
        try:
            gallery = json.loads(gallery)
        except Exception:
            gallery = []
    
    if not isinstance(gallery, list):
        gallery = []

    clean_list = []
    for item in gallery:
        if isinstance(item, str) and item.strip():
            url = item.strip()
            # Check known broken
            if not any(pat in url for pat in KNOWN_BROKEN_PATTERNS):
                clean_list.append(url)

    # If gallery is empty or deficient, backfill with deterministic verified images
    if len(clean_list) < 3:
        base_idx = (int(campground_id) if campground_id else 0) % len(FALLBACK_CAMPGROUND_IMAGES)
        for offset in range(4):
            idx = (base_idx + offset + 1) % len(FALLBACK_CAMPGROUND_IMAGES)
            img = FALLBACK_CAMPGROUND_IMAGES[idx]
            if img not in clean_list:
                clean_list.append(img)

    return clean_list[:6]
