import os
import logging
from contextlib import contextmanager
from sqlalchemy import inspect, event
from sqlmodel import create_engine, SQLModel, Session
from app.core.config import settings
from app.core.turso_engine import TursoConnection

logger = logging.getLogger(__name__)

if settings.USE_TURSO and settings.TURSO_AUTH_TOKEN and settings.TURSO_DATABASE_URL:
    engine = create_engine(
        "sqlite://",
        creator=lambda: TursoConnection(settings.TURSO_DATABASE_URL, settings.TURSO_AUTH_TOKEN),
        echo=False
    )
else:
    connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
    engine = create_engine(settings.DATABASE_URL, echo=False, connect_args=connect_args)

# Enforce SQLite foreign key cascades across all engine connections
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.close()
    except Exception as e:
        logger.debug(f"Could not set PRAGMA foreign_keys on connection: {e}")

SQL_TRIGGERS = [
    # 1. Auto-update Campground.avg_rating whenever a root review is inserted
    """
    CREATE TRIGGER IF NOT EXISTS trg_comment_rating_ai
    AFTER INSERT ON comment
    WHEN NEW.campground_id IS NOT NULL AND NEW.rating IS NOT NULL AND NEW.parent_comment_id IS NULL
    BEGIN
        UPDATE campground
        SET avg_rating = COALESCE((
            SELECT ROUND(AVG(rating), 1)
            FROM comment
            WHERE campground_id = NEW.campground_id AND rating IS NOT NULL AND parent_comment_id IS NULL
        ), 0.0)
        WHERE id = NEW.campground_id;
    END;
    """,
    # 2. Auto-update Campground.avg_rating whenever a root review is deleted
    """
    CREATE TRIGGER IF NOT EXISTS trg_comment_rating_ad
    AFTER DELETE ON comment
    WHEN OLD.campground_id IS NOT NULL AND OLD.rating IS NOT NULL AND OLD.parent_comment_id IS NULL
    BEGIN
        UPDATE campground
        SET avg_rating = COALESCE((
            SELECT ROUND(AVG(rating), 1)
            FROM comment
            WHERE campground_id = OLD.campground_id AND rating IS NOT NULL AND parent_comment_id IS NULL
        ), 0.0)
        WHERE id = OLD.campground_id;
    END;
    """,
    # 3. Auto-update Campground.avg_rating whenever a review rating is updated
    """
    CREATE TRIGGER IF NOT EXISTS trg_comment_rating_au
    AFTER UPDATE OF rating ON comment
    WHEN NEW.campground_id IS NOT NULL AND NEW.parent_comment_id IS NULL
    BEGIN
        UPDATE campground
        SET avg_rating = COALESCE((
            SELECT ROUND(AVG(rating), 1)
            FROM comment
            WHERE campground_id = NEW.campground_id AND rating IS NOT NULL AND parent_comment_id IS NULL
        ), 0.0)
        WHERE id = NEW.campground_id;
    END;
    """,
    # 4. Auto-sync FTS5 index on Campground INSERT
    """
    CREATE TRIGGER IF NOT EXISTS trg_campground_fts_ai AFTER INSERT ON campground BEGIN
        INSERT INTO campground_fts(rowid, title, description, location, location_address, amenities, ai_media_caption)
        VALUES (new.id, new.title, new.description, new.location, new.location_address, new.amenities, new.ai_media_caption);
    END;
    """,
    # 5. Auto-sync FTS5 index on Campground UPDATE
    """
    CREATE TRIGGER IF NOT EXISTS trg_campground_fts_au AFTER UPDATE ON campground BEGIN
        INSERT INTO campground_fts(campground_fts, rowid, title, description, location, location_address, amenities, ai_media_caption)
        VALUES ('delete', old.id, old.title, old.description, old.location, old.location_address, old.amenities, old.ai_media_caption);
        INSERT INTO campground_fts(rowid, title, description, location, location_address, amenities, ai_media_caption)
        VALUES (new.id, new.title, new.description, new.location, new.location_address, new.amenities, new.ai_media_caption);
    END;
    """,
    # 6. Auto-sync FTS5 index on Campground DELETE
    """
    CREATE TRIGGER IF NOT EXISTS trg_campground_fts_ad AFTER DELETE ON campground BEGIN
        INSERT INTO campground_fts(campground_fts, rowid, title, description, location, location_address, amenities, ai_media_caption)
        VALUES ('delete', old.id, old.title, old.description, old.location, old.location_address, old.amenities, old.ai_media_caption);
    END;
    """
]

def init_database_triggers(target_engine=None):
    """Applies SQL triggers for automatic rating calculations and FTS synchronization."""
    eng = target_engine or engine
    with eng.connect() as con:
        for trg in SQL_TRIGGERS:
            try:
                con.exec_driver_sql(trg)
            except Exception as e:
                logger.debug(f"Trigger creation notice: {e}")
        con.commit()
    logger.info("[Database Triggers] Successfully verified SQLite triggers.")

create_sqlite_triggers = init_database_triggers

_schema_initialized = False

def apply_migrations():
    """
    Applies Alembic schema migrations:
    1. Inspects existing database tables.
    2. If tables (e.g. 'user' or 'campground') already exist but 'alembic_version' is missing,
       it stamps 'head' to baseline the existing database without table collision errors.
    3. If 'alembic_version' is present or database is fresh, it runs 'upgrade head' to bring schema up to date.
    4. Initializes database extensions (FTS5 virtual tables and Turso DiskANN vector indices).
    5. Registers native database triggers for rating calculations and FTS5 synchronization.
    """
    global _schema_initialized
    if _schema_initialized:
        return
    _schema_initialized = True

    try:
        from alembic.config import Config
        from alembic import command

        backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        alembic_ini_path = os.path.join(backend_root, "alembic.ini")
        if not os.path.exists(alembic_ini_path):
            alembic_ini_path = "alembic.ini"
            
        alembic_cfg = Config(alembic_ini_path)

        with engine.connect() as conn:
            inspector = inspect(conn)
            table_names = inspector.get_table_names()

            if "alembic_version" not in table_names and ("user" in table_names or "campground" in table_names):
                logger.info("[Alembic] Baseline tables detected without alembic_version. Stamping 'head'...")
                command.stamp(alembic_cfg, "head")
            else:
                logger.info("[Alembic] Upgrading schema to 'head'...")
                command.upgrade(alembic_cfg, "head")
    except Exception as e:
        logger.warning(f"[Alembic] Migration notice: {e}. Ensuring schema with metadata fallback.")
        try:
            from app.models import SQLModel
            SQLModel.metadata.create_all(engine)
        except Exception as ce:
            logger.debug(f"[Alembic] Fallback create_all notice: {ce}")

    # Synchronize database-specific extensions (SQLite FTS5, Turso DiskANN vector indices, seed actions)
    try:
        from app.core.turso_engine import init_turso_extensions_and_fts
        init_turso_extensions_and_fts()
    except Exception as e:
        logger.warning(f"Error during Turso extensions & FTS init: {e}")

    # Synchronize native SQLite triggers
    try:
        init_database_triggers()
    except Exception as e:
        logger.warning(f"Error during SQL triggers init: {e}")

# Backward-compatible alias
create_db_and_tables = apply_migrations

def get_session():
    with Session(engine) as session:
        yield session

@contextmanager
def get_db_connection():
    """Provides a connection from the configured SQLModel engine."""
    with engine.connect() as conn:
        yield conn
