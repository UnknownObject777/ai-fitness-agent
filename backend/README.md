# Sparky FastAPI Backend

This backend replaces the legacy Express server with FastAPI plus a LangGraph agent graph.

## Development

Install Python dependencies:

```bash
uv sync
```

Run the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

From the repository root, run both frontend and backend:

```bash
npm run dev:all
```

## Verification

```bash
uv run pytest -v
uv run python -m compileall app tests
```

The backend reads the existing SQLite database by default from `../fitness.sqlite` and stores uploads in `../uploads`.

