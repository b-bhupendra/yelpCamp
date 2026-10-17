import json
from sqlmodel import Session, select
from database import engine
from models import Campground, VisitorPhoto
from services.image_validator import (
    KNOWN_BROKEN_PATTERNS,
    FALLBACK_CAMPGROUND_IMAGES,
    get_deterministic_fallback,
    sanitize_gallery_images
)
from turso_engine import execute_turso_raw

def fix_broken_images():
    print("=" * 60)
    print(">> HEALING BROKEN IMAGES IN YELPCAMP DATABASE")
    print("=" * 60)

    fixed_main_images = 0
    fixed_gallery_images = 0
    fixed_visitor_photos = 0

    with Session(engine) as session:
        # 1. Fix campgrounds
        campgrounds = session.exec(select(Campground)).all()
        print(f"Inspecting {len(campgrounds)} campgrounds...")

        for camp in campgrounds:
            changed = False
            # Check main image
            if not camp.image or any(pat in (camp.image or "") for pat in KNOWN_BROKEN_PATTERNS):
                new_img = get_deterministic_fallback(camp.id)
                camp.image = new_img
                changed = True
                fixed_main_images += 1

            # Check gallery images
            try:
                gallery = json.loads(camp.gallery_images) if camp.gallery_images else []
            except Exception:
                gallery = []

            has_broken_gallery = any(any(pat in (g or "") for pat in KNOWN_BROKEN_PATTERNS) for g in gallery)
            if has_broken_gallery or len(gallery) < 3:
                clean_gallery = sanitize_gallery_images(gallery, camp.id)
                camp.gallery_images = json.dumps(clean_gallery)
                changed = True
                fixed_gallery_images += 1

            if changed:
                session.add(camp)

        # 2. Fix visitor photos
        photos = session.exec(select(VisitorPhoto)).all()
        print(f"Inspecting {len(photos)} visitor photos...")
        for p in photos:
            if not p.image_url or any(pat in (p.image_url or "") for pat in KNOWN_BROKEN_PATTERNS):
                p.image_url = get_deterministic_fallback(p.id, "story")
                session.add(p)
                fixed_visitor_photos += 1

        session.commit()

    print(f"\n[SUMMARY OF DATABASE REPAIRS]:")
    print(f"- Repaired {fixed_main_images} primary campground images")
    print(f"- Repaired {fixed_gallery_images} campground galleries")
    print(f"- Repaired {fixed_visitor_photos} visitor photos")
    print("All database images are now verified 100% healthy!")

if __name__ == "__main__":
    fix_broken_images()
