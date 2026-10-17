import random
import json
import time
from typing import List
from config import settings
from turso_engine import execute_turso_raw

CURATED_GALLERY_IMAGES = [
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",  # Tent under stars
    "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",  # Campfire dusk
    "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80",  # Night lake camp
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80",  # Misty mountain
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",  # Sunset mountain
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",  # Yosemite valley
    "https://images.unsplash.com/photo-1533873984035-25970ab07461?auto=format&fit=crop&w=1200&q=80",  # Forest river
    "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=1200&q=80",  # Glamping tent
    "https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1200&q=80",  # Pine trees lake
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",  # Wooden dock lake
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1200&q=80",  # Green hills
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",  # Snowy mountain ridge
    "https://images.unsplash.com/photo-1536431311719-398b6704d4cc?auto=format&fit=crop&w=1200&q=80",  # Blue mountain lake
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",  # Tropical beach
    "https://images.unsplash.com/photo-1537905569824-f89f14cceb68?auto=format&fit=crop&w=1200&q=80",  # Camping van
    "https://images.unsplash.com/photo-1571687949921-1306bfb24b72?auto=format&fit=crop&w=1200&q=80",  # A-frame cabin
    "https://images.unsplash.com/photo-1532339142463-fd0a8979791a?auto=format&fit=crop&w=1200&q=80",  # Hammock woods
    "https://images.unsplash.com/photo-1516939884455-1445c8652f83?auto=format&fit=crop&w=1200&q=80",  # Foggy pine forest
    "https://images.unsplash.com/photo-1487730116645-74489c95b41b?auto=format&fit=crop&w=1200&q=80",  # Alpine tent glow
]

LOCATIONS = [
    ("Olympic Peninsula, WA", "Hoh Rain Forest Ranger Road, WA 98331"),
    ("Cascades Ridge, WA", "Pacific Crest Trail Sector 4, WA 98826"),
    ("Dolomites, Italy", "Passo Pordoi Trailhead, Belluno, Italy"),
    ("Black Forest, Germany", "Schwarzwald National Park Sector 2, Germany"),
    ("Sierra Nevada, CA", "Tuolumne Meadows Trailhead, CA 95389"),
    ("Banff National Park, Canada", "Bow Valley Parkway Mile 18, AB, Canada"),
    ("Zion Canyon, UT", "Kolob Terrace Road Mile 12, UT 84779"),
    ("Sedona Red Rocks, AZ", "Oak Creek Canyon Trail Mile 6, AZ 86336"),
    ("Great Smoky Mountains, TN", "Newfound Gap Road Mile 15, TN 37738"),
    ("Blue Ridge Parkway, NC", "Craggy Gardens Sector 9, NC 28711"),
    ("Lake Tahoe Basin, CA", "Emerald Bay Overlook Ridge, CA 96150"),
    ("Rocky Mountain High, CO", "Trail Ridge Summit Road, CO 80517"),
    ("Glacier National Park, MT", "Going-to-the-Sun Road Sector 7, MT 59936"),
    ("Acadia Coast, ME", "Ocean Drive Sector 3, Bar Harbor, ME 04609"),
    ("Appalachian Wilderness, VA", "Shenandoah Skyline Drive Mile 42, VA 22835")
]

ALL_AMENITIES = ["tent_pitches", "campfire", "hot_showers", "potable_water", "wifi", "pet_friendly", "electricity"]

STORY_CAPTIONS = [
    ("Milky way rising over our summit camp at 2,200m elevation.", ["stargazing", "milky_way", "alpine"]),
    ("Morning campfire brew in the mist. Nothing beats crisp mountain air.", ["coffee", "campfire", "sunrise"]),
    ("Wild elk spotted passing through the meadows right behind the tents.", ["wildlife", "elk", "nature"]),
    ("Golden hour reflection across the alpine lake. Pure serenity.", ["golden_hour", "lake", "sunset"]),
    ("Setting up our lightweight shelter before the thunderstorm rolls in.", ["camping", "shelter", "adventure"]),
    ("Crystal clear spring creek running right next to campsite #4.", ["stream", "potable_water", "creek"]),
    ("Cooking fireside stew under a canopy of ancient Douglas firs.", ["cooking", "campfire", "food"]),
    ("Midnight ridge panorama with the lights of the valley far below.", ["night_sky", "ridge", "view"]),
    ("First snow dusting on the peaks while drinking hot cocoa.", ["snow", "winter_camp", "cocoa"]),
    ("Hiking the secret waterfall loop just 15 minutes from the pitch.", ["waterfall", "hiking", "trail"]),
    ("Campsite sunset glowing like lava over the sandstone cliffs.", ["sunset", "desert", "cliffs"]),
    ("Starry night canopy above our canvas wall tent.", ["glamping", "starlight", "night"])
]

def escape_sql(val: str) -> str:
    return val.replace("'", "''")

def populate_modern_data():
    print("=" * 65)
    print(">> POPULATING TURSO PRODUCTION DB WITH MODERN FIELDS & DATA")
    print("=" * 65)

    # 1. Fetch all existing campground IDs
    print("\n1. Fetching existing campgrounds from Turso...")
    res = execute_turso_raw("SELECT id, name, image FROM campground ORDER BY id ASC")
    camps = res.get("rows", [])
    print(f"   Found {len(camps)} campgrounds to enrich.")

    # 2. Enrich Campgrounds with title, location, location_address, gallery_images, amenities, rules, avg_rating, ai_media_caption
    print("\n2. Updating campgrounds with rich metadata, bento galleries, and rules...")
    batch_size = 50
    updated_count = 0

    for i in range(0, len(camps), batch_size):
        chunk = camps[i:i + batch_size]
        for row in chunk:
            c_id = int(row[0]["value"])
            c_name = row[1]["value"]
            c_image = row[2]["value"]

            # Choose location
            loc_tuple = random.choice(LOCATIONS)
            loc = loc_tuple[0]
            loc_addr = loc_tuple[1]

            # Choose 3-5 gallery photos (always including hero cover)
            gallery_pool = [c_image] + random.sample(CURATED_GALLERY_IMAGES, 4)
            # deduplicate preserving order
            gallery = list(dict.fromkeys(gallery_pool))
            gallery_json = json.dumps(gallery)

            # Choose 3-6 amenities
            chosen_amenities = random.sample(ALL_AMENITIES, random.randint(3, 6))
            amenities_json = json.dumps(chosen_amenities)

            # Rules dict
            rules_obj = {
                "check_in": random.choice(["14:00", "15:00", "16:00"]),
                "check_out": random.choice(["10:00", "11:00", "12:00"]),
                "max_guests": random.choice([4, 6, 8]),
                "tent_capacity": random.choice([2, 3, 4]),
                "pets_allowed": "pet_friendly" in chosen_amenities,
                "campfires_allowed": "campfire" in chosen_amenities,
                "quiet_hours": "22:00 - 07:00"
            }
            rules_json = json.dumps(rules_obj)

            # Rating
            rating = round(random.uniform(4.5, 5.0), 1)

            # AI caption
            caption = f"Panoramic sanctuary in {loc} offering {', '.join(chosen_amenities[:3])}."

            sql = f"""
            UPDATE campground
            SET title = '{escape_sql(c_name)}',
                location = '{escape_sql(loc)}',
                location_address = '{escape_sql(loc_addr)}',
                gallery_images = '{escape_sql(gallery_json)}',
                amenities = '{escape_sql(amenities_json)}',
                rules = '{escape_sql(rules_json)}',
                avg_rating = {rating},
                ai_media_caption = '{escape_sql(caption)}'
            WHERE id = {c_id};
            """
            execute_turso_raw(sql)
            updated_count += 1

        print(f"   [+] Processed {updated_count}/{len(camps)} campgrounds...")

    print(f"\n   Successfully enriched all {updated_count} campgrounds!")

    # 3. Seed Visitor Photos / Stories across top campgrounds
    print("\n3. Seeding permanent visitor stories and moments...")
    execute_turso_raw("DELETE FROM visitor_photos WHERE id > 1")

    # Pick top 20 campgrounds to seed stories for
    target_camps = camps[:25]
    story_count = 0
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    for camp_row in target_camps:
        camp_id = int(camp_row[0]["value"])
        # Seed 1 to 3 stories per camp
        num_stories = random.randint(1, 3)
        for _ in range(num_stories):
            img = random.choice(CURATED_GALLERY_IMAGES)
            cap_tuple = random.choice(STORY_CAPTIONS)
            cap_text = cap_tuple[0]
            ai_tags = json.dumps(cap_tuple[1])
            ai_desc = f"Visual moment capturing backcountry scenery at campsite #{camp_id}."
            author_uname = random.choice(["alpinist_sarah", "scout_leo", "trailblazer_dan", "aurora_kai", "admin"])

            sql = f"""
            INSERT INTO visitor_photos 
            (campground_id, user_id, user_username, user_avatar, media_type, image_url, caption, ai_tags, ai_media_caption, likes_count, created_at, expires_at)
            VALUES 
            ({camp_id}, 1, '{author_uname}', 'https://api.dicebear.com/7.x/adventurer/svg?seed={author_uname}', 'photo', '{img}', '{escape_sql(cap_text)}', '{escape_sql(ai_tags)}', '{escape_sql(ai_desc)}', {random.randint(5, 48)}, '{now_iso}', NULL);
            """
            execute_turso_raw(sql)
            story_count += 1

    print(f"   [+] Seeded {story_count} visitor moments/stories across campgrounds.")

    # 4. Rebuild FTS5 full-text index
    print("\n4. Rebuilding FTS5 Search Index in Turso...")
    try:
        execute_turso_raw("INSERT INTO campground_fts(campground_fts) VALUES('rebuild')")
        print("   [+] FTS5 index rebuilt successfully.")
    except Exception as e:
        print(f"   [!] FTS5 rebuild notice: {e}")

    # 5. Verify Database State
    print("\n5. Verifying Turso Production Database State...")
    c_check = execute_turso_raw("SELECT count(*) FROM campground WHERE location != ''")
    print(f"   Campgrounds with locations: {c_check['rows'][0][0]['value']}")

    g_check = execute_turso_raw("SELECT count(*) FROM campground WHERE gallery_images != '[]'")
    print(f"   Campgrounds with bento galleries: {g_check['rows'][0][0]['value']}")

    s_check = execute_turso_raw("SELECT count(*) FROM visitor_photos")
    print(f"   Total visitor stories: {s_check['rows'][0][0]['value']}")

    print("\n" + "=" * 65)
    print("ALL PRODUCTION DATA ENRICHMENT & RESEEDING COMPLETE!")
    print("=" * 65)

if __name__ == "__main__":
    populate_modern_data()
