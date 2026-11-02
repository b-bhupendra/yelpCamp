from fastapi.testclient import TestClient

def test_create_story_and_tray(client: TestClient, auth_headers: dict):
    # 1. Create campsite
    camp_res = client.post(
        "/api/campgrounds",
        json={
            "title": "Sunburst Canyon",
            "price": 28.0,
            "description": "Red rock vistas and quiet nights.",
            "location": "Sedona, Arizona"
        },
        headers=auth_headers
    )
    camp_id = camp_res.json()["id"]

    # 2. Post visitor story via JSON payload
    story_payload = {
        "image_url": "https://images.unsplash.com/photo-canyon-sunset.jpg",
        "caption": "Golden hour over the red cliffs!",
        "media_type": "photo",
        "expires_hours": 24
    }
    story_res = client.post(
        f"/api/campgrounds/{camp_id}/stories",
        json=story_payload,
        headers=auth_headers
    )
    assert story_res.status_code == 200
    story_data = story_res.json()
    assert story_data["caption"] == "Golden hour over the red cliffs!"
    assert story_data["campground_id"] == camp_id
    photo_id = story_data["id"]

    # 3. Check active stories tray
    tray_res = client.get("/api/stories")
    assert tray_res.status_code == 200
    tray = tray_res.json()
    assert isinstance(tray, list)
    assert len(tray) >= 1

    # 4. Check user moments
    moments_res = client.get("/api/me/moments", headers=auth_headers)
    assert moments_res.status_code == 200
    moments = moments_res.json()
    assert any(m["id"] == photo_id for m in moments)

def test_story_like_toggle(client: TestClient, auth_headers: dict):
    # 1. Create campsite and story
    camp_res = client.post(
        "/api/campgrounds",
        json={
            "title": "Glacier Creek Basin",
            "price": 35.0,
            "description": "Glacial streams and subalpine meadows.",
            "location": "North Cascades, WA"
        },
        headers=auth_headers
    )
    camp_id = camp_res.json()["id"]

    story_res = client.post(
        f"/api/campgrounds/{camp_id}/stories",
        json={"image_url": "https://images.unsplash.com/photo-glacier.jpg", "caption": "Morning dew"},
        headers=auth_headers
    )
    photo_id = story_res.json()["id"]

    # 2. Like story
    like_res = client.post(f"/api/stories/{photo_id}/like", headers=auth_headers)
    assert like_res.status_code == 200
    like_data = like_res.json()
    assert like_data["liked_by_me"] is True
    assert like_data["likes_count"] >= 1

    # 3. Unlike story (toggle)
    unlike_res = client.post(f"/api/stories/{photo_id}/like", headers=auth_headers)
    assert unlike_res.status_code == 200
    unlike_data = unlike_res.json()
    assert unlike_data["liked_by_me"] is False
