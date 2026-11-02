import uuid
from fastapi.testclient import TestClient

def test_full_user_and_campground_lifecycle(client: TestClient):
    # 1. Register fresh user via /api/v1
    uname = f"scout_{uuid.uuid4().hex[:6]}"
    pwd = "IntegrationPass123!"
    reg_res = client.post("/api/v1/register", json={"username": uname, "password": pwd})
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Campground via /api/v1
    camp_payload = {
        "title": "Twin Lakes High Camp",
        "price": 42.0,
        "description": "High alpine cirque overlooking emerald lakes.",
        "location": "Mammoth Lakes, CA",
        "location_address": "Twin Lakes Pass, CA",
        "latitude": 37.62,
        "longitude": -118.99,
        "image": "https://images.unsplash.com/photo-alpine-lake.jpg",
        "amenities": ["tent_pitches", "potable_water"]
    }
    create_res = client.post("/api/v1/campgrounds", json=camp_payload, headers=headers)
    assert create_res.status_code == 201
    camp = create_res.json()
    camp_id = camp["id"]
    assert camp["title"] == "Twin Lakes High Camp"

    # 3. Retrieve Campground via /api/v1
    v1_res = client.get(f"/api/v1/campgrounds/{camp_id}")
    assert v1_res.status_code == 200
    assert v1_res.json()["title"] == "Twin Lakes High Camp"

    # 4. Cast an Upvote (+1) via /api/v1
    vote_res = client.post(f"/api/v1/campgrounds/{camp_id}/vote?vote_type=1", headers=headers)
    assert vote_res.status_code == 200
    assert vote_res.json()["likes"] == 1
    assert vote_res.json()["user_vote"] == 1

    # 5. Add to Wishlist via /api/v1
    wish_res = client.post(f"/api/v1/campgrounds/{camp_id}/wishlist", headers=headers)
    assert wish_res.status_code == 200
    assert wish_res.json()["is_wishlisted"] is True

    # 6. Post a review via /api/v1
    review_res = client.post(
        f"/api/v1/campgrounds/{camp_id}/comments",
        json={"text": "Crystal clear water and pristine pine scent.", "rating": 5},
        headers=headers
    )
    assert review_res.status_code == 201

    # 7. Check User Dashboard via /api/v1
    dash_res = client.get("/api/v1/me/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash = dash_res.json()
    assert dash["username"] == uname
    assert dash["total_posts"] == 1
    assert dash["total_likes"] == 1
    assert dash["wishlist_count"] == 1
    assert len(dash["my_campgrounds"]) == 1
    assert dash["my_campgrounds"][0]["title"] == "Twin Lakes High Camp"
