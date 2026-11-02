from fastapi.testclient import TestClient
from app.models.user import User

def test_list_campgrounds(client: TestClient):
    response = client.get("/api/v1/campgrounds")
    assert response.status_code == 200
    data = response.json()
    assert "campgrounds" in data
    assert "total" in data
    assert "page" in data
    assert "pages" in data
    assert isinstance(data["campgrounds"], list)

def test_create_campground_authenticated(client: TestClient, auth_headers: dict, test_user: User):
    camp_payload = {
        "title": "Emerald Ridge Pine Haven",
        "price": 38.5,
        "description": "Quiet sanctuary nestled in alpine pines with clear mountain springs.",
        "location": "Banff, Alberta",
        "location_address": "Banff National Park, AB, Canada",
        "latitude": 51.1784,
        "longitude": -115.5708,
        "image": "https://images.unsplash.com/photo-pine.jpg",
        "amenities": ["campfire", "potable_water", "tent_pitches"],
        "tags": ["mountain", "forest", "peaceful"]
    }
    response = client.post("/api/v1/campgrounds", json=camp_payload, headers=auth_headers)
    assert response.status_code == 201
    created = response.json()
    assert created["title"] == "Emerald Ridge Pine Haven"
    assert created["price"] == 38.5
    assert created["author_id"] == test_user.id
    assert created["author_username"] == test_user.username
    assert "id" in created

    # Verify retrieval
    get_res = client.get(f"/api/v1/campgrounds/{created['id']}")
    assert get_res.status_code == 200
    retrieved = get_res.json()
    assert retrieved["id"] == created["id"]
    assert retrieved["title"] == "Emerald Ridge Pine Haven"

def test_create_campground_unauthenticated(client: TestClient):
    camp_payload = {
        "title": "Unauthorized Camp",
        "price": 20.0,
        "description": "This should fail authentication.",
        "location": "Nowhere"
    }
    response = client.post("/api/v1/campgrounds", json=camp_payload)
    assert response.status_code == 401

def test_update_and_delete_campground(client: TestClient, auth_headers: dict):
    # 1. Create campsite
    create_res = client.post(
        "/api/v1/campgrounds",
        json={
            "title": "Temporary Meadow Camp",
            "price": 25.0,
            "description": "A quiet meadow spot.",
            "location": "Yosemite, CA"
        },
        headers=auth_headers
    )
    assert create_res.status_code == 201
    camp_id = create_res.json()["id"]

    # 2. Update campsite
    update_res = client.put(
        f"/api/v1/campgrounds/{camp_id}",
        json={"title": "Updated Meadow Camp", "price": 32.0},
        headers=auth_headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Updated Meadow Camp"
    assert update_res.json()["price"] == 32.0

    # 3. Delete campsite
    delete_res = client.delete(f"/api/v1/campgrounds/{camp_id}", headers=auth_headers)
    assert delete_res.status_code == 200
    assert delete_res.json()["id"] == camp_id

    # 4. Verify 404
    verify_res = client.get(f"/api/v1/campgrounds/{camp_id}")
    assert verify_res.status_code == 404

def test_campgrounds_pagination(client: TestClient, auth_headers: dict):
    # Create 5 campsites
    for i in range(5):
        client.post(
            "/api/v1/campgrounds",
            json={
                "title": f"Pagination Camp #{i}",
                "price": 20.0 + i,
                "description": f"Campground {i} description",
                "location": f"Zone {i}"
            },
            headers=auth_headers
        )

    # Request limit=2, page=1
    p1 = client.get("/api/v1/campgrounds?page=1&limit=2")
    assert p1.status_code == 200
    d1 = p1.json()
    assert len(d1["items"]) == 2
    assert d1["page"] == 1
    assert d1["limit"] == 2
    assert d1["has_next"] is True
    assert d1["has_prev"] is False

    # Request limit=2, page=2
    p2 = client.get("/api/v1/campgrounds?page=2&limit=2")
    assert p2.status_code == 200
    d2 = p2.json()
    assert len(d2["items"]) == 2
    assert d2["page"] == 2
    assert d2["has_prev"] is True
    assert d1["items"][0]["id"] != d2["items"][0]["id"]
