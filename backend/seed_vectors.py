import sys
import time
from sqlmodel import Session, select, func
from database import engine, create_db_and_tables
from models import Campground, CampgroundEmbedding, Comment
from services.multimodal_embedder import multimodal_embedder
from services.vector_store import vector_store

def seed_vectors():
    print("[YelpCamp Vector RAG] Indexing Campgrounds into Vector Store...", flush=True)
    create_db_and_tables()

    with Session(engine) as session:
        camps = session.exec(select(Campground)).all()
        total = len(camps)
        print(f"Total campgrounds in database: {total}", flush=True)

        if total == 0:
            print("No campgrounds found. Run `python seed.py` first.", flush=True)
            return

        # Check existing embeddings
        existing_ids = set(
            session.exec(select(CampgroundEmbedding.campground_id)).all()
        )
        to_index = [c for c in camps if c.id not in existing_ids]
        print(f"Already indexed: {len(existing_ids)}, To be indexed: {len(to_index)}", flush=True)

        if not to_index:
            print(f"All {total} campgrounds already indexed!", flush=True)
            engine.dispose()
            return

        success = 0
        start_time = time.time()
        BATCH_SIZE = 30

        for i in range(0, len(to_index), BATCH_SIZE):
            batch = to_index[i:i + BATCH_SIZE]
            batch_profiles = []
            
            for camp in batch:
                comments = session.exec(
                    select(Comment.text).where(Comment.campground_id == camp.id)
                ).all()

                parts = [
                    f"Campsite: {camp.name}",
                    f"Price: {camp.price} per night",
                    f"Description: {camp.description}",
                    f"Visual Scenery: Mountainous, forest or coastal terrain with outdoor ambiance from cover photo ({camp.image})."
                ]
                if comments:
                    parts.append(f"Guest Tips & Reviews: {' | '.join(list(comments)[:5])}")
                profile_text = "\n".join(parts)
                batch_profiles.append((camp.id, profile_text))

            texts = [p[1] for p in batch_profiles]
            embeddings = multimodal_embedder.embed_batch(texts)

            for (camp_id, profile_text), emb in zip(batch_profiles, embeddings):
                vector_store.save_embedding(
                    session=session,
                    campground_id=camp_id,
                    embedding=emb,
                    content_summary=profile_text,
                    has_image=True
                )
                success += 1

            elapsed = time.time() - start_time
            print(f"Progress: [{success}/{len(to_index)}] embedded in {elapsed:.1f}s", flush=True)
            time.sleep(1.0)

        total_vectors = session.exec(select(func.count(CampgroundEmbedding.id))).one()
        print(f"Finished! Total vector index entries: {total_vectors}", flush=True)

    engine.dispose()
    print("Done.", flush=True)

if __name__ == "__main__":
    seed_vectors()
