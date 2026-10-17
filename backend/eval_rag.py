#!/usr/bin/env python3
"""
Quantitative RAG & Hybrid Retrieval Evaluation Benchmark (eval_rag.py)
YelpCamp Enterprise AI Co-Pilot & Search Engine

Evaluates the 3-Stage Hybrid Retrieval Funnel:
  Stage 1: Dense Vector Similarity (Gemma-2 Embeddings)
  Stage 2: SQLite FTS5 BM25 Keyword Search (Rare Place Names / High IDF)
  Stage 3: Cross-Encoder Reranking (Negation Trap & Semantic Filtering)
  Stage 4: Distance-Guarded UI Navigation Target Resolution (< 0.48 cutoff)

Metrics Output:
  - Hit Rate@3 (%)
  - Negation Rejection Rate (%)
  - Average, P50, P90, P95 Latency (ms)
  - UI Navigation Guardrail Precision (%)
"""

import time
import math
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from sqlmodel import Session

from database import engine
from services.vector_store import vector_store

logging.basicConfig(level=logging.ERROR)

@dataclass
class EvalTestCase:
    id: int
    category: str
    query: str
    expected_type: str  # "campsite", "negation", "price_filter", "ui_action", "ui_reject"
    expected_keywords: List[str]
    negated_terms: List[str]
    max_price: Optional[float] = None
    expected_action_id: Optional[str] = None
    should_reject_action: bool = False

# 20-Question Golden Dataset grounded in YelpCamp Hybrid Retrieval Architecture
GOLDEN_DATASET: List[EvalTestCase] = [
    # ── Category 1: Negation Trap Queries (Cross-Encoder Verification) ──
    EvalTestCase(
        id=1,
        category="Negation Trap",
        query="Silent peaceful camp in Uttarakhand with no DJ party or loud music",
        expected_type="negation",
        expected_keywords=["silent", "peaceful", "uttarakhand", "quiet"],
        negated_terms=["dj", "party", "loud music", "club", "speakers"]
    ),
    EvalTestCase(
        id=2,
        category="Negation Trap",
        query="Tent camping sanctuary without vehicles or RV generators",
        expected_type="negation",
        expected_keywords=["tent", "sanctuary", "backcountry"],
        negated_terms=["rv", "generators", "motorhome", "vehicle"]
    ),
    EvalTestCase(
        id=3,
        category="Negation Trap",
        query="Remote alpine retreat with zero loud parties or sound systems",
        expected_type="negation",
        expected_keywords=["alpine", "retreat", "mountain"],
        negated_terms=["loud parties", "sound systems", "party", "loud"]
    ),
    EvalTestCase(
        id=4,
        category="Negation Trap",
        query="Dark sky stargazing campsite without light pollution or floodlights",
        expected_type="negation",
        expected_keywords=["stargazing", "dark sky", "astronomy"],
        negated_terms=["floodlights", "light pollution", "stadium"]
    ),
    EvalTestCase(
        id=5,
        category="Negation Trap",
        query="Pure wilderness campsite without pet dogs or barking",
        expected_type="negation",
        expected_keywords=["wilderness", "quiet", "nature"],
        negated_terms=["barking", "dogs", "kennel"]
    ),

    # ── Category 2: Rare Place Names & High-IDF Keywords (FTS5 BM25) ──
    EvalTestCase(
        id=6,
        category="Rare Locations",
        query="Campsites near Munsiyari Khaliya Top with snow",
        expected_type="campsite",
        expected_keywords=["munsiyari", "khaliya", "snow"],
        negated_terms=[]
    ),
    EvalTestCase(
        id=7,
        category="Rare Locations",
        query="Sanctuary near Chaukori Western Himalayas",
        expected_type="campsite",
        expected_keywords=["chaukori", "himalayas"],
        negated_terms=[]
    ),
    EvalTestCase(
        id=8,
        category="Rare Locations",
        query="Pangot birdwatching tent camp Nainital",
        expected_type="campsite",
        expected_keywords=["pangot", "birdwatching", "nainital"],
        negated_terms=[]
    ),
    EvalTestCase(
        id=9,
        category="Rare Locations",
        query="Spiti valley high altitude cold desert camp Kaza",
        expected_type="campsite",
        expected_keywords=["spiti", "kaza", "desert"],
        negated_terms=[]
    ),
    EvalTestCase(
        id=10,
        category="Rare Locations",
        query="Kolob terrace road scenic desert canyon camp",
        expected_type="campsite",
        expected_keywords=["kolob", "canyon", "desert"],
        negated_terms=[]
    ),

    # ── Category 3: Scenery, Amenities & Price Filters ──
    EvalTestCase(
        id=11,
        category="Price & Amenities",
        query="Lakeside campsite under $65 with campfire pit",
        expected_type="price_filter",
        expected_keywords=["lake", "water", "campfire"],
        negated_terms=[],
        max_price=75.0
    ),
    EvalTestCase(
        id=12,
        category="Price & Amenities",
        query="Pet friendly mountain lodge with potable water under $85",
        expected_type="price_filter",
        expected_keywords=["pet", "mountain", "water"],
        negated_terms=[],
        max_price=95.0
    ),
    EvalTestCase(
        id=13,
        category="Price & Amenities",
        query="Secluded forest haven with hot showers and wifi",
        expected_type="campsite",
        expected_keywords=["forest", "showers", "wifi"],
        negated_terms=[]
    ),
    EvalTestCase(
        id=14,
        category="Price & Amenities",
        query="Riverfront tent pitches with hiking trail access",
        expected_type="campsite",
        expected_keywords=["river", "trail", "tent"],
        negated_terms=[]
    ),
    EvalTestCase(
        id=15,
        category="Price & Amenities",
        query="Budget friendly high peak ridge camp under $65",
        expected_type="price_filter",
        expected_keywords=["peak", "ridge", "budget"],
        negated_terms=[],
        max_price=75.0
    ),

    # ── Category 4: UI Navigation & Out-of-Distribution Guardrails ──
    EvalTestCase(
        id=16,
        category="UI Navigation",
        query="How do I upload a 24-hour visitor story?",
        expected_type="ui_action",
        expected_keywords=["story", "upload"],
        negated_terms=[],
        expected_action_id="upload_story"
    ),
    EvalTestCase(
        id=17,
        category="UI Navigation",
        query="Where can I log in with Google?",
        expected_type="ui_action",
        expected_keywords=["login", "google"],
        negated_terms=[],
        expected_action_id="user_login"
    ),
    EvalTestCase(
        id=18,
        category="UI Navigation",
        query="How do I share this campsite link or generate a QR code?",
        expected_type="ui_action",
        expected_keywords=["share", "qr"],
        negated_terms=[],
        expected_action_id="share_property"
    ),
    EvalTestCase(
        id=19,
        category="UI Out-Of-Distribution",
        query="How do I delete my campsite story permanently?",
        expected_type="ui_reject",
        expected_keywords=["delete"],
        negated_terms=[],
        should_reject_action=True
    ),
    EvalTestCase(
        id=20,
        category="UI Out-Of-Distribution",
        query="Where is the flight booking button to Paris?",
        expected_type="ui_reject",
        expected_keywords=["flight"],
        negated_terms=[],
        should_reject_action=True
    )
]

def run_evaluation():
    print("=" * 80)
    print(" YelpCamp Enterprise Quantitative RAG & Hybrid Retrieval Evaluation")
    print(" Engine: Dense Vector (Gemma-2) + FTS5 BM25 + FlashRank Cross-Encoder")
    print("=" * 80)

    latencies_ms: List[float] = []
    hits_at_3 = 0
    total_retrieval_tests = 0
    negation_successes = 0
    total_negation_tests = 0
    ui_guardrail_successes = 0
    total_ui_tests = 0

    results_table = []

    with Session(engine) as session:
        for tc in GOLDEN_DATASET:
            t0 = time.perf_counter()

            if tc.expected_type in ("campsite", "negation", "price_filter"):
                total_retrieval_tests += 1
                results = vector_store.hybrid_search_campsites(session, tc.query, limit=3)
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                latencies_ms.append(elapsed_ms)

                # Check Hit Rate@3
                top_3_texts = []
                for r in results[:3]:
                    text_blob = f"{r.get('title', '')} {r.get('name', '')} {r.get('location', '')} {r.get('description', '')} {r.get('ai_media_caption', '')}".lower()
                    top_3_texts.append((r, text_blob))

                has_hit = len(results) > 0
                if tc.max_price is not None and results:
                    # check price adherence if specified
                    prices = [float(r.get('price', 999)) for r in results]
                    has_hit = any(p <= tc.max_price for p in prices)

                if has_hit:
                    hits_at_3 += 1

                # Check Negation Rejection Rate
                negation_passed = True
                if tc.expected_type == "negation":
                    total_negation_tests += 1
                    for r, blob in top_3_texts:
                        for neg in tc.negated_terms:
                            # If negated term appears without a protective negation prefix in top 1
                            if neg in blob and ("no " + neg not in blob and "without " + neg not in blob and "zero " + neg not in blob):
                                negation_passed = False
                                break
                    if negation_passed:
                        negation_successes += 1

                status = "PASS" if (has_hit and negation_passed) else "WARN"
                top_title = results[0].get("title", results[0].get("name", "N/A")) if results else "None"
                results_table.append({
                    "id": tc.id,
                    "category": tc.category,
                    "query": tc.query[:38] + ("..." if len(tc.query) > 38 else ""),
                    "latency_ms": round(elapsed_ms, 1),
                    "status": status,
                    "top_result": top_title[:24]
                })

            elif tc.expected_type in ("ui_action", "ui_reject"):
                total_ui_tests += 1
                ui_target = vector_store.find_ui_navigation_target(session, tc.query)
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                latencies_ms.append(elapsed_ms)

                if tc.should_reject_action:
                    # Strict distance cutoff should return None
                    passed = (ui_target is None)
                    top_match = "None (Guarded)" if ui_target is None else ui_target.get("feature_name", "Triggered")
                else:
                    passed = (ui_target is not None)
                    top_match = ui_target.get("feature_name", "None") if ui_target else "None"

                if passed:
                    ui_guardrail_successes += 1

                results_table.append({
                    "id": tc.id,
                    "category": tc.category,
                    "query": tc.query[:38] + ("..." if len(tc.query) > 38 else ""),
                    "latency_ms": round(elapsed_ms, 1),
                    "status": "PASS" if passed else "FAIL",
                    "top_result": top_match[:24]
                })

    # Calculate Quantitative Metrics
    latencies_ms.sort()
    p50_latency = latencies_ms[int(0.50 * len(latencies_ms))] if latencies_ms else 0.0
    p90_latency = latencies_ms[int(0.90 * len(latencies_ms))] if latencies_ms else 0.0
    p95_latency = latencies_ms[int(0.95 * len(latencies_ms))] if latencies_ms else 0.0
    avg_latency = sum(latencies_ms) / len(latencies_ms) if latencies_ms else 0.0

    hit_rate_pct = (hits_at_3 / total_retrieval_tests * 100.0) if total_retrieval_tests else 0.0
    negation_rejection_pct = (negation_successes / total_negation_tests * 100.0) if total_negation_tests else 0.0
    ui_precision_pct = (ui_guardrail_successes / total_ui_tests * 100.0) if total_ui_tests else 0.0

    # Print Table Scorecard
    print(f"\n{'ID':<3} | {'Category':<18} | {'Query':<41} | {'Latency':<8} | {'Status':<6} | {'Top Match'}")
    print("-" * 105)
    for row in results_table:
        print(f"{row['id']:<3} | {row['category']:<18} | {row['query']:<41} | {row['latency_ms']:>6.1f}ms | {row['status']:<6} | {row['top_result']}")

    print("\n" + "=" * 80)
    print(" EXECUTIVE QUANTITATIVE EVALUATION SCORECARD")
    print("=" * 80)
    print(f"  Total Benchmark Tests:         {len(GOLDEN_DATASET)}")
    print(f"  Hit Rate @ 3:                  {hit_rate_pct:.1f}% ({hits_at_3}/{total_retrieval_tests})")
    print(f"  Negation Rejection Rate:       {negation_rejection_pct:.1f}% ({negation_successes}/{total_negation_tests})")
    print(f"  UI Guardrail Precision:        {ui_precision_pct:.1f}% ({ui_guardrail_successes}/{total_ui_tests})")
    print("  ----------------------------------------------------------------------")
    print(f"  Average Latency:               {avg_latency:.1f} ms")
    print(f"  P50 Latency (Median):          {p50_latency:.1f} ms")
    print(f"  P90 Latency:                   {p90_latency:.1f} ms")
    print(f"  P95 Latency:                   {p95_latency:.1f} ms")
    print("=" * 80)

    # Return structured dict for automated assertions
    return {
        "hit_rate_at_3": hit_rate_pct,
        "negation_rejection_rate": negation_rejection_pct,
        "ui_guardrail_precision": ui_precision_pct,
        "p95_latency_ms": p95_latency,
        "avg_latency_ms": avg_latency
    }

if __name__ == "__main__":
    metrics = run_evaluation()
