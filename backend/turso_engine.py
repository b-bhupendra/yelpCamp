import logging
import base64
import requests
from typing import Any, List, Optional, Sequence, Tuple, Union, Dict
from config import settings

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

class TursoCursor:
    def __init__(self, session: requests.Session, url: str, token: str):
        self.session = session
        self.url = f"{url.rstrip('/')}/v2/pipeline"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        self.description: Optional[List[Tuple[str, None, None, None, None, None, None]]] = None
        self.rowcount: int = -1
        self.lastrowid: Optional[int] = None
        self._rows: List[Any] = []
        self._idx: int = 0
        self.arraysize: int = 1

    def execute(self, sql: str, params: Optional[Union[Sequence[Any], dict]] = None):
        clean_args = []
        if params is not None:
            if isinstance(params, (tuple, list)):
                clean_args = [to_turso_arg(p) for p in params]
            elif isinstance(params, dict):
                # SQLite named params
                stmt_named: Dict[str, Any] = {
                    "sql": sql,
                    "named_args": [{"name": k, "value": to_turso_arg(v)} for k, v in params.items()]
                }
                payload = {"requests": [{"type": "execute", "stmt": stmt_named}]}
                return self._send_payload(payload)
            else:
                clean_args = [to_turso_arg(params)]

        stmt = {"sql": sql}
        if clean_args:
            stmt["args"] = clean_args

        payload = {"requests": [{"type": "execute", "stmt": stmt}]}
        return self._send_payload(payload)

    def _send_payload(self, payload: dict):
        last_exc = None
        for attempt in range(3):
            try:
                resp = self.session.post(self.url, json=payload, headers=self.headers, timeout=30)
                resp.raise_for_status()
                data = resp.json()
                item = data["results"][0]
                if item.get("type") == "error":
                    err_msg = item.get("error", {}).get("message", "Unknown Turso DB error")
                    raise RuntimeError(err_msg)

                res = item.get("response", {}).get("result", {})
                cols = res.get("cols", [])
                raw_rows = res.get("rows", [])

                if cols:
                    self.description = [(c["name"], None, None, None, None, None, None) for c in cols]
                    parsed_rows = []
                    for r in raw_rows:
                        parsed_rows.append(tuple(from_turso_cell(cell) for cell in r))
                    self._rows = parsed_rows
                    self._idx = 0
                    self.rowcount = len(self._rows)
                else:
                    self.description = None
                    self._rows = []
                    self._idx = 0
                    self.rowcount = res.get("affected_row_count", 0)

                self.lastrowid = res.get("last_insert_rowid")
                return self
            except (requests.exceptions.ReadTimeout, requests.exceptions.ConnectionError) as e:
                last_exc = e
                if attempt == 2:
                    raise last_exc
                time.sleep(0.8)
        if last_exc:
            raise last_exc
        return self

    def executemany(self, sql: str, seq_of_params: Sequence[Any]):
        count = 0
        for p in seq_of_params:
            self.execute(sql, p)
            if self.rowcount > 0:
                count += self.rowcount
        self.rowcount = count
        return self

    def fetchone(self):
        if self._idx < len(self._rows):
            row = self._rows[self._idx]
            self._idx += 1
            return row
        return None

    def fetchmany(self, size: Optional[int] = None):
        if size is None:
            size = self.arraysize
        end = min(self._idx + size, len(self._rows))
        rows = self._rows[self._idx:end]
        self._idx = end
        return rows

    def fetchall(self):
        rows = self._rows[self._idx:]
        self._idx = len(self._rows)
        return rows

    def close(self):
        self._rows = []
        self._idx = 0

class TursoConnection:
    def __init__(self, url: str, token: str):
        self.session = requests.Session()
        self.url = url
        self.token = token
        self.isolation_level = None
        self.autocommit = True
        self.in_transaction = False

    def cursor(self):
        return TursoCursor(self.session, self.url, self.token)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        self.session.close()

    def create_function(self, *args, **kwargs):
        pass

    def create_collation(self, *args, **kwargs):
        pass


def init_turso_schema_and_fts():
    """
    Idempotent schema initialization for Turso libSQL and SQLite:
    1. Synchronizes Campground columns (title, gallery_images, amenities, rules, etc.)
    2. Synchronizes Comment columns (parent_comment_id, rating)
    3. Creates visitor_photos and visitor_photo_likes tables
    4. Adds F32_BLOB(768) vector columns and DiskANN indexes
    5. Creates SQLite FTS5 virtual table campground_fts
    6. Creates and seeds ui_navigation table for AI Agent
    """
    import sqlite3
    logger.info("[YelpCamp Migration] Starting schema & FTS5 initialization...")

    ddl_statements = [
        # 1. Campground columns
        ("ALTER TABLE campground ADD COLUMN title TEXT DEFAULT ''", "campground.title"),
        ("ALTER TABLE campground ADD COLUMN location TEXT DEFAULT ''", "campground.location"),
        ("ALTER TABLE campground ADD COLUMN location_address TEXT DEFAULT ''", "campground.location_address"),
        ("ALTER TABLE campground ADD COLUMN gallery_images TEXT DEFAULT '[]'", "campground.gallery_images"),
        ("ALTER TABLE campground ADD COLUMN amenities TEXT DEFAULT '[]'", "campground.amenities"),
        ("ALTER TABLE campground ADD COLUMN rules TEXT DEFAULT ''", "campground.rules"),
        ("ALTER TABLE campground ADD COLUMN avg_rating REAL DEFAULT 0.0", "campground.avg_rating"),
        ("ALTER TABLE campground ADD COLUMN ai_media_caption TEXT DEFAULT ''", "campground.ai_media_caption"),
        ("ALTER TABLE campground ADD COLUMN community_summary TEXT DEFAULT ''", "campground.community_summary"),
        
        # 2. Sync title from name if title is empty
        ("UPDATE campground SET title = name WHERE (title IS NULL OR title = '') AND (name IS NOT NULL AND name != '')", "sync_title"),

        # 3. Comment columns
        ("ALTER TABLE comment ADD COLUMN parent_comment_id INTEGER", "comment.parent_comment_id"),
        ("ALTER TABLE comment ADD COLUMN rating INTEGER", "comment.rating"),
        ("ALTER TABLE comment ADD COLUMN created_at TEXT DEFAULT ''", "comment.created_at"),
        ("ALTER TABLE comment ADD COLUMN photo_id INTEGER", "comment.photo_id"),

        # 4. Visitor Photos table
        ("""
        CREATE TABLE IF NOT EXISTS visitor_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campground_id INTEGER NOT NULL REFERENCES campground(id),
            user_id INTEGER NOT NULL REFERENCES user(id),
            user_username TEXT NOT NULL,
            user_avatar TEXT,
            media_type TEXT DEFAULT 'photo',
            image_url TEXT NOT NULL,
            caption TEXT DEFAULT '',
            ai_tags TEXT DEFAULT '[]',
            ai_media_caption TEXT DEFAULT '',
            likes_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            expires_at INTEGER
        )
        """, "create_visitor_photos"),
        ("CREATE INDEX IF NOT EXISTS idx_visitor_photos_camp ON visitor_photos (campground_id)", "idx_vp_camp"),
        ("CREATE INDEX IF NOT EXISTS idx_visitor_photos_expires ON visitor_photos (expires_at)", "idx_vp_expires"),

        # 5. Visitor Photo Likes table
        ("""
        CREATE TABLE IF NOT EXISTS visitor_photo_likes (
            user_id INTEGER NOT NULL REFERENCES user(id),
            photo_id INTEGER NOT NULL REFERENCES visitor_photos(id),
            PRIMARY KEY (user_id, photo_id)
        )
        """, "create_visitor_photo_likes"),

        # 6. FTS5 Virtual Table for BM25 keyword matching
        ("""
        CREATE VIRTUAL TABLE IF NOT EXISTS campground_fts USING fts5(
            title, description, location, location_address, amenities, ai_media_caption,
            content='campground', content_rowid='id'
        )
        """, "create_campground_fts"),
        ("INSERT INTO campground_fts(campground_fts) VALUES('rebuild')", "rebuild_campground_fts"),

        # 7. UI Navigation Map Table
        ("""
        CREATE TABLE IF NOT EXISTS ui_navigation (
            id TEXT PRIMARY KEY,
            feature_name TEXT NOT NULL,
            route TEXT NOT NULL,
            dom_selector TEXT NOT NULL,
            description TEXT NOT NULL
        )
        """, "create_ui_navigation")
    ]

    # Apply to local SQLite database if database.db exists
    try:
        con = sqlite3.connect("database.db")
        cur = con.cursor()
        for sql, label in ddl_statements:
            try:
                cur.execute(sql)
            except Exception as e:
                # Column may already exist or virtual table already created
                if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                    logger.debug(f"Local SQLite DDL notice on {label}: {e}")
        con.commit()
        con.close()
        logger.info("[YelpCamp Migration] Local SQLite schema verified.")
    except Exception as e:
        logger.warning(f"Local SQLite migration error: {e}")

    # Apply to Turso Cloud if configured
    if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
        logger.info("[YelpCamp Migration] Applying Turso Cloud schema & vector DDL...")
        for sql, label in ddl_statements:
            try:
                execute_turso_raw(sql)
            except Exception as e:
                if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                    logger.debug(f"Turso DDL notice on {label}: {e}")

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

        logger.info("[YelpCamp Migration] Turso Cloud schema and vector indexes verified.")

    # Seed UI Navigation entries if empty
    seed_ui_navigation()

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
        con = sqlite3.connect("database.db")
        cur = con.cursor()
        for act_id, name, route, sel, desc in core_actions:
            cur.execute("""
                INSERT OR IGNORE INTO ui_navigation (id, feature_name, route, dom_selector, description)
                VALUES (?, ?, ?, ?, ?)
            """, (act_id, name, route, sel, desc))
        con.commit()
        con.close()
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
