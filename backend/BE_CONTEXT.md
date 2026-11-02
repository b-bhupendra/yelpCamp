# Backend Context (`BE_CONTEXT.md`) — Meadows FastAPI Backend

> **Quick Summary**: The Meadows backend is a production-grade, enterprise-ready REST API built with **FastAPI**, **SQLModel** (SQLAlchemy + Pydantic v2), and **Turso (libSQL/SQLite)** with DiskANN vector search. It integrates **Google Gemini 3.5 & Multimodal Embedding models** for AI Co-Pilot agentic navigation and semantic search, **Cloudinary CDN** for media delivery, **Google OAuth 2.0 + JWT cookies/headers** for authentication, **SlowAPI** for rate limiting, and an isolated automated **pytest** suite backed by SQLite.

---

## 1. Tech Stack & Environment

| Layer | Technology | Details / Purpose |
| :--- | :--- | :--- |
| **Framework** | FastAPI (`^0.115.0`) | Modern async web framework with automatic OpenAPI documentation (`/docs`) |
| **ASGI Server** | Uvicorn (`^0.30.0`) | High-performance ASGI server (`uvicorn app.main:app --host 127.0.0.1 --port 8000`) |
| **ORM & Validation** | SQLModel (`^0.0.22`) | Unifies SQLAlchemy models and Pydantic v2 validation schemas |
| **Database** | Turso (libSQL) / SQLite | Cloud libSQL via HTTP v2 pipeline or local `database.db` with PRAGMA foreign_keys |
| **AI & Embeddings** | Google Gemini (`google-genai`) | `gemini-embedding-2` (768-dim vectors) & `gemini-3.5-flash` for RAG and agent actions |
| **CDN & Image Storage** | Cloudinary (`cloudinary^1.41.0`) | Automated WebP conversion, responsive delivery, and thumbnail crops under `meadows/` |
| **Authentication** | PyJWT (`^2.9.0`) + Passlib | Secure JWT access tokens via HTTP-only cookies and `Authorization: Bearer <token>` |
| **Rate Limiter** | SlowAPI (`slowapi^0.1.9`) | IP-based rate limiting per route (auth, social actions, AI copilot, media upload) |
| **Testing Suite** | Pytest (`pytest^8.0.0`, `httpx`) | Isolated automated unit and integration tests using SQLite `test.db` and TestClient |

---

## 2. Enterprise Clean Architecture Layout

```text
backend/
├── main.py                         # Root entrypoint proxy (from app.main import app)
├── Dockerfile                      # Production Cloud Run container definition
├── alembic.ini                     # Alembic migration configuration
├── pytest.ini                      # Pytest suite configuration
├── requirements.txt                # Production and testing Python dependencies
├── alembic/                        # Database migration scripts
│   ├── env.py                      # Configured to inspect SQLModel metadata
│   └── versions/                   # Migration versions
├── api/                            # Vercel Serverless Function entrypoint
│   └── index.py                    # Imports app from app.main
├── app/                            # Primary application package
│   ├── main.py                     # FastAPI app factory, lifespan, CORS, route dual-mounting
│   ├── api/                        # API Routing & Controllers
│   │   ├── deps.py                 # Dependencies (get_db, get_current_user, is_logged_in)
│   │   └── v1/
│   │       ├── api.py              # Central API router aggregator (mounts endpoints)
│   │       └── endpoints/          # Thin controllers
│   │           ├── auth.py         # Register, login, logout, Google OAuth, /api/me
│   │           ├── campgrounds.py  # Campsites CRUD, pagination, image upload
│   │           ├── comments.py     # Threaded hierarchy comments & reviews
│   │           ├── visitor_photos.py # Stories, backcountry moments, likes & photo comments
│   │           ├── social.py       # Upvotes, downvotes, wishlists, check-ins, trips, dashboard
│   │           └── vector_rag.py   # Semantic search, RAG chat, AI Co-Pilot agent & UI sync
│   ├── core/                       # Core infrastructure & configuration
│   │   ├── config.py               # Pydantic BaseSettings loading from .env or .env.test
│   │   ├── database.py             # Engine factory, SQLite triggers, Alembic runner
│   │   ├── security.py             # Password hashing (bcrypt) & JWT encode/decode
│   │   └── turso_engine.py         # Turso Cloud HTTP v2 pipeline adapter
│   ├── models/                     # Relational domain models (SQLModel table=True)
│   │   ├── user.py                 # User table
│   │   ├── campground.py           # Campground, Vote, CampgroundEmbedding
│   │   ├── comment.py              # Comment table
│   │   ├── visitor_photo.py        # VisitorPhoto, VisitorPhotoLike
│   │   ├── social.py               # Wishlist, CheckIn, Trip, TripMember
│   │   └── ui_navigation.py        # UINavigation table
│   ├── schemas/                    # Pydantic request/response validation schemas (DTOs)
│   │   ├── common.py               # PaginatedResponse, FileUploadResponse
│   │   ├── auth.py                 # UserCreate, UserLogin, UserOut, TokenResponse
│   │   ├── campground.py           # CampgroundCreate, CampgroundUpdate, CampgroundOut, PaginatedCampgrounds
│   │   ├── comment.py              # CommentCreate, CommentOut
│   │   ├── visitor_photo.py        # VisitorPhotoCreate, VisitorPhotoOut, VisitorStoryGroupOut
│   │   ├── social.py               # DashboardResponse, CheckInOut, TripOut
│   │   └── rag.py                  # SearchRequest, ChatRequest, AgentInteractRequest/Response
│   ├── services/                   # Business logic layer
│   │   ├── auth_service.py         # Authentication and registration logic
│   │   ├── campground_service.py   # Campsite business workflows
│   │   ├── comment_service.py      # Comment workflows
│   │   ├── story_service.py        # Story tray and moments logic
│   │   ├── cloudinary_service.py   # CDN uploads and avatar generation
│   │   ├── google_auth_service.py  # Google ID token verification
│   │   ├── image_validator.py      # Moderation and image sanitization
│   │   ├── limiter.py              # SlowAPI rate limiter
│   │   ├── multimodal_embedder.py  # Gemini vector embeddings (768-dim)
│   │   ├── rag_service.py          # Gemini AI Co-Pilot reasoning and function calling
│   │   └── vector_store.py         # 3-stage hybrid search & FlashRank reranker
│   └── repositories/               # SQL offload layer (pure database computation)
│       ├── campground_repo.py      # Paginated search, single-pass metrics, cascade delete
│       ├── comment_repo.py         # Threaded recursive trees, author map hydration
│       ├── story_repo.py           # json_group_array(json_object(...)) grouping
│       └── social_repo.py          # Atomic voting, wishlist toggling, dashboard summaries
└── tests/                          # Automated Pytest Suite
    ├── conftest.py                 # Test fixtures (test_engine, db_session, client, auth_headers)
    ├── test_auth.py                # Registration, login, JWT cookies, profile retrieval
    ├── test_campgrounds.py         # Pagination, creation, updates, deletes
    ├── test_comments.py            # Comments, threaded replies, SQLite rating recalculation triggers
    ├── test_stories.py             # Story tray, moments, like toggling
    └── test_api_integration.py     # End-to-end user lifecycle & dual-mount verification
```

---

## 3. Running Tests & Verification

All Python commands should be executed via `uv run` to guarantee isolated execution with pinned dependencies:

```bash
# Run the complete test suite
cd backend
uv run --with-requirements requirements.txt python -m pytest tests/ -v

# Run the 3-stage hybrid RAG & agent guardrail benchmark
uv run --with-requirements requirements.txt python eval_rag.py

# Run development server
uv run --with-requirements requirements.txt uvicorn app.main:app --reload --port 8000
```
