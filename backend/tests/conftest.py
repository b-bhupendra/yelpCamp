import os
import sys
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import event

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["ENV_FILE"] = ".env.test"
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["USE_TURSO"] = "False"
os.environ["RATE_LIMIT_ENABLED"] = "False"

from app.main import app
from app.api.deps import get_db
from app.core.database import create_sqlite_triggers
from app.models.user import User
from app.core.security import get_password_hash, create_access_token

TEST_DB_FILE = "./test.db"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create all tables and SQLite triggers once for the test session."""
    SQLModel.metadata.create_all(test_engine)
    create_sqlite_triggers(test_engine)
    yield
    SQLModel.metadata.drop_all(test_engine)
    test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass

@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a transactional database session per test function."""
    with Session(test_engine) as session:
        yield session

@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient with get_db overridden to use test_engine."""
    def override_get_db():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db_session: Session) -> User:
    """Fixture providing a saved test user in the test database."""
    username = "testexplorer"
    user = db_session.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            hashed_password=get_password_hash("SecretPass123!"),
            avatar_url="https://images.unsplash.com/photo-test.jpg"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return user

@pytest.fixture
def auth_headers(test_user: User) -> dict:
    """Fixture providing Bearer authorization headers for test_user."""
    token = create_access_token({"sub": str(test_user.id), "username": test_user.username})
    return {"Authorization": f"Bearer {token}"}
