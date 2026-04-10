# Project Guidelines

## Code Style
- Keep TypeScript strict and avoid `any` unless there is no practical alternative.
- Follow existing patterns in [server.ts](server.ts), [services/dbService.ts](services/dbService.ts), and [src/App.tsx](src/App.tsx).
- Prefer small focused changes; do not refactor unrelated areas in the same task.

## Architecture
- Frontend is a single-page React app in [src/App.tsx](src/App.tsx).
- Backend API is in [server.ts](server.ts), including AI proxy and Vite middleware integration.
- Persistence is SQLite via [services/dbService.ts](services/dbService.ts), with `activity_records` as the unified activity timeline source.
- AI behavior and intent contract are defined in [services/systemPrompt.ts](services/systemPrompt.ts).
- For detailed architecture and endpoint list, see [CLAUDE.md](CLAUDE.md).

## Build and Test
- Install: `npm install`
- Dev server: `npm run dev`
- Type check: `npm run lint`
- Production build: `npm run build`
- Preview build: `npm run preview`

## Conventions
- Keep AI response shape stable: `{ intent, data, message }`.
- When changing intent names or payload fields, update both frontend handling in [src/App.tsx](src/App.tsx) and backend persistence in [server.ts](server.ts)/[services/dbService.ts](services/dbService.ts) in the same change.
- Maintain intent-driven logging behavior:
  - Most logging intents are auto-saved through `/api/save-record`.
  - `log_food_multi` is a special flow that waits for user confirmation before final save.
- Treat `activity_records` as the primary source for history views unless a task explicitly requires otherwise.

## Environment and Pitfalls
- Required env for OpenAI path: `OPENAI_API_KEY`.
- Optional envs used by backend: `OPENAI_BASE_URL`, `OPENAI_MODEL`, `NODE_ENV`.
- Database file is `fitness.sqlite` at workspace root; ensure write permissions when debugging local failures.
- `npm run clean` uses `rm -rf dist`; on some Windows shells this may fail. If needed, use an equivalent shell command manually.

## References
- Project overview and API summary: [CLAUDE.md](CLAUDE.md)
- Local run basics: [README.md](README.md)