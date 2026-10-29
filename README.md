# MahallEN — AI-Powered Neighborhood Livability Report

**Course:** SE3003 – Software Project Management  
**Team:** Axiom  
**Pilot Scope:** Muğla (Kötekli, Emirbeyazıt, Muslihittin, Orhaniye, Akyaka)

MahallEN aims to answer *"Is this neighborhood a good place to live?"* with a single, source-backed report covering **Safety & News**, **Rent & Cost**, **Transportation Accessibility**, **Earthquake Hazard**, and **Social Life & Daily Amenities**, plus suitability ratings for **University Students**, **Families**, and **Working Professionals**.

**Current stage: pilot prototype.** The first source-backed static release covers all five neighborhoods (#7), with unknown fields and source-review status retained. Versioned prompts and an explicit Gemini Search API client are available (#9); the survey analysis and team-selected weights (32% cost, 28% social, 20% safety/news, 10% disaster, 10% transport) are documented (#8) and implemented in the frontend scoring module. The new template UI and horizontal category score charts (#10) as well as persistent SQLite/PostgreSQL report caching (`ReportCache`, `X-Cache: HIT/MISS`, and cache invalidation endpoint) (#11) are implemented. Remaining open work includes migrating the backend runtime database from illustrative seed data (`seed_service.py`) to the static JSON dataset, integrating the #8 weights and numeric `social_life` score into the backend scoring service, and completing human factual review. No completed MVP or official AFAD integration is claimed.

See [Implementation Verification (#24)](docs/IMPLEMENTATION_VERIFICATION.md) for the full feature audit, test/build evidence, and remaining tasks across #7, #8, #9, #10, and #11, and [today's M2 roadmap](docs/ROADMAP_M2.md) for the board snapshot and task order.

The first source-backed static dataset covers all five pilot neighborhoods: see [data manifest](data/manifest.json) and [data dictionary](data/README.md). Unknown fields and source-review status are retained. The React frontend connects search, district filters, profile suitability ranking, and 5-category horizontal score charts (`ScoreBarChart`) to the backend API without treating missing category scores as zero. The backend database still seeds illustrative M1 data by default; connecting the static JSON records and 5-category weights directly into the live report/cache pipeline remains open work. [Data Sources](docs/DATA_SOURCES.md) records the collection methods and limitations.

---

## Team Axiom & Agile Cross-Functional Structure

Team Axiom operates as an **Agile, self-organizing, cross-functional squad**. Rather than rigid silos, every team member contributes across the full stack—**Data Pipeline, Backend API, AI/LLM Integration, Frontend UI/UX, and QA/Testing**—rotating focus areas across sprints while maintaining shared ownership of the entire codebase.

| Student ID | Name | Team Structure & Agile Contribution |
| :--- | :--- | :--- |
| **230717048** | **Osman Kalkan** | Cross-Functional Developer (Full-Stack, AI/LLM, Data, QA & Sprint Coordination) |
| **230717014** | **Şükrü Tan** | Cross-Functional Developer (Full-Stack, Backend/Data, AI/LLM, UI & QA) |
| **230717027** | **Irmak Köse** | Cross-Functional Developer (Full-Stack, Frontend/UX, Backend, AI/LLM & QA) |
| **230717056** | **Ferdi Derebaşı** | Cross-Functional Developer (Full-Stack, QA/Testing, Data Analysis, Backend & UI) |

---

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2, persistent `ReportCache` (`X-Cache: HIT/MISS`)
- **Database:** local SQLite by default; PostgreSQL 16 via Docker Compose. Optional SQLite fallback is restricted to explicitly enabled development use.
- **AI / LLM Layer:** demo synthesis by default. The existing Gemini integration skeleton is disabled until an operator configures a supported model, API key and refresh secret. Versioned research prompts and the `google-genai` Search grounding client are in `backend/scripts/grounding_client.py` (#9); persistent report caching is in `backend/app/services/cache_service.py` (#11).
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons (template UI & 0–100 horizontal score bar charts #10)
- **Testing:** Pytest (55 tests) & FastAPI `TestClient`, Node ESM scoring tests (`frontend/scripts/test-scoring.mjs`)

---

## Quick Start

### 1. Run Backend API locally (SQLite, no API key required)
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt

# Local configuration; defaults keep live AI disabled
copy .env.example .env

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive Swagger API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/v1/health`

### 2. Run Frontend Web App (React + Vite)
```bash
cd frontend
npm ci
npm run dev
```
- Open `http://localhost:5173` in your browser.

### 3. Run Automated QA Tests
```bash
cd backend
python -m pytest -q
```

Tests create an isolated in-memory SQLite database per test, never use the development database, and never call Gemini. The backend environment was verified with Python 3.12; the Docker image uses Python 3.11.

### 4. Optional Docker Compose (PostgreSQL + backend)

From the repository root, copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` to a random hex password. Generate one locally with `python -c "import secrets; print(secrets.token_hex(32))"`. Then run:

```bash
docker compose up --build -d
```

Compose reads the root `.env`; local Python development reads `backend/.env`. Database and API ports bind to `127.0.0.1`. The image runs as a non-root user without reload, and excludes local secrets and database files. If reusing an existing PostgreSQL volume, its existing password must match; changing an environment variable does not rotate that database user's password.

### Existing AI endpoint safeguards

Ordinary report reads and the UI's **Refresh report** button only reload demo synthesis. They never initiate a paid/provider call, including when a seed summary is missing.

The optional `?refresh_ai=true` path is operator-only: configure `GEMINI_API_KEY`, a supported `GEMINI_MODEL`, and an `AI_REFRESH_TOKEN` of at least 32 random characters on the backend, then send that secret in `X-AI-Refresh-Token`. Never place either secret in frontend code or `VITE_*` variables. The endpoint admits at most one live attempt per 60 seconds across neighborhoods **per API process**; failed attempts also consume that interval. Keep the current single-process/local setup; shared limiting must precede multi-worker deployment. Invalid, oversized, HTML-containing or unavailable model output returns the demo fallback.

The explicit Gemini Search research client, versioned prompts and source acceptance flow are documented in [LLM Integration](docs/LLM_INTEGRATION.md). This separate #9 module does not replace the M1 demo report endpoint. Persistent report caching (`ReportCache`, TTL, hit counter, and operator-only `DELETE /api/v1/neighborhoods/{slug}/cache`) is implemented (#11); full verification and remaining integration items are recorded in [Implementation Verification (#24)](docs/IMPLEMENTATION_VERIFICATION.md).
