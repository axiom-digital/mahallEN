# MahallEN — AI-Powered Neighborhood Livability Report

**Course:** SE3003 – Software Project Management  
**Team:** Axiom  
**Pilot Scope:** Muğla (Kötekli, Emirbeyazıt, Muslihittin, Orhaniye, Akyaka)

MahallEN is an AI-powered web application that answers *"Is this neighborhood a good place to live?"* with a single, source-backed report. By combining public data across **Safety & News**, **Rent & Cost**, **Transportation Accessibility**, **AFAD Earthquake Hazard**, and **Community Sentiment**, MahallEN computes transparent category scores and suitability ratings for **University Students**, **Families**, and **Working Professionals**.

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
