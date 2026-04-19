<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Sparky AI Fitness Agent

React mobile-style fitness assistant with a FastAPI + LangGraph backend.

The legacy Express server has been preserved as `server.ts.legacy`; active development now runs Vite and FastAPI as separate services.

## Run Locally

**Prerequisites:** Node.js, Python 3.11+, uv

1. Install frontend dependencies:

   ```bash
   npm install
   ```

2. Install backend dependencies:

   ```bash
   cd backend
   uv sync
   ```

3. Configure `.env` in the repository root or `backend/.env`.

4. Run both services:

   ```bash
   npm run dev:all
   ```

Frontend runs on Vite and proxies `/api` plus `/uploads` to FastAPI on port 8000.

## Checks

```bash
npm run lint
npm run build
cd backend
uv run pytest -v
```
