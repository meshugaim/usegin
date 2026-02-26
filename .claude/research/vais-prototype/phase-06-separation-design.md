# Phase 06: VAIS Prototype Separation Design

> Extract the VAIS prototype from the main app into standalone servers,
> following the established VRAG separation pattern.

## Current State

### Python side

| File | Role |
|------|------|
| `python-services/agent_api/api/vais.py` | FastAPI router: 5 endpoints (store status, upload, delete, list, search) |
| `python-services/agent_api/vais/` | Service package: `config.py`, `types.py`, `store_service.py`, `document_service.py`, `search_service.py`, `schema_service.py`, `sync_worker.py` |
| `python-services/agent_api/main.py` | Registers VAIS router at `/api/vais`, starts VAIS sync worker in lifespan |

**Dependencies of `agent_api/api/vais.py`:**
- `fastapi` (APIRouter, File, Form, HTTPException, UploadFile)
- `supabase` (create_client) -- creates its own service-role client via env vars
- `agent_api.vais.*` -- all within the VAIS package
- Environment vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Zero imports from main app config, auth middleware, or other services

**Dependencies of `agent_api/vais/sync_worker.py`:**
- `supabase` (create_client)
- `agent_api.vais.*` (config, document_service, store_service, types)
- Zero imports from main app

**Verdict: Fully self-contained.** The VAIS Python code has zero coupling to the main app beyond being registered as a router.

### Next.js side

| File | Role |
|------|------|
| `nextjs-app/app/admin/vais/page.tsx` | Landing page (links to search + files) |
| `nextjs-app/app/admin/vais/search/page.tsx` | Search page (server component, admin check) |
| `nextjs-app/app/admin/vais/search/vais-search-playground.tsx` | Search form + results (client component) |
| `nextjs-app/app/admin/vais/files/page.tsx` | Files page (server component, admin check) |
| `nextjs-app/app/admin/vais/files/vais-file-manager.tsx` | Upload/list/delete UI (client component) |
| `nextjs-app/app/api/vais/[...path]/route.ts` | Proxy route: forwards `/api/vais/*` to Python API |

**Dependencies of the page components:**
- `@/components/ui/*` -- shadcn/ui components (Badge, Button, Card, Input, Label, Select, Table)
- `@/lib/supabase/server` -- `createClient()` for admin auth check
- `lucide-react` -- icons
- `next/navigation` -- redirect, notFound
- `next/link` -- Link component

**Dependencies of the client components (`vais-search-playground.tsx`, `vais-file-manager.tsx`):**
- `@/components/ui/*` -- shadcn/ui components
- `lucide-react` -- icons
- `react` -- hooks (useState, useCallback, useEffect, useRef)
- API calls via `fetch("/api/vais/...")` -- relative paths through the proxy

**Key observation:** The client components use **relative fetch** through the Next.js proxy (`/api/vais/...`). In the standalone app, these will change to direct fetch against the VAIS Python API.

### VRAG Precedent

The VRAG prototype was already separated. The pattern:

1. **Standalone Python API:** `python-services/vrag_server.py`
   - Own FastAPI app with CORS, lifespan (sync worker), health check
   - Imports routes from `agent_api.vrag.routes`
   - Loads `.env` from `python-services/.env`
   - Runs on port 58100

2. **Standalone Next.js UI:** Reuses the main Next.js app on a different port (63100) with `VRAG_API_URL` env var override
   - Server actions in `nextjs-app/app/actions/vrag.ts` use `getVragApiUrl()` which checks `VRAG_API_URL` first
   - Pages stay in `nextjs-app/app/admin/rag/`

3. **Justfile recipes:**
   ```
   vrag-api:  cd python-services && uv run uvicorn vrag_server:app --reload ...  --port 58100
   vrag-ui:   cd nextjs-app && PORT=63100 VRAG_API_URL=http://localhost:58100 ... bun run dev
   vrag:      [parallel] vrag-api vrag-ui
   vrag-kill: fuser -k 58100/tcp 63100/tcp
   ```

## Design

Follow the VRAG pattern exactly, adapted for VAIS specifics.

### 1. Standalone Python API: `python-services/vais_server.py`

Create a new file `python-services/vais_server.py` (following `vrag_server.py`).

```python
"""Standalone VAIS prototype API server.

Runs the VAIS routes on an independent FastAPI app (port 58200), separate from the
main AskEffi Agent API. Uses the same Supabase instance and GCP ADC credentials.

Usage:
    uv run uvicorn vais_server:app --port 58200 --reload --reload-dirs agent_api

Environment:
    SUPABASE_URL              - Local Supabase URL
    SUPABASE_SERVICE_ROLE_KEY - Service-role key (bypasses RLS)
    VAIS_GCP_PROJECT          - GCP project for Vertex AI Search (default: effi-vertex-experiment)
    VAIS_SYNC_ENABLED         - "true" to start the background sync worker
    VAIS_SYNC_POLL_INTERVAL   - Poll interval in seconds (default: 10)
"""

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Configure logging -- same stdout/stderr split as main app
_stdout_handler = logging.StreamHandler(sys.stdout)
_stdout_handler.setLevel(logging.DEBUG)
_stdout_handler.addFilter(lambda r: r.levelno < logging.WARNING)

_stderr_handler = logging.StreamHandler(sys.stderr)
_stderr_handler.setLevel(logging.WARNING)

logging.basicConfig(level=logging.INFO, handlers=[_stdout_handler, _stderr_handler])
logger = logging.getLogger(__name__)

# Load .env from python-services directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agent_api.api.vais import router as vais_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start/stop the VAIS sync worker if enabled."""
    vais_worker_task = None

    if os.getenv("VAIS_SYNC_ENABLED", "false").lower() == "true":
        from agent_api.vais.sync_worker import run_vais_sync_worker

        vais_worker_task = asyncio.create_task(run_vais_sync_worker())
        logger.info("VAIS sync worker started")
    else:
        logger.info("VAIS sync worker disabled (VAIS_SYNC_ENABLED != true)")

    yield

    if vais_worker_task:
        from agent_api.vais.sync_worker import vais_shutdown_event

        vais_shutdown_event.set()
        await vais_worker_task
        logger.info("VAIS sync worker stopped")


app = FastAPI(
    title="VAIS Prototype API",
    description="Standalone Vertex AI Search prototype server",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS -- allow the standalone UI (port 63200) and local dev origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:63200",
        "http://localhost:3000",
        "http://127.0.0.1:63200",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount VAIS routes with /api/vais prefix (matches main app path structure)
app.include_router(vais_router, prefix="/api/vais", tags=["vais"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"service": "VAIS Prototype API", "version": "0.1.0", "status": "running"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "vais-prototype"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "vais_server:app",
        host="0.0.0.0",
        port=58200,
        reload=True,
        reload_dirs=["agent_api"],
    )
```

**Key differences from VRAG pattern:**
- Imports `agent_api.api.vais.router` (the existing router) rather than a separate routes module
- CORS allows port 63200 (VAIS UI) instead of 63100 (VRAG UI)
- Mounts at `/api/vais` to match the existing URL structure
- Starts the VAIS sync worker (gated by `VAIS_SYNC_ENABLED`)

**No changes needed to:**
- `agent_api/api/vais.py` -- the router works as-is
- `agent_api/vais/*` -- all services are already self-contained

### 2. Standalone Next.js UI

**Option A (recommended): Reuse main Next.js app** -- same as VRAG pattern.

The VAIS pages already exist at `nextjs-app/app/admin/vais/`. The only change needed is to make the client components support direct API access.

#### 2a. Convert client components from proxy to direct fetch

Currently, `vais-search-playground.tsx` and `vais-file-manager.tsx` use relative fetch paths:
```ts
fetch(`/api/vais/projects/${projectId}/search`, ...)
```

Change to use an API base URL from an environment variable:

```ts
// Add at the top of each client component:
const VAIS_API_URL = process.env.NEXT_PUBLIC_VAIS_API_URL || "";

// Then replace fetch calls:
fetch(`${VAIS_API_URL}/api/vais/projects/${projectId}/search`, ...)
```

When `NEXT_PUBLIC_VAIS_API_URL` is empty (default), fetches go through the existing proxy (`/api/vais/...`). When set to `http://localhost:58200`, fetches go directly to the standalone API.

This is a cleaner pattern than VRAG's server actions approach because the VAIS components are already client-side with `fetch()`.

#### 2b. Simplify auth for standalone mode

The page components (`page.tsx`) check admin status via Supabase. In standalone mode, these checks are still valid since we run the same Next.js app with the same Supabase instance.

No auth changes needed -- the standalone UI reuses the same Next.js app, so cookies/sessions still work.

#### 2c. No new `vais-ui/` directory needed

Unlike creating a whole new Next.js app from scratch, reuse the existing app on a different port (matching VRAG pattern). This avoids duplicating shadcn/ui components, Supabase client setup, and Next.js config.

### 3. Justfile Recipes

Add to the root `justfile`, following the VRAG pattern:

```just
# VAIS prototype -- standalone servers (ports 58200/63200)

# Start standalone VAIS Python API on port 58200
vais-api:
    cd python-services && uv run uvicorn vais_server:app --reload --reload-dirs agent_api --host 0.0.0.0 --port 58200

# Start standalone VAIS UI on port 63200 (reuses existing Next.js app with VAIS API URL override)
vais-ui:
    cd nextjs-app && PORT=63200 NEXT_PUBLIC_VAIS_API_URL=http://localhost:58200 NEXT_PUBLIC_SITE_URL=http://localhost:63200 bun run dev

# Start both VAIS servers (API + UI)
[parallel]
vais: vais-api vais-ui

# Kill VAIS server processes (ports 58200, 63200)
vais-kill:
    if command -v fuser >/dev/null; then fuser -k 58200/tcp 63200/tcp 2>/dev/null; else (lsof -ti :58200 -sTCP:LISTEN; lsof -ti :63200 -sTCP:LISTEN) | xargs kill -9 2>/dev/null; fi; echo "VAIS ports cleared"

# Show VAIS server status
vais-status:
    #!/usr/bin/env bash
    echo "VAIS prototype (ports 58200/63200):"
    if lsof -ti :58200 >/dev/null 2>&1; then echo "  Python API (58200): running"; else echo "  Python API (58200): stopped"; fi
    if lsof -ti :63200 >/dev/null 2>&1; then echo "  Next.js UI (63200): running"; else echo "  Next.js UI (63200): stopped"; fi
```

### 4. Cleanup of Main App

**Do NOT remove from main app yet.** The VAIS routes should remain registered in `main.py` for backward compatibility until the standalone servers are verified working. The cleanup is a separate step.

When ready to remove:

1. **Remove from `main.py`:**
   - Delete `from agent_api.api import ... vais` import
   - Delete `app.include_router(vais.router, prefix="/api/vais", tags=["vais"])`
   - Delete VAIS sync worker startup/shutdown from lifespan

2. **Remove proxy route:**
   - Delete `nextjs-app/app/api/vais/[...path]/route.ts`

3. **Keep:**
   - `agent_api/vais/` package (services) -- imported by standalone server
   - `agent_api/api/vais.py` (router) -- imported by standalone server
   - `nextjs-app/app/admin/vais/` pages -- still used by standalone UI

### 5. Port Allocation

| Service | Port | Pattern |
|---------|------|---------|
| Main web (human dev) | 3000 | standard |
| Main API (human dev) | 8000 | standard |
| Agent web | 63000 | agent-dev |
| Agent API | 58000 | agent-dev |
| VRAG API | 58100 | standalone prototype |
| VRAG UI | 63100 | standalone prototype |
| **VAIS API** | **58200** | **standalone prototype** |
| **VAIS UI** | **63200** | **standalone prototype** |

Port scheme: Python APIs use 58xxx, Next.js UIs use 63xxx. VRAG=x100, VAIS=x200. Next prototype would be x300.

## Implementation Steps

### Step 1: Create `vais_server.py`
- Copy from `vrag_server.py`, adapt imports to VAIS
- Wire up VAIS sync worker in lifespan
- Add CORS for port 63200
- Test: `cd python-services && uv run uvicorn vais_server:app --port 58200`
- Verify: `curl http://localhost:58200/health`
- Verify: `curl http://localhost:58200/api/vais/projects/test-id/store`

### Step 2: Add `NEXT_PUBLIC_VAIS_API_URL` support to client components
- In `vais-search-playground.tsx`: extract API base URL, prefix all fetch calls
- In `vais-file-manager.tsx`: same extraction
- Use a shared constant or inline pattern (client components can't use server env vars, so use `NEXT_PUBLIC_*`)
- When env var is empty string, fetch uses relative paths (backward compatible)

### Step 3: Add justfile recipes
- Add `vais-api`, `vais-ui`, `vais`, `vais-kill`, `vais-status`
- Test: `just vais` starts both servers
- Test: `just vais-status` shows running
- Test: Navigate to `http://localhost:63200/admin/vais` and verify search/files work

### Step 4: Verify end-to-end
- Start standalone servers: `just vais`
- Navigate to `http://localhost:63200/admin/vais/search`
- Enter a project ID and search query
- Verify results come back (CORS headers present, no proxy errors)
- Navigate to `http://localhost:63200/admin/vais/files`
- Upload a file, verify it appears in the list
- Delete a file, verify deletion works

### Step 5: Cleanup main app (separate PR)
- Remove VAIS router from `main.py`
- Remove VAIS sync worker from `main.py` lifespan
- Remove proxy route
- Verify main app still starts cleanly
- Verify VAIS standalone still works

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| CORS issues with direct fetch from browser to port 58200 | CORS middleware explicitly allows port 63200 origin |
| `NEXT_PUBLIC_VAIS_API_URL` not available at build time | The var is `NEXT_PUBLIC_*` so it's inlined at build. For dev, it's passed via justfile recipe |
| Auth bypass in standalone mode | Admin check still works -- same Next.js app, same Supabase, same cookies |
| Sync worker runs in both main and standalone | Gated by `VAIS_SYNC_ENABLED` -- set only in standalone. Main app checks same var. Just don't set it in both. |
| Missing `sentry_sdk` import in search_service.py | The search service imports sentry_sdk but standalone server doesn't initialize it. Sentry calls will silently no-op (SDK behavior when uninitialized). Fine for prototype. |

## Comparison with Alternative: Separate Next.js App

Creating a brand new `vais-ui/` Next.js app was considered but rejected:

- **Pros:** Truly isolated, minimal footprint
- **Cons:** Must duplicate/install shadcn/ui, Supabase client, Tailwind config, Next.js config. ~20 files of boilerplate. The client components import 8 different shadcn components.
- **VRAG precedent:** Reuses the main Next.js app. If we deviate, we create two patterns to maintain.
- **Verdict:** Reuse main app on separate port. Zero duplication. Matching VRAG.
