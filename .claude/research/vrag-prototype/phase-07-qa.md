# Phase 07 QA -- VRAG Prototype Separation Review

**Date**: 2026-02-26
**Reviewer**: Claude (code review)
**Verdict**: PASS

## Summary

All three deliverables -- `vrag_server.py`, `nextjs-app/app/actions/vrag.ts`, and justfile recipes -- are correct, well-isolated, and lint/type-clean.

## Checks Performed

### 1. `python-services/vrag_server.py`

| Check | Result |
|---|---|
| Imports only `agent_api.vrag` (no main app imports) | PASS -- 3 imports, all `agent_api.vrag.*` |
| Mounts VRAG routes at `/api` prefix | PASS -- `include_router(vrag_routes.router, prefix="/api")` + router has `prefix="/vrag"` = `/api/vrag/*` |
| Starts sync worker via lifespan | PASS -- gated by `VRAG_SYNC_WORKER_ENABLED`, graceful shutdown via `vrag_shutdown_event` |
| CORS for port 63100 | PASS -- `http://localhost:63100` + `http://127.0.0.1:63100` + dev port 3000 |
| Loads `.env` | PASS -- `dotenv_path=Path(__file__).parent / ".env"` |
| Logging configured before imports | PASS -- stdout/stderr split before FastAPI import |
| `ruff check` | PASS -- 0 issues |

**Isolation note**: The only non-vrag import from `agent_api` is `agent_api.logging_utils` (a pure logging utility with no app dependencies). This is acceptable -- it's a leaf utility with zero coupling to the main app.

### 2. `nextjs-app/app/actions/vrag.ts`

| Check | Result |
|---|---|
| `getVragApiUrl()` reads `VRAG_API_URL` first, falls back to `getPythonApiUrl()` | PASS -- `process.env.VRAG_API_URL \|\| getPythonApiUrl()` |
| All 6 fetch-based actions use `getVragApiUrl()` | PASS -- `getVragCorpus`, `createVragCorpus`, `getVragFiles`, `uploadVragFile`, `deleteVragFile`, `searchVrag` |
| `getVragProjects` uses Supabase directly (correct -- no Python API needed) | PASS |
| URL paths match server routes (`/api/vrag/corpus`, `/api/vrag/files/*`, etc.) | PASS |
| `uploadVragFile` omits Content-Type header (correct for FormData) | PASS |
| TypeScript compiles | PASS -- `tsc --noEmit` reports 0 vrag-related errors |

### 3. Justfile recipes

| Check | Result |
|---|---|
| `vrag-api` starts uvicorn on port 58100 with `--reload-dirs agent_api` | PASS |
| `vrag-ui` starts Next.js on port 63100 with `VRAG_API_URL=http://localhost:58100` | PASS |
| `vrag` runs both in parallel | PASS -- `[parallel]` attribute |
| `vrag-kill` clears ports 58100 + 63100 | PASS |
| `NEXT_PUBLIC_SITE_URL` set correctly for 63100 | PASS |

### 4. Isolation Verification

- `vrag_server.py` imports: `dotenv`, `fastapi`, `agent_api.vrag.*`, `agent_api.logging_utils` -- **no main app imports**
- `agent_api/vrag/*.py` imports: only `agent_api.logging_utils`, `agent_api.vrag.*`, third-party (`vertexai`, `supabase`, `google.api_core`) -- **no main app imports**
- Server actions: when `VRAG_API_URL` is set, all fetches go to standalone server; fallback to `getPythonApiUrl()` is intentional for embedded mode

### 5. Lint & Type Results

```
python-services$ uv run ruff check vrag_server.py        -> All checks passed!
python-services$ uv run ruff check agent_api/vrag/       -> All checks passed!
nextjs-app$ bunx tsc --noEmit | grep -i vrag             -> (no output = clean)
```

## Minor Observations (not blocking)

1. **`getVragCorpus` and `createVragCorpus` are identical** -- both POST to `/api/vrag/corpus`. The backend `ensure_corpus` is idempotent (get-or-create), so they do the same thing. Consider collapsing to a single action in a future cleanup.

2. **`vrag-ui` runs `bun run dev`** (foreground). The `agent-dev-*` recipes use `nohup` for background mode. If a background variant is needed later, follow the `agent-dev-*` pattern.

3. **Route double-prefix**: `vrag_server.py` mounts with `prefix="/api"` and the router has `prefix="/vrag"`, resulting in `/api/vrag/*`. This matches the main app's structure, which is the intent. Clear and correct.
