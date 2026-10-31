import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from sqlmodel import Session, select
from database import engine, apply_migrations
from models import User, Campground, Comment, Vote, VisitorPhoto
from security import get_password_hash, create_access_token
from main import app

def run_tests():
    print("--- Initializing Test Environment via Alembic Migrations & Triggers ---")
    apply_migrations()
    client = TestClient(app)

    with Session(engine) as session:
        # Create or fetch test user
        user = session.exec(select(User).where(User.username == "moderntester")).first()
        if not user:
            user = User(username="moderntester", hashed_password=get_password_hash("password123"))
            session.add(user)
            session.commit()
            session.refresh(user)
        user_id = user.id

    token = create_access_token({"sub": str(user_id), "username": "moderntester"})
    auth_headers = {"Authorization": f"Bearer {token}"}

    print("\n1. Testing GET /api/campgrounds")
    res = client.get("/api/campgrounds")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert "items" in data, f"Expected 'items' in response: {data}"
    assert "total" in data
    print(f"   Success: Found {data['total']} campgrounds. Page={data['page']}, TotalPages={data['total_pages']}")

    print("\n2. Testing POST /api/campgrounds (CampgroundCreate with numeric price)")
    new_camp_payload = {
        "title": "Modern Pine Ridge Haven",
        "price": 45.5,
        "image": "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4",
        "description": "A tranquil haven high in the alpine pines with starry skies.",
        "location": "Snoqualmie Pass, WA",
        "tags": ["Pine", "Alpine", "Stargazing"],
        "rules": {"fires_allowed": True, "pets_allowed": True, "quiet_hours": "10 PM"}
    }
    res = client.post("/api/campgrounds", json=new_camp_payload, headers=auth_headers)
    assert res.status_code in [200, 201], f"Create campground failed: {res.text}"
    created_camp = res.json()
    camp_id = created_camp["id"]
    assert created_camp["title"] == "Modern Pine Ridge Haven"
    assert created_camp["price"] == 45.5
    assert created_camp["rules"]["quiet_hours"] == "10 PM"
    print(f"   Success: Created campground ID={camp_id}, title={created_camp['title']}, price={created_camp['price']}")

    print("\n3. Testing GET /api/campgrounds/{id}")
    res = client.get(f"/api/campgrounds/{camp_id}")
    assert res.status_code == 200
    camp_detail = res.json()
    assert camp_detail["title"] == "Modern Pine Ridge Haven"
    assert camp_detail["price"] == 45.5
    print("   Success: Retrieved single campground with canonical title and price.")

    print("\n4. Testing PUT /api/campgrounds/{id}")
    update_payload = {
        "title": "Modern Pine Ridge Retreat",
        "price": 55.0
    }
    res = client.put(f"/api/campgrounds/{camp_id}", json=update_payload, headers=auth_headers)
    assert res.status_code == 200
    updated_camp = res.json()
    assert updated_camp["title"] == "Modern Pine Ridge Retreat"
    assert updated_camp["price"] == 55.0
    print("   Success: Updated campground using PUT.")

    print("\n5. Testing POST /api/campgrounds/{id}/comments with rating (testing SQLite Trigger recalculation)")
    comment_payload_1 = {
        "text": "Stunning sunset views from the ridge campsite!",
        "rating": 5
    }
    res = client.post(f"/api/campgrounds/{camp_id}/comments", json=comment_payload_1, headers=auth_headers)
    assert res.status_code in [200, 201], f"Create comment failed: {res.text}"
    created_comment_1 = res.json()
    assert created_comment_1["rating"] == 5

    comment_payload_2 = {
        "text": "Great spot, can get breezy in the evening.",
        "rating": 4
    }
    res = client.post(f"/api/campgrounds/{camp_id}/comments", json=comment_payload_2, headers=auth_headers)
    assert res.status_code in [200, 201], f"Create comment failed: {res.text}"

    # Verify that campground.avg_rating was automatically recalculated by SQLite triggers
    res = client.get(f"/api/campgrounds/{camp_id}")
    assert res.status_code == 200
    camp_with_rating = res.json()
    assert camp_with_rating["avg_rating"] == 4.5, f"Expected trigger avg_rating 4.5, got {camp_with_rating['avg_rating']}"
    print(f"   Success: Trigger recalculated avg_rating to {camp_with_rating['avg_rating']}")

    print("\n6. Testing GET /api/campgrounds/{id}/comments (reply tree)")
    res = client.get(f"/api/campgrounds/{camp_id}/comments")
    assert res.status_code == 200
    comments_list = res.json()
    assert len(comments_list) >= 2
    assert "replies" in comments_list[0]
    print(f"   Success: Retrieved comment tree with {len(comments_list)} root comments.")

    print("\n7. Testing POST /api/campgrounds/{id}/vote (+1)")
    res = client.post(f"/api/campgrounds/{camp_id}/vote?vote_type=1", headers=auth_headers)
    assert res.status_code == 200
    vote_data = res.json()
    assert vote_data["user_vote"] == 1
    assert vote_data["likes"] >= 1
    print(f"   Success: Voted. Likes={vote_data['likes']}")

    print("\n8. Testing POST /api/campgrounds/{id}/wishlist")
    res = client.post(f"/api/campgrounds/{camp_id}/wishlist", headers=auth_headers)
    assert res.status_code == 200
    wish_data = res.json()
    assert wish_data["is_wishlisted"] is True
    print(f"   Success: Wishlist toggled. Count={wish_data['wishlist_count']}")

    print("\n9. Testing GET /api/me/dashboard")
    res = client.get("/api/me/dashboard", headers=auth_headers)
    assert res.status_code == 200
    dash_data = res.json()
    assert dash_data["username"] == "moderntester"
    assert dash_data["wishlist_count"] >= 1
    assert any(c["id"] == camp_id for c in dash_data["my_campgrounds"])
    print(f"   Success: Dashboard retrieved. Hosted={dash_data['total_posts']}, Wishlist={dash_data['wishlist_count']}")

    print("\n10. Testing Visitor Story & Moments (SQL json_group_array)")
    # Create a visitor story
    story_payload = {
        "image_url": "https://images.unsplash.com/photo-1510312305653-8ed496efae75",
        "caption": "Sunrise over the valley from Pine Ridge!"
    }
    res = client.post(
        f"/api/campgrounds/{camp_id}/stories",
        data=story_payload,
        headers=auth_headers
    )
    assert res.status_code in [200, 201], f"Story upload failed: {res.text}"
    created_story = res.json()
    photo_id = created_story["id"]
    print(f"   Success: Created story ID={photo_id}")

    # Test GET /api/stories (json_group_array)
    res = client.get("/api/stories", headers=auth_headers)
    assert res.status_code == 200
    stories_tray = res.json()
    assert isinstance(stories_tray, list)
    print(f"   Success: Story tray returned {len(stories_tray)} user story groups via SQL grouping.")

    # Test GET /api/me/moments
    res = client.get("/api/me/moments", headers=auth_headers)
    assert res.status_code == 200
    moments = res.json()
    assert any(m["id"] == photo_id for m in moments)
    print(f"   Success: /api/me/moments returned {len(moments)} moments.")

    # Test Story Like Toggle
    res = client.post(f"/api/stories/{photo_id}/like", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["liked"] is True
    print("   Success: Story like toggled.")

    print("\n11. Testing Atomic Cascade DELETE /api/campgrounds/{id}")
    res = client.delete(f"/api/campgrounds/{camp_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "Campground deleted successfully"
    print("   Success: Campground deleted via single-statement DELETE.")

    print("\n12. Verifying Native Cascade Deletion in DB Engine")
    with Session(engine) as session:
        c = session.get(Campground, camp_id)
        assert c is None
        # Verify cascaded comments
        remaining_comments = session.exec(select(Comment).where(Comment.campground_id == camp_id)).all()
        assert len(remaining_comments) == 0, f"Expected 0 comments after cascade, found {len(remaining_comments)}"
        # Verify cascaded votes
        remaining_votes = session.exec(select(Vote).where(Vote.campground_id == camp_id)).all()
        assert len(remaining_votes) == 0, f"Expected 0 votes after cascade, found {len(remaining_votes)}"
        # Verify cascaded visitor photos
        remaining_photos = session.exec(select(VisitorPhoto).where(VisitorPhoto.campground_id == camp_id)).all()
        assert len(remaining_photos) == 0, f"Expected 0 photos after cascade, found {len(remaining_photos)}"
    print("   Success: Verified database engine cleanly cascaded all child records to 0 rows.")

    print("\n=======================================================")
    print("ALL MODERN SOLID & SQL-FIRST INTEGRATION TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
