import logging
import base64
import time
import requests
from typing import Any, List, Optional, Sequence, Tuple, Union, Dict
from app.core.config import settings

logger = logging.getLogger(__name__)

def to_turso_arg(val: Any) -> Dict[str, Any]:
    if val is None:
        return {"type": "null"}
    elif isinstance(val, bool):
        return {"type": "integer", "value": "1" if val else "0"}
    elif isinstance(val, int):
        return {"type": "integer", "value": str(val)}
    elif isinstance(val, float):
        return {"type": "float", "value": val}
    elif isinstance(val, (bytes, bytearray)):
        return {"type": "blob", "base64": base64.b64encode(val).decode("ascii")}
    else:
        return {"type": "text", "value": str(val)}

def from_turso_cell(cell: Dict[str, Any]) -> Any:
    t = cell.get("type")
    if t == "null":
        return None
    elif t == "integer":
        return int(cell.get("value"))
    elif t == "float":
        return float(cell.get("value"))
    elif t == "blob":
        b64 = cell.get("base64", "")
        return base64.b64decode(b64)
    else:
        return cell.get("value")

def execute_turso_raw(sql: str, params: Optional[Sequence[Any]] = None) -> Dict[str, Any]:
    """Execute raw SQL statement against Turso Cloud using HTTP v2 pipeline."""
    if not settings.TURSO_DATABASE_URL or not settings.TURSO_AUTH_TOKEN:
        raise ValueError("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in environment to execute Turso queries.")
    url = f"{settings.TURSO_DATABASE_URL.rstrip('/')}/v2/pipeline"
    headers = {
        "Authorization": f"Bearer {settings.TURSO_AUTH_TOKEN}",
        "Content-Type": "application/json"
    }

    stmt: Dict[str, Any] = {"sql": sql}
    if params:
        stmt["args"] = [to_turso_arg(p) for p in params]

    payload = {
        "requests": [
            {"type": "execute", "stmt": stmt}
        ]
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    result = data["results"][0]
    if result.get("type") == "error":
        raise RuntimeError(f"Turso error: {result.get('error', {}).get('message', 'Unknown error')}")
    return result.get("response", {}).get("result", {})


def init_turso_extensions_and_fts():
    """
    Synchronizes engine-specific database extensions outside standard relational migrations:
    1. Synchronizes SQLite FTS5 virtual table campground_fts for BM25 search.
    2. Synchronizes Turso DiskANN vector columns (F32_BLOB) and libsql_vector_idx indexes.
    3. Seeds default UI Navigation descriptors for the AI Side Assistant.
    """
    logger.info("[Meadows Extensions] Starting FTS5, vector extensions & UI navigation sync...")

    extension_statements = [
        # 1. FTS5 Virtual Table for BM25 keyword matching
        ("""
        CREATE VIRTUAL TABLE IF NOT EXISTS campground_fts USING fts5(
            title, description, location, location_address, amenities, ai_media_caption,
            content='campground', content_rowid='id'
        )
        """, "create_campground_fts"),
        ("INSERT INTO campground_fts(campground_fts) VALUES('rebuild')", "rebuild_campground_fts"),
    ]

    # Apply extensions to local SQLite database if configured
    try:
        from app.core.database import engine
        with engine.connect() as con:
            for sql, label in extension_statements:
                try:
                    con.exec_driver_sql(sql)
                except Exception as e:
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        logger.debug(f"Local SQLite extension notice on {label}: {e}")
            con.commit()
            logger.info("[Meadows Extensions] Local SQLite extensions verified.")
    except Exception as e:
        logger.warning(f"Local SQLite extension error: {e}")

    # Apply to Turso Cloud if configured
    if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
        logger.info("[Meadows Extensions] Applying Turso Cloud vector DDL & FTS...")
        for sql, label in extension_statements:
            try:
                execute_turso_raw(sql)
            except Exception as e:
                if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                    logger.debug(f"Turso extension notice on {label}: {e}")

        # Turso-specific Vector column & DiskANN indexes
        turso_vector_ddl = [
            ("ALTER TABLE campground ADD COLUMN embedding F32_BLOB(768)", "campground.embedding"),
            ("ALTER TABLE visitor_photos ADD COLUMN embedding F32_BLOB(768)", "visitor_photos.embedding"),
            ("ALTER TABLE ui_navigation ADD COLUMN embedding F32_BLOB(768)", "ui_navigation.embedding"),
            ("CREATE INDEX IF NOT EXISTS idx_campground_vec ON campground (libsql_vector_idx(embedding))", "idx_campground_vec"),
            ("CREATE INDEX IF NOT EXISTS idx_stories_vec ON visitor_photos (libsql_vector_idx(embedding))", "idx_stories_vec"),
            ("CREATE INDEX IF NOT EXISTS idx_ui_nav_vec ON ui_navigation (libsql_vector_idx(embedding))", "idx_ui_nav_vec"),
        ]
        for sql, label in turso_vector_ddl:
            try:
                execute_turso_raw(sql)
            except Exception as e:
                if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                    logger.debug(f"Turso vector DDL notice on {label}: {e}")

        logger.info("[Meadows Extensions] Turso Cloud schema and vector indexes verified.")

    # Seed UI Navigation entries if empty
    seed_ui_navigation()

init_turso_schema_and_fts = init_turso_extensions_and_fts

def seed_ui_navigation():
    """Seed UI Navigation descriptors for the AI Side Assistant."""
    core_actions = [
        ("upload_story", "Upload Visitor Story", "/campgrounds", "#btn-upload-story", "Post a 24-hour campsite photo or visitor moment with caption and scenery tags."),
        ("share_property", "Share Campsite", "/campgrounds", "#btn-share-property", "Open the one-click share suite to copy direct link, share on WhatsApp, or generate dynamic QR code."),
        ("add_campsite", "Host New Campsite", "/campgrounds/new", "#btn-new-campground", "Create and list a new campground with multi-image gallery, amenities, and house rules."),
        ("explore_campsites", "Explore Trails & Campsites", "/campgrounds", "#nav-explore", "Browse all curated campsites with pricing, rating filters, and location tags."),
        ("campsite_reviews", "Read & Post Reviews", "/campgrounds", "#reviews-section", "Read traveler experiences and leave a rating or reply to guest tips.")
    ]

    try:
        from app.core.database import engine
        with engine.connect() as con:
            for act_id, name, route, sel, desc in core_actions:
                con.exec_driver_sql("""
                    INSERT OR IGNORE INTO ui_navigation (id, feature_name, route, dom_selector, description)
                    VALUES (?, ?, ?, ?, ?)
                """, (act_id, name, route, sel, desc))
            con.commit()
    except Exception as e:
        logger.debug(f"UI nav local seed notice: {e}")

    if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
        for act_id, name, route, sel, desc in core_actions:
            try:
                execute_turso_raw("""
                    INSERT OR IGNORE INTO ui_navigation (id, feature_name, route, dom_selector, description)
                    VALUES (?, ?, ?, ?, ?)
                """, [act_id, name, route, sel, desc])
            except Exception as e:
                logger.debug(f"UI nav Turso seed notice: {e}")

