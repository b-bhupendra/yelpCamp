from contextlib import contextmanager
from sqlmodel import create_engine, SQLModel, Session
from config import settings
from turso_engine import TursoConnection

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

def create_db_and_tables():
    global _schema_initialized
    if _schema_initialized:
        return
    _schema_initialized = True
    try:
        SQLModel.metadata.create_all(engine)
    except Exception as e:
        import logging
        logging.getLogger(__name__).debug(f"SQLModel create_all notice: {e}")
    try:
        from turso_engine import init_turso_schema_and_fts
        init_turso_schema_and_fts()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Error during Turso schema & FTS init: {e}")

def get_session():
    with Session(engine) as session:
        yield session

@contextmanager
def get_db_connection():
    """Provides a connection from the configured SQLModel engine."""
    with engine.connect() as conn:
        yield conn
