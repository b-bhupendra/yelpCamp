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
        if not seq_of_params:
            self.rowcount = 0
            return self

        requests_list = []
        for params in seq_of_params:
            clean_args = []
            if params is not None:
                if isinstance(params, (tuple, list)):
                    clean_args = [to_turso_arg(p) for p in params]
                elif isinstance(params, dict):
                    stmt_named: Dict[str, Any] = {
                        "sql": sql,
                        "named_args": [{"name": k, "value": to_turso_arg(v)} for k, v in params.items()]
                    }
                    requests_list.append({"type": "execute", "stmt": stmt_named})
                    continue
                else:
                    clean_args = [to_turso_arg(params)]

            stmt = {"sql": sql}
            if clean_args:
                stmt["args"] = clean_args
            requests_list.append({"type": "execute", "stmt": stmt})

        payload = {"requests": requests_list}
        self._send_payload(payload)
        self.rowcount = len(seq_of_params)
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
        if self.in_transaction:
            try:
                execute_turso_raw("COMMIT")
            except Exception:
                pass
            self.in_transaction = False

    def rollback(self):
        if self.in_transaction:
            try:
                execute_turso_raw("ROLLBACK")
            except Exception:
                pass
            self.in_transaction = False

    def close(self):
        self.session.close()

    def create_function(self, *args, **kwargs):
        pass

    def create_collation(self, *args, **kwargs):
        pass


def init_turso_extensions_and_fts():
    """
    Synchronizes engine-specific database extensions outside standard relational migrations:
    1. Synchronizes SQLite FTS5 virtual table campground_fts for BM25 search.
    2. Synchronizes Turso DiskANN vector columns (F32_BLOB) and libsql_vector_idx indexes.
    3. Seeds default UI Navigation descriptors for the AI Side Assistant.
    """
    logger.info("[YelpCamp Extensions] Starting FTS5, vector extensions & UI navigation sync...")

    extension_statements = [
        # 1. Sync title from name if title is empty
        ("UPDATE campground SET title = name WHERE (title IS NULL OR title = '') AND (name IS NOT NULL AND name != '')", "sync_title"),

        # 2. FTS5 Virtual Table for BM25 keyword matching
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
        from database import engine
        with engine.connect() as con:
            for sql, label in extension_statements:
                try:
                    con.exec_driver_sql(sql)
                except Exception as e:
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        logger.debug(f"Local SQLite extension notice on {label}: {e}")
            con.commit()
            logger.info("[YelpCamp Extensions] Local SQLite extensions verified.")
    except Exception as e:
        logger.warning(f"Local SQLite extension error: {e}")

    # Apply to Turso Cloud if configured
    if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN:
        logger.info("[YelpCamp Extensions] Applying Turso Cloud vector DDL & FTS...")
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

        logger.info("[YelpCamp Extensions] Turso Cloud schema and vector indexes verified.")

    # Seed UI Navigation entries if empty
    seed_ui_navigation()

# Backward-compatibility alias
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
        from database import engine
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
