# MahallEN — AI-Powered Neighborhood Livability Report

**Course:** SE3003 – Software Project Management  
**Team:** Axiom  
**Pilot Scope:** Muğla (Kötekli, Emirbeyazıt, Muslihittin, Orhaniye, Akyaka)

MahallEN is an AI-powered web application that answers *"Is this neighborhood a good place to live?"* with a single, source-backed report. By combining public data across **Safety & News**, **Rent & Cost**, **Transportation Accessibility**, **AFAD Earthquake Hazard**, and **Community Sentiment**, MahallEN computes transparent category scores and suitability ratings for **University Students**, **Families**, and **Working Professionals**.

---

## Team Axiom & Architecture Ownership

| Student ID | Name | Role | Primary Codebase Modules |
| :--- | :--- | :--- | :--- |
| **230717048** | **Osman Kalkan** | Project Manager / AI & LLM Integration | `backend/app/services/ai_service.py`, `backend/app/services/scoring_service.py` |
| **230717014** | **Şükrü Tan** | Data Engineer / Backend Developer | `backend/app/models/`, `backend/app/api/`, `backend/app/core/database.py`, `docker-compose.yml` |
| **230717027** | **Irmak Köse** | Frontend Developer / UX Designer | `frontend/src/components/`, `frontend/src/App.jsx`, UI/UX Visualizations |
| **230717056** | **Ferdi Derebaşı** | QA Engineer / Documentation & Data Analyst | `backend/tests/`, `backend/app/services/seed_service.py`, Data Validation & Docs |

---

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Database:** PostgreSQL 16 (via Docker Compose) with automatic local SQLite fallback (`AUTO_FALLBACK_SQLITE=True`) for zero-friction local development
- **AI / LLM Layer:** Google Gemini API (`google-generativeai`) with grounded RAG prompts + deterministic fallback synthesis engine (mitigates Risk R-02 & R-05)
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons
- **Testing:** Pytest & FastAPI `TestClient`

---

## Quick Start

### 1. Start PostgreSQL Database (Optional if using local fallback)
```bash
docker-compose up -d db
```

### 2. Run Backend API (FastAPI)
```bash
cd backend
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy environment variables (optional: add GEMINI_API_KEY in .env)
copy .env.example .env

uvicorn app.main:app --reload --port 8000
```
- Interactive Swagger API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/v1/health`

### 3. Run Frontend Web App (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
- Open `http://localhost:5173` in your browser.

### 4. Run Automated QA Tests
```bash
cd backend
pytest
```
