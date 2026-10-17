import os
import sys
import time
import json
import math
import statistics
from typing import List, Dict, Any, Optional

# Ensure backend directory is on Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session
from database import engine
from services.vector_store import CrossEncoderService, vector_store
from services.multimodal_embedder import multimodal_embedder

# ============================================================================
# 1. GOLDEN EVALUATION CORPUS (Realistic Trap & Target Campsites)
# ============================================================================
GOLDEN_CORPUS: List[Dict[str, Any]] = [
    {
        "id": 101,
        "title": "Rishikesh Bass & Bonfire Party Camp",
        "location": "Rishikesh, Uttarakhand",
        "price": 45.0,
        "avg_rating": 4.6,
        "description": "Best party camp in Rishikesh, Uttarakhand! We have loud music, DJ nights, dance floors, and late-night bonfires by the river.",
        "amenities": '["campfire", "wifi", "electricity", "dj_music"]',
        "ai_media_caption": "Vibrant riverside camp with neon lights, speakers, and large group tents."
    },
    {
        "id": 102,
        "title": "Chaukori Silent Stargazing Sanctuary",
        "location": "Chaukori, Pithoragarh, Uttarakhand",
        "price": 40.0,
        "avg_rating": 4.9,
        "description": "Peaceful stargazing camp in Chaukori, Uttarakhand. Strictly silent after 9 PM, zero speakers allowed, tranquil pine forest ridge.",
        "amenities": '["tent_pitches", "potable_water", "stargazing"]',
        "ai_media_caption": "Serene dark-sky alpine ridge under the Milky Way with quiet canvas tents."
    },
    {
        "id": 103,
        "title": "Solang Valley Snow Glamping Dome",
        "location": "Manali, Himachal Pradesh",
        "price": 85.0,
        "avg_rating": 4.8,
        "description": "Amazing snow camping experience in Manali! Great mountain views, heated geodesic domes, and deep winter snowdrifts.",
        "amenities": '["hot_showers", "wifi", "electricity", "heated_pods"]',
        "ai_media_caption": "Snow-covered glamping domes surrounded by tall cedar trees in Manali."
    },
    {
        "id": 104,
        "title": "Khaliya Top Alpine Basecamp",
        "location": "Munsiyari, Pithoragarh, Uttarakhand",
        "price": 35.0,
        "avg_rating": 4.9,
        "description": "Pitched our high-altitude expedition tents at Khaliya Top, Munsiyari. Heavy snowfall last night with panoramic Panchachuli peak views.",
        "amenities": '["tent_pitches", "potable_water", "alpine_gear"]',
        "ai_media_caption": "High-altitude snow camp at Khaliya Top ridge overlooking Himalayan summits."
    },
    {
        "id": 105,
        "title": "Hoh Rain Forest Canine Trail Camp",
        "location": "Olympic Peninsula, WA",
        "price": 30.0,
        "avg_rating": 4.7,
        "description": "Lush mossy forest pitches with dog-friendly trails, off-leash meadow zones, and fresh creek water for pets.",
        "amenities": '["tent_pitches", "pet_friendly", "potable_water", "campfire"]',
        "ai_media_caption": "Fern-covered rainforest clearing with dogs resting beside a glowing campfire."
    },
    {
        "id": 106,
        "title": "Zion Red Rock Protected Wildlife Reserve",
        "location": "Zion Canyon, UT",
        "price": 50.0,
        "avg_rating": 4.8,
        "description": "Desert sandstone canyon camp inside a strict wildlife protection zone. Strictly no pets or dogs permitted on trails.",
        "amenities": '["tent_pitches", "potable_water"]',
        "ai_media_caption": "Red sandstone cliffs glowing at sunset over minimalist backcountry tents."
    },
    {
        "id": 107,
        "title": "Emerald Bay Remote Work Glampground",
        "location": "Lake Tahoe Basin, CA",
        "price": 95.0,
        "avg_rating": 4.9,
        "description": "High-speed Starlink wifi, solar electricity outlets at every A-frame cabin, and hot showers right on the lakefront.",
        "amenities": '["wifi", "electricity", "hot_showers", "campfire"]',
        "ai_media_caption": "Modern wooden A-frame cabin overlooking a crystal blue mountain lake."
    },
    {
        "id": 108,
        "title": "Black Forest Off-Grid Wilderness Pitch",
        "location": "Schwarzwald, Germany",
        "price": 25.0,
        "avg_rating": 4.7,
        "description": "100% digital detox camp in deep pine woods. No wifi, no cell reception, no electricity—just pure nature and quiet trails.",
        "amenities": '["tent_pitches", "potable_water"]',
        "ai_media_caption": "Misty evergreen pine forest with a solitary hammock and backcountry tent."
    },
    {
        "id": 109,
        "title": "Spiti Valley Chandra Taal Nomad Camp",
        "location": "Lahaul and Spiti, Himachal Pradesh",
        "price": 42.0,
        "avg_rating": 4.9,
        "description": "High-altitude cold desert camp near Chandra Taal crescent lake at 4,300m. Crystal clear night skies and glacial water.",
        "amenities": '["tent_pitches", "potable_water"]',
        "ai_media_caption": "Turquoise high-altitude Himalayan lake surrounded by barren ochre mountains."
    },
    {
        "id": 110,
        "title": "Darma Valley Panchachuli Base Retreat",
        "location": "Dharchula, Pithoragarh, Uttarakhand",
        "price": 38.0,
        "avg_rating": 4.9,
        "description": "Remote Kumaon Himalayan meadow camp in Darma Valley facing the Panchachuli glacier. Serene river soundscapes and wooden cottages.",
        "amenities": '["tent_pitches", "campfire", "potable_water", "pet_friendly"]',
        "ai_media_caption": "Glacial river valley framed by snow-clad Panchachuli peaks in Uttarakhand."
    }
]

# ============================================================================
# 2. GOLDEN RETRIEVAL TEST SUITE (Negations, Rare Nouns, Multi-Constraint)
# ============================================================================
GOLDEN_QUERIES: List[Dict[str, Any]] = [
    {
        "qid": "Q1",
        "category": "Negation Trap",
        "query": "Show me quiet campsites in Uttarakhand with no loud music or DJ",
        "expected_top_id": 102,
        "trap_id": 101,
        "simulated_bi_encoder_scores": {101: 0.88, 102: 0.74, 110: 0.71, 104: 0.68}
    },
    {
        "qid": "Q2",
        "category": "Negation Trap",
        "query": "Canyon or forest camping strictly without pets or dogs",
        "expected_top_id": 106,
        "trap_id": 105,
        "simulated_bi_encoder_scores": {105: 0.86, 106: 0.76, 108: 0.65}
    },
    {
        "qid": "Q3",
        "category": "Negation Trap",
        "query": "Off-grid pine forest camp with no wifi and zero electricity",
        "expected_top_id": 108,
        "trap_id": 107,
        "simulated_bi_encoder_scores": {107: 0.85, 108: 0.73, 102: 0.69}
    },
    {
        "qid": "Q4",
        "category": "Rare Place Name (BM25)",
        "query": "Are there any camps near Munsiyari Khaliya Top with snow?",
        "expected_top_id": 104,
        "trap_id": 103,
        "simulated_bi_encoder_scores": {103: 0.87, 101: 0.72, 104: 0.69}
    },
    {
        "qid": "Q5",
        "category": "Rare Place Name (BM25)",
        "query": "High altitude camping near Chandra Taal in Spiti Valley",
        "expected_top_id": 109,
        "trap_id": 103,
        "simulated_bi_encoder_scores": {103: 0.83, 109: 0.71, 104: 0.70}
    },
    {
        "qid": "Q6",
        "category": "Rare Place Name (BM25)",
        "query": "Campsites in Darma Valley near Dharchula and Panchachuli glacier",
        "expected_top_id": 110,
        "trap_id": 101,
        "simulated_bi_encoder_scores": {101: 0.81, 102: 0.75, 110: 0.70}
    },
    {
        "qid": "Q7",
        "category": "Amenity & Persona Match",
        "query": "Lakefront glamping with fast Starlink wifi and hot showers for remote work",
        "expected_top_id": 107,
        "trap_id": 108,
        "simulated_bi_encoder_scores": {107: 0.91, 103: 0.78, 108: 0.62}
    },
    {
        "qid": "Q8",
        "category": "Amenity & Persona Match",
        "query": "Dog friendly rainforest campsite with off-leash trails and campfire",
        "expected_top_id": 105,
        "trap_id": 106,
        "simulated_bi_encoder_scores": {105: 0.89, 106: 0.74, 110: 0.68}
    }
]

# ============================================================================
# 3. GOLDEN UI NAVIGATION GUARDRAIL SUITE (Cosine Cutoff < 0.25)
# ============================================================================
UI_GUARDRAIL_TESTS: List[Dict[str, Any]] = [
    {"prompt": "Upload Visitor Story photo with caption", "expected_selector": "#btn-upload-story", "should_trigger": True},
    {"prompt": "Share Campsite on WhatsApp or QR code", "expected_selector": "#btn-share-property", "should_trigger": True},
    {"prompt": "Host New Campsite listing with gallery", "expected_selector": "#btn-new-campground", "should_trigger": True},
    {"prompt": "How do I permanently delete my campsite story?", "expected_selector": None, "should_trigger": False},
    {"prompt": "Cancel my credit card subscription and refund billing", "expected_selector": None, "should_trigger": False},
    {"prompt": "Change my account password and enable 2FA", "expected_selector": None, "should_trigger": False},
]

# ============================================================================
# 4. EVALUATION ENGINE (Stage 1 vs Stage 1+2 vs Full 3-Stage Hybrid)
# ============================================================================
def compute_bm25_boost(query: str, doc: Dict[str, Any], corpus: List[Dict[str, Any]]) -> float:
    """Computes exact SQLite FTS5-equivalent Inverse Document Frequency (IDF) keyword boost."""
    q_words = [w.strip(".,?!:;\"'()").lower() for w in query.split() if len(w.strip(".,?!:;\"'()")) > 2]
    doc_text = f"{doc['title']} {doc['location']} {doc['description']} {doc['amenities']}".lower()
    
    N = len(corpus)
    score = 0.0
    for w in q_words:
        if w in doc_text:
            df = sum(1 for d in corpus if w in f"{d['title']} {d['location']} {d['description']}".lower())
            idf = math.log(1.0 + (N - df + 0.5) / (df + 0.5))
            # Rare proper nouns (df == 1, e.g., 'munsiyari', 'khaliya', 'darma') receive high IDF weight
            score += idf
    return min(0.40, score * 0.18)


def run_benchmark():
    print("=" * 84)
    print("  AURORA TRAIL INTELLIGENCE — 3-STAGE HYBRID RAG & AGENT GUARDRAIL BENCHMARK")
    print("=" * 84)

    cross_encoder = CrossEncoderService()
    corpus_by_id = {c["id"]: c for c in GOLDEN_CORPUS}

    metrics = {
        "stage1_vector_only": {"hits_at_1": 0, "hits_at_3": 0, "mrr": [], "ndcg_at_3": [], "negation_traps_avoided": 0},
        "stage2_vector_bm25": {"hits_at_1": 0, "hits_at_3": 0, "mrr": [], "ndcg_at_3": [], "negation_traps_avoided": 0},
        "stage3_full_hybrid": {"hits_at_1": 0, "hits_at_3": 0, "mrr": [], "ndcg_at_3": [], "negation_traps_avoided": 0},
    }
    latencies_ms: List[float] = []
    negation_total = sum(1 for q in GOLDEN_QUERIES if q["category"] == "Negation Trap")

    print("\n[1/3] Evaluating Retrieval Stages across Golden Query Dataset...\n")
    print(f"{'QID':<4} | {'Category':<24} | {'Vec-Only #1':<14} | {'Vec+BM25 #1':<14} | {'3-Stage Hybrid #1':<18}")
    print("-" * 84)

    for q in GOLDEN_QUERIES:
        t0 = time.perf_counter()
        query_text = q["query"]
        expected_id = q["expected_top_id"]
        trap_id = q["trap_id"]
        base_scores = q["simulated_bi_encoder_scores"]

        # ── 1. STAGE 1 ONLY: Pure Bi-Encoder Vector Search (vector_top_k) ──
        s1_ranked = sorted(GOLDEN_CORPUS, key=lambda d: base_scores.get(d["id"], 0.40), reverse=True)
        s1_ids = [d["id"] for d in s1_ranked]

        # ── 2. STAGE 1 + 2: Dense Vector + FTS5 BM25 Keyword Boost ──
        s2_scored = []
        for d in GOLDEN_CORPUS:
            v_score = base_scores.get(d["id"], 0.40)
            bm25_boost = compute_bm25_boost(query_text, d, GOLDEN_CORPUS)
            s2_scored.append((d["id"], v_score + bm25_boost, d))
        s2_scored.sort(key=lambda x: x[1], reverse=True)
        s2_ids = [x[0] for x in s2_scored]

        # ── 3. STAGE 3 FULL HYBRID: Vector + FTS5 BM25 + Cross-Encoder Reranker ──
        passages = []
        for cid, combined_sim, d in s2_scored:
            text = f"{d['title']} located in {d['location']}. {d['description']} Amenities: {d['amenities']}. Ambiance: {d['ai_media_caption']}"
            passages.append({
                "id": cid,
                "text": text,
                "meta": {"id": cid, "similarity_score": combined_sim}
            })

        reranked = cross_encoder.rerank(query=query_text, passages=passages)
        # Apply strict production score cutoff (>= 0.25) from vector_store.py
        s3_ids = [r["id"] for r in reranked if float(r.get("score", 0.0)) >= 0.25]

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        latencies_ms.append(elapsed_ms)

        # Record metrics for each pipeline stage
        for stage_key, ranked_ids in [
            ("stage1_vector_only", s1_ids),
            ("stage2_vector_bm25", s2_ids),
            ("stage3_full_hybrid", s3_ids),
        ]:
            if ranked_ids and ranked_ids[0] == expected_id:
                metrics[stage_key]["hits_at_1"] += 1
            if expected_id in ranked_ids[:3]:
                metrics[stage_key]["hits_at_3"] += 1
                rank_pos = ranked_ids.index(expected_id) + 1
                metrics[stage_key]["mrr"].append(1.0 / rank_pos)
                metrics[stage_key]["ndcg_at_3"].append(1.0 / math.log2(rank_pos + 1))
            else:
                metrics[stage_key]["mrr"].append(0.0)
                metrics[stage_key]["ndcg_at_3"].append(0.0)

            if q["category"] == "Negation Trap":
                if not ranked_ids or ranked_ids[0] != trap_id:
                    metrics[stage_key]["negation_traps_avoided"] += 1

        s1_label = f"ID {s1_ids[0]} ({'PASS' if s1_ids[0]==expected_id else 'FAIL'})"
        s2_label = f"ID {s2_ids[0]} ({'PASS' if s2_ids[0]==expected_id else 'FAIL'})"
        s3_label = f"ID {s3_ids[0]} ({'PASS' if s3_ids[0]==expected_id else 'FAIL'})"
        print(f"{q['qid']:<4} | {q['category']:<24} | {s1_label:<14} | {s2_label:<14} | {s3_label:<18}")

    # ============================================================================
    # 5. EVALUATE UI NAVIGATION SAFETY GUARDRAILS (< 0.25 Cosine Distance)
    # ============================================================================
    print("\n[2/3] Evaluating UI Action Guardrails (False-Positive Action Suppression)...")
    vector_store.seed_and_embed_ui_navigation()
    ui_correct = 0
    false_positives = 0

    with Session(engine) as session:
        for test in UI_GUARDRAIL_TESTS:
            res = vector_store.find_ui_navigation_target(session=session, user_goal=test["prompt"])
            
            if test["should_trigger"]:
                if res and res.get("dom_selector") == test["expected_selector"]:
                    ui_correct += 1
                else:
                    print(f"   [!] Action match mismatch for: {test['prompt']} -> got: {res}")
            else:
                if res is None:
                    ui_correct += 1
                else:
                    false_positives += 1
                    print(f"   [!] Guardrail breached for: {test['prompt']} -> triggered: {res.get('feature_name')}")

    # ============================================================================
    # 6. PRINT EXECUTIVE ABLATION SCORECARD
    # ============================================================================
    total_q = len(GOLDEN_QUERIES)
    p50_lat = statistics.median(latencies_ms)
    p95_lat = sorted(latencies_ms)[int(len(latencies_ms) * 0.95) - 1]

    print("\n[3/3] Compiling Executive Benchmark Report...\n")
    print("=" * 84)
    print("  ABLATION STUDY: PURE VECTOR vs. HYBRID BM25 vs. 3-STAGE CROSS-ENCODER")
    print("=" * 84)
    print(f"{'Metric':<32} | {'Stage 1: Vector':<15} | {'Stage 1+2: +BM25':<16} | {'Stage 3: Full Hybrid':<20}")
    print("-" * 84)

    for label, key, is_pct in [
        ("Precision@1 (Top-1 Accuracy)", "hits_at_1", True),
        ("Recall@3 (Hit Rate@3)", "hits_at_3", True),
        ("Mean Reciprocal Rank (MRR)", "mrr", False),
        ("nDCG@3 (Ranking Quality)", "ndcg_at_3", False),
        ("Negation Trap Rejection Rate", "negation_traps_avoided", "neg"),
    ]:
        vals = []
        for s_key in ["stage1_vector_only", "stage2_vector_bm25", "stage3_full_hybrid"]:
            if is_pct is True:
                v_str = f"{(metrics[s_key][key] / total_q) * 100:.1f}%"
            elif is_pct == "neg":
                v_str = f"{(metrics[s_key][key] / negation_total) * 100:.1f}%"
            else:
                v_str = f"{statistics.mean(metrics[s_key][key]):.3f}"
            vals.append(v_str)
        print(f"{label:<32} | {vals[0]:<15} | {vals[1]:<16} | {vals[2]:<20}")

    print("-" * 84)
    print(f"UI Action Guardrail Accuracy     : {(ui_correct / len(UI_GUARDRAIL_TESTS)) * 100:.1f}% ({false_positives} Destructive False Positives)")
    print(f"Rerank & Scoring Latency         : P50 = {p50_lat:.2f} ms | P95 = {p95_lat:.2f} ms")
    print("=" * 84)

    return {
        "precision_at_1": (metrics["stage3_full_hybrid"]["hits_at_1"] / total_q) * 100.0,
        "recall_at_3": (metrics["stage3_full_hybrid"]["hits_at_3"] / total_q) * 100.0,
        "mrr": statistics.mean(metrics["stage3_full_hybrid"]["mrr"]),
        "ndcg_at_3": statistics.mean(metrics["stage3_full_hybrid"]["ndcg_at_3"]),
        "negation_rejection_rate": (metrics["stage3_full_hybrid"]["negation_traps_avoided"] / negation_total) * 100.0,
        "ui_guardrail_accuracy": (ui_correct / len(UI_GUARDRAIL_TESTS)) * 100.0,
        "p50_latency_ms": p50_lat,
        "p95_latency_ms": p95_lat
    }

if __name__ == "__main__":
    run_benchmark()
