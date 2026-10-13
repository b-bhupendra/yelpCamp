import time
import random
import sqlite3
from typing import List, Tuple
from faker import Faker
from sqlmodel import SQLModel
from models import User, Campground, Comment, Wishlist, CheckIn, Trip, TripMember, Vote
from security import get_password_hash
from config import settings
from database import engine, create_db_and_tables
import libsql_client

fake = Faker()

# Configuration
NUM_USERS = 40_000
NUM_CAMPGROUNDS = 500
AVG_COMMENTS_PER_CAMP = 12
NUM_VOTES = 25_000
NUM_WISHLISTS = 5_000
NUM_CHECKINS = 2_500
NUM_TRIPS = 100
BATCH_SIZE = 500

CURATED_IMAGES = [
    "https://images.unsplash.com/photo-1501785887759-ddad4dda0901?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1518173946684-a15f061031c2?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1536431311719-398b6704d4cc?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1533167649158-6d508895b680?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1493246507139-91e8bef99c21?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1475924156731-498ff7931435?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1500375592092-40ec21f8fe7f?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1510798831971-661ebf7c373a?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1499344004921-69238af42ea5?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1501854140801-cbc35602d45a?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=1200"
]

CAMP_PREFIXES = [
    "Aether", "Monolith", "Sanctum", "Nexus", "Zenith", "Obsidian", "Elysium", 
    "Vortex", "Titan", "Spectral", "Infinite", "Prism", "Apex", "Onyx", "Astral",
    "Solstice", "Helios", "Chronos", "Eclipse", "Lumina", "Hyperion", "Aurora",
    "Nova", "Cosmos", "Celestial", "Shadow", "Starlight", "Ethereal", "Valhalla"
]

CAMP_SUFFIXES = [
    "Sanctuary", "Domain", "Haven", "Core", "Module", "Station", "Void", "Horizon", 
    "Cradle", "Vault", "Point", "Base", "Sector", "Quarter", "Node", "Ridge",
    "Peak", "Canyon", "Valley", "Grove", "Oasis", "Heights", "Lodge", "Retreat"
]

def escape_sql(val: str) -> str:
    return val.replace("'", "''")

def seed_database():
    start_time = time.time()
    is_turso = settings.USE_TURSO and bool(settings.TURSO_AUTH_TOKEN)
    mode = "Turso Cloud (" + settings.TURSO_DATABASE_URL + ")" if is_turso else "Local SQLite"
    
    print("=" * 65)
    print(f">> Starting High-Performance Database Seeding...")
    print(f"   Target: {NUM_USERS:,} Users & {NUM_CAMPGROUNDS:,} Campgrounds")
    print(f"   Storage Engine: {mode}")
    print("=" * 65)

    print("\n1. Resetting database schema via SQLModel...")
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    print("   [+] Schema initialized with clean tables.")

    # Turso client or local sqlite cursor
    turso_client = None
    local_conn = None
    local_cur = None

    if is_turso:
        turso_client = libsql_client.create_client_sync(settings.TURSO_DATABASE_URL, auth_token=settings.TURSO_AUTH_TOKEN)
    else:
        db_file = settings.DATABASE_URL.replace("sqlite:///", "")
        local_conn = sqlite3.connect(db_file)
        local_cur = local_conn.cursor()
        local_cur.execute("PRAGMA synchronous = OFF;")
        local_cur.execute("PRAGMA journal_mode = WAL;")

    def execute_bulk_insert(table_name: str, cols: List[str], rows: List[Tuple]):
        col_str = ", ".join(cols)
        chunk_size = 400
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            val_strs = []
            for r in chunk:
                formatted = []
                for v in r:
                    if v is None:
                        formatted.append("NULL")
                    elif isinstance(v, (int, float)):
                        formatted.append(str(v))
                    else:
                        formatted.append(f"'{escape_sql(str(v))}'")
                val_strs.append(f"({', '.join(formatted)})")
            
            sql = f"INSERT INTO {table_name} ({col_str}) VALUES {', '.join(val_strs)};"
            if is_turso:
                turso_client.execute(sql)
            else:
                local_cur.execute(sql)

    # 2. Pre-computing password hashes
    print("\n2. Pre-computing password hashes...")
    admin_hash = get_password_hash("admin123")
    user_hash = get_password_hash("password123")
    print("   [+] Hashes ready (admin123 & password123).")

    # 3. Users Generation
    print(f"\n3. Generating and inserting {NUM_USERS:,} Users...")
    user_data = []
    user_data.append((1, "admin", admin_hash))
    
    for i in range(1, NUM_USERS + 1):
        uname = f"{fake.user_name()}_{i}"
        user_data.append((i + 1, uname, user_hash))

    execute_bulk_insert("user", ["id", "username", "hashed_password"], user_data)
    print(f"   [+] {len(user_data):,} Users seeded.")

    # 4. Campgrounds Generation
    print(f"\n4. Generating and inserting {NUM_CAMPGROUNDS:,} Campgrounds...")
    camp_data = []
    for c_id in range(1, NUM_CAMPGROUNDS + 1):
        author_id = random.randint(1, min(NUM_USERS, 5000))
        author_username = user_data[author_id - 1][1]
        name = f"{random.choice(CAMP_PREFIXES)} {random.choice(CAMP_SUFFIXES)} #{c_id}"
        price = str(random.randint(45, 650))
        image = random.choice(CURATED_IMAGES)
        description = fake.paragraph(nb_sentences=random.randint(3, 6))
        camp_data.append((c_id, name, price, image, description, author_id, author_username))

    execute_bulk_insert("campground", ["id", "name", "price", "image", "description", "author_id", "author_username"], camp_data)
    print(f"   [+] {NUM_CAMPGROUNDS:,} Campgrounds seeded.")

    # 5. Comments Generation
    print(f"\n5. Generating and inserting Comments...")
    comment_data = []
    comment_id = 1
    for c_id in range(1, NUM_CAMPGROUNDS + 1):
        comments_count = random.randint(6, AVG_COMMENTS_PER_CAMP * 2)
        for _ in range(comments_count):
            author_id = random.randint(1, NUM_USERS)
            author_username = user_data[author_id - 1][1]
            text = fake.sentence(nb_words=random.randint(8, 20))
            comment_data.append((comment_id, text, author_id, author_username, c_id))
            comment_id += 1

    execute_bulk_insert("comment", ["id", "text", "author_id", "author_username", "campground_id"], comment_data)
    print(f"   [+] {len(comment_data):,} Comments seeded.")

    # 6. Community Votes
    print(f"\n6. Generating and inserting {NUM_VOTES:,} Votes...")
    vote_set = set()
    while len(vote_set) < NUM_VOTES:
        u_id = random.randint(1, NUM_USERS)
        c_id = random.randint(1, NUM_CAMPGROUNDS)
        vote_set.add((u_id, c_id))

    vote_data = [(u_id, c_id, random.choice([1, 1, 1, 1, -1])) for (u_id, c_id) in vote_set]
    execute_bulk_insert("vote", ["user_id", "campground_id", "vote_type"], vote_data)
    print(f"   [+] {len(vote_data):,} Votes seeded.")

    # 7. Wishlists
    print(f"\n7. Generating and inserting {NUM_WISHLISTS:,} Wishlist entries...")
    wishlist_set = set()
    while len(wishlist_set) < NUM_WISHLISTS:
        u_id = random.randint(1, NUM_USERS)
        c_id = random.randint(1, NUM_CAMPGROUNDS)
        wishlist_set.add((u_id, c_id))

    wishlist_data = [(u_id, c_id) for (u_id, c_id) in wishlist_set]
    execute_bulk_insert("wishlist", ["user_id", "campground_id"], wishlist_data)
    print(f"   [+] {len(wishlist_data):,} Wishlist items seeded.")

    # 8. Check-Ins
    print(f"\n8. Generating and inserting {NUM_CHECKINS:,} Check-Ins...")
    checkin_data = []
    for cid in range(1, NUM_CHECKINS + 1):
        u_id = random.randint(1, NUM_USERS)
        camp_id = random.randint(1, NUM_CAMPGROUNDS)
        ts = fake.date_time_between(start_date="-1y", end_date="now").isoformat()
        checkin_data.append((cid, u_id, camp_id, ts))

    execute_bulk_insert("checkin", ["id", "user_id", "campground_id", "timestamp"], checkin_data)
    print(f"   [+] {NUM_CHECKINS:,} Check-Ins seeded.")

    # 9. Group Trips
    print(f"\n9. Generating and inserting {NUM_TRIPS:,} Group Trips...")
    trip_data = []
    for i in range(1, NUM_TRIPS + 1):
        name = f"Wilderness Expedition #{i}: {fake.city()}"
        owner_id = random.randint(1, min(NUM_USERS, 1000))
        trip_data.append((i, name, owner_id))

    execute_bulk_insert("trip", ["id", "name", "owner_id"], trip_data)

    trip_members = set()
    for trip_id in range(1, NUM_TRIPS + 1):
        num_members = random.randint(2, 6)
        for _ in range(num_members):
            m_id = random.randint(1, NUM_USERS)
            trip_members.add((trip_id, m_id))

    execute_bulk_insert("tripmember", ["trip_id", "user_id"], list(trip_members))
    print(f"   [+] {NUM_TRIPS:,} Trips & {len(trip_members):,} Members seeded.")

    if not is_turso:
        local_conn.commit()
        local_cur.execute("PRAGMA wal_checkpoint(FULL);")
        local_conn.close()

    elapsed = time.time() - start_time
    print("\n" + "=" * 65)
    print(f"*** SEEDING FINISHED IN {elapsed:.2f} SECONDS! ***")
    print(f"   Engine:          {mode}")
    print(f"   Users:           {len(user_data):,} (includes admin)")
    print(f"   Campgrounds:     {NUM_CAMPGROUNDS:,}")
    print(f"   Comments:        {len(comment_data):,}")
    print(f"   Votes:           {len(vote_data):,}")
    print(f"   Wishlists:       {len(wishlist_data):,}")
    print(f"   Check-Ins:       {len(checkin_data):,}")
    print(f"   Trips:           {NUM_TRIPS:,}")
    print("=" * 65)

if __name__ == "__main__":
    seed_database()
