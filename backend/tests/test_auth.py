import uuid
from fastapi.testclient import TestClient
from app.models.user import User

def test_register_success(client: TestClient):
    unique_user = f"scout_{uuid.uuid4().hex[:8]}"
    response = client.post(
        "/api/register",
        json={"username": unique_user, "password": "SecurePassword123!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == unique_user
    assert "access_token" in response.cookies

def test_register_duplicate_username(client: TestClient):
    unique_user = f"scout_{uuid.uuid4().hex[:8]}"
    client.post("/api/register", json={"username": unique_user, "password": "Password123!"})
    dup_res = client.post("/api/register", json={"username": unique_user, "password": "Password123!"})
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()

def test_login_success(client: TestClient):
    unique_user = f"scout_{uuid.uuid4().hex[:8]}"
    password = "MyPassword456!"
    client.post("/api/register", json={"username": unique_user, "password": password})

    login_res = client.post("/api/login", json={"username": unique_user, "password": password})
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["user"]["username"] == unique_user

def test_login_invalid_password(client: TestClient):
    unique_user = f"scout_{uuid.uuid4().hex[:8]}"
    client.post("/api/register", json={"username": unique_user, "password": "CorrectPassword!"})

    bad_login = client.post("/api/login", json={"username": unique_user, "password": "WrongPassword!"})
    assert bad_login.status_code == 401
    assert "invalid" in bad_login.json()["detail"].lower()

def test_get_me_authenticated(client: TestClient, auth_headers: dict, test_user: User):
    res = client.get("/api/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["id"] == test_user.id
    assert data["user"]["username"] == test_user.username

def test_get_me_unauthenticated(client: TestClient):
    res = client.get("/api/me")
    assert res.status_code == 401
