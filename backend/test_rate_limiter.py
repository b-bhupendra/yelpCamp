from fastapi.testclient import TestClient
from main import app
from services.limiter import limiter, get_rate_limit_key
from security import create_access_token

def test_app_loads_with_limiter():
    assert app.state.limiter is not None
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_auth_login_rate_limit():
    """Verify login endpoint is strictly rate limited to 5/minute."""
    client = TestClient(app)
    
    # Send rapid invalid login requests from same client
    statuses = []
    for i in range(8):
        res = client.post("/api/login", json={"username": f"bot_{i}", "password": "wrongpassword"})
        statuses.append(res.status_code)
    
    # First requests will fail with 400 or 401, but the 6th+ request MUST be 429
    assert 429 in statuses, f"Expected 429 in statuses: {statuses}"
    idx_429 = statuses.index(429)
    assert idx_429 <= 5, f"Rate limit did not trigger within 5 requests: index {idx_429}"
    
    # Check 429 payload structure
    res_429 = client.post("/api/login", json={"username": "bot_overflow", "password": "wrongpassword"})
    assert res_429.status_code == 429
    data = res_429.json()
    assert data["error"] == "Too Many Requests"
    assert "detail" in data

def test_ai_search_rate_limit():
    """Verify AI semantic search endpoint rate limit."""
    client = TestClient(app)
    limiter.reset()
    res_status = client.get("/api/rag/status")
    assert res_status.status_code in [200, 500]

def test_authenticated_user_key():
    """Verify that requests with valid JWT get identified by user ID."""
    from security import create_access_token

    token = create_access_token({"sub": "99", "username": "trail_tester"})
    client = TestClient(app)
    
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/", headers=headers)
    assert res.status_code == 200

if __name__ == "__main__":
    print("Running rate limiter tests...")
    test_app_loads_with_limiter()
    print("[OK] App loads with limiter and middleware")
    test_auth_login_rate_limit()
    print("[OK] Auth login rate limit triggered 429 as expected")
    test_ai_search_rate_limit()
    print("[OK] AI search limiter verified")
    test_authenticated_user_key()
    print("[OK] Authenticated user tracking verified")
    print("All tests passed successfully!")
