import os
import logging
from contextlib import contextmanager
from sqlalchemy import inspect
from sqlmodel import create_engine, SQLModel, Session
from config import settings
from turso_engine import TursoConnection

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

_schema_initialized = False

def apply_migrations():
    """
    Applies Alembic schema migrations:
    1. Inspects existing database tables.
    2. If tables (e.g. 'user' or 'campground') already exist but 'alembic_version' is missing,
       it stamps 'head' to baseline the existing database without table collision errors.
    3. If 'alembic_version' is present or database is fresh, it runs 'upgrade head' to bring schema up to date.
    4. Initializes database extensions (FTS5 virtual tables and Turso DiskANN vector indices).
    """
    global _schema_initialized
    if _schema_initialized:
        return
    _schema_initialized = True

    try:
        from alembic.config import Config
        from alembic import command

        alembic_ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
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
            SQLModel.metadata.create_all(engine)
        except Exception as ce:
            logger.debug(f"[Alembic] Fallback create_all notice: {ce}")

    # Synchronize database-specific extensions (SQLite FTS5, Turso DiskANN vector indices, seed actions)
    try:
        from turso_engine import init_turso_extensions_and_fts
        init_turso_extensions_and_fts()
    except Exception as e:
        logger.warning(f"Error during Turso extensions & FTS init: {e}")

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
