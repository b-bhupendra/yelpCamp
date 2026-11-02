from fastapi.testclient import TestClient

def test_create_comment_and_rating_trigger(client: TestClient, auth_headers: dict):
    # 1. Create a campsite
    camp_res = client.post(
        "/api/v1/campgrounds",
        json={
            "title": "Starry Vista Ridge",
            "price": 30.0,
            "description": "Clear night skies and panoramic valley views.",
            "location": "Moab, Utah"
        },
        headers=auth_headers
    )
    assert camp_res.status_code == 201
    camp_id = camp_res.json()["id"]

    # 2. Add a comment with rating 5
    com_res = client.post(
        f"/api/v1/campgrounds/{camp_id}/comments",
        json={"text": "Incredible skies and clean campsites!", "rating": 5},
        headers=auth_headers
    )
    assert com_res.status_code == 201
    comment_data = com_res.json()
    assert comment_data["rating"] == 5
    assert comment_data["text"] == "Incredible skies and clean campsites!"

    # 3. Add a second comment with rating 3
    client.post(
        f"/api/v1/campgrounds/{camp_id}/comments",
        json={"text": "A bit windy, but great location.", "rating": 3},
        headers=auth_headers
    )

    # 4. Verify campground avg_rating was recalculated by SQLite triggers: (5 + 3) / 2 = 4.0
    camp_check = client.get(f"/api/v1/campgrounds/{camp_id}")
    assert camp_check.status_code == 200
    assert camp_check.json()["avg_rating"] == 4.0

def test_comment_threaded_replies(client: TestClient, auth_headers: dict):
    # 1. Create campsite
    camp_res = client.post(
        "/api/v1/campgrounds",
        json={
            "title": "Cascadia Timberline",
            "price": 40.0,
            "description": "Lush evergreen forest.",
            "location": "Olympic Peninsula, WA"
        },
        headers=auth_headers
    )
    camp_id = camp_res.json()["id"]

    # 2. Add top-level parent comment
    parent_res = client.post(
        f"/api/v1/campgrounds/{camp_id}/comments",
        json={"text": "Is there potable water available at the north pitch?", "rating": None},
        headers=auth_headers
    )
    assert parent_res.status_code == 201
    parent_id = parent_res.json()["id"]

    # 3. Add reply referencing parent_comment_id
    reply_res = client.post(
        f"/api/v1/campgrounds/{camp_id}/comments",
        json={"text": "Yes, water spigots are active year-round by pitch 4.", "parent_comment_id": parent_id},
        headers=auth_headers
    )
    assert reply_res.status_code == 201
    reply_data = reply_res.json()
    assert reply_data["parent_comment_id"] == parent_id

    # 4. Fetch comments tree
    tree_res = client.get(f"/api/v1/campgrounds/{camp_id}/comments")
    assert tree_res.status_code == 200
    tree = tree_res.json()
    assert len(tree) >= 1

    # Locate parent
    parent_in_tree = next((c for c in tree if c["id"] == parent_id), None)
    assert parent_in_tree is not None
    assert len(parent_in_tree["replies"]) == 1
    assert parent_in_tree["replies"][0]["id"] == reply_data["id"]
