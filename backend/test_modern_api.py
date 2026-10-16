import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import User, Campground
from security import get_password_hash, create_access_token
from main import app

def run_tests():
    print("--- Initializing Test Environment ---")
    create_db_and_tables()
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

    print("\n5. Testing POST /api/campgrounds/{id}/comments")
    comment_payload = {
        "text": "Stunning sunset views from the ridge campsite!"
    }
    res = client.post(f"/api/campgrounds/{camp_id}/comments", json=comment_payload, headers=auth_headers)
    assert res.status_code in [200, 201], f"Create comment failed: {res.text}"
    created_comment = res.json()
    assert created_comment["text"] == comment_payload["text"]
    comment_id = created_comment["id"]
    print(f"   Success: Created comment ID={comment_id}")

    print("\n6. Testing GET /api/campgrounds/{id}/comments (reply tree)")
    res = client.get(f"/api/campgrounds/{camp_id}/comments")
    assert res.status_code == 200
    comments_list = res.json()
    assert len(comments_list) >= 1
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

    print("\n10. Testing DELETE /api/campgrounds/{id}")
    res = client.delete(f"/api/campgrounds/{camp_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "Campground deleted successfully"
    print("   Success: Campground deleted via DELETE.")

    print("\n11. Verifying 404 after deletion")
    res = client.get(f"/api/campgrounds/{camp_id}")
    assert res.status_code == 404
    print("   Success: Confirmed 404 on deleted campsite.")

    print("\n==========================================")
    print("ALL MODERN REST API TESTS PASSED CLEANLY!")
    print("==========================================")

if __name__ == "__main__":
    run_tests()
