# 🏕️ YelpCamp — Enterprise Outdoor Campsite Platform & AI Co-Pilot

A production-grade, distributed wilderness campsite discovery platform built with **React 19, FastAPI, Turso (libSQL Cloud), Google Gemini Multi-Modal Embeddings & Flash Agent, and Cloudinary CDN**.

---

## 📊 Retrieval & Agentic Guardrail Benchmarks (`backend/eval_rag.py`)

Standard bi-encoder vector search (`vector_top_k`) compresses an entire query into a single dense vector, causing catastrophic failures on **semantic negations** (*"no loud music or DJ"*) and **rare geographic proper nouns** (*"Munsiyari Khaliya Top"*, *"Darma Valley"*). 

We benchmarked our **3-Stage Hybrid Retrieval Funnel** against pure dense vector search across our Golden Evaluation Suite:

| Evaluation Metric | Stage 1: Pure Vector (`gemini-embedding-2`) | Stage 1+2: Hybrid (`Vector + SQLite FTS5 BM25`) | Stage 3: Full Pipeline (`+ FlashRank / Negation Cross-Encoder`) |
| :--- | :---: | :---: | :---: |
| **Precision@1 (Top-1 Accuracy)** | `25.0%` | `37.5%` | **`100.0%`** |
| **Recall@3 (Hit Rate@3)** | `100.0%` | `100.0%` | **`100.0%`** |
| **Mean Reciprocal Rank (MRR)** | `0.583` | `0.667` | **`1.000`** |
| **nDCG@3 (Ranking Quality)** | `0.690` | `0.753` | **`1.000`** |
| **Negation Trap Rejection Rate** | `0.0%` *(Failed all traps)* | `0.0%` *(Failed all traps)* | **`100.0%`** *(Penalized to `0.04`)* |
| **UI Action Guardrail (`< 0.25` dist)** | N/A | N/A | **`100.0%`** *(0 Destructive False Highlights)* |

> **Reproduce locally:** `cd backend && .\venv\Scripts\python.exe eval_rag.py`

---

## 🏛️ System Architecture

- **Frontend:** React 19, Vite, Tailwind CSS v4, Driver.js UI Spotlight, Lucide Icons.
- **Backend:** FastAPI, Python 3.12, SQLModel, Pydantic v2, SlowAPI Rate Limiting.
- **Database Engine:** Turso (libSQL Edge Cloud with native DiskANN vector index) + local SQLite WAL fallback.
- **AI Intelligence:** Google Gemini Multi-Modal Embeddings 2, Gemini 3.5 Flash Copilot, FlashRank Cross-Encoder reranker.
- **Media Ingestion:** Cloudinary Auto-tagging CDN with automatic image validation and fallback handling.
- **Deployment:** Google Cloud Run (Asia-South1 Mumbai) + Vercel Production (`https://ycamp.vercel.app`).
