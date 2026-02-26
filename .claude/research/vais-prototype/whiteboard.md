# VAIS Prototype — Whiteboard (COMPLETE)

## Final State
Phase: DONE | All phases complete including date filter fix
ENG-2096 closed. All sub-issues closed.

## What Was Built

### Standalone Python API (`python-services/vais_server.py`)
- FastAPI app on **port 58200**
- Imports services from `agent_api/vais/` (zero duplication)
- CORS for localhost:63200 and localhost:3000
- VAIS sync worker in lifespan (gated by `VAIS_SYNC_ENABLED`)
- Health endpoint at `/health`

### Standalone Next.js UI (port 63200)
- Reuses main Next.js app on dedicated port
- `NEXT_PUBLIC_VAIS_API_URL=http://localhost:58200` for direct API calls
- `/admin/vais/` — index page
- `/admin/vais/search/` — search playground (query, entity_type, access_level, filters, chunks)
- `/admin/vais/files/` — file manager (upload, list, delete, sync status)

### Python Services (`agent_api/vais/`)
- config, types, store_service, schema_service, document_service, search_service, sync_worker
- API router at `agent_api/api/vais.py`

### Database (`vais_prototype` schema)
- Own PostgreSQL schema, fully isolated
- `vais_stores`, `vais_documents`, `vais_document_versions`, `vais_sync_events`
- RPCs: `claim_pending_vais_sync`, `claim_pending_vais_deletion`

### Startup
```bash
just vais          # Start both (Python API + Next.js UI)
just vais-kill     # Stop both
just vais-status   # Check status
just vais-api      # Python API only
just vais-ui       # Next.js UI only
```

## Port Allocation
| Service | Human | Agent | VRAG | VAIS |
|---------|-------|-------|------|------|
| Python  | 8000  | 58000 | 58100| 58200|
| Next.js | 3000  | 63000 | 63100| 63200|

## Access Control
- Current: 1 DataStore per project, `access_level: ANY()` metadata filter for internal/external
- **Review (2026-02-26):** Same pattern as VRAG — physical separation (multiple DataStores per access level) is possible but wasn't considered. VAIS also has native `acl_info` ACLs (requires Google Identity federation — impractical for us). See [`access-control-across-products.md`](../access-control-across-products.md) for full analysis.

## Architecture
- One DataStore per project (VAIS-native, metadata filtering via `ANY()`)
- Heading-aware chunking via `includeAncestorHeadings`
- Zero coupling to main app or GFS code
- Own DB schema (`vais_prototype`)
- Own servers on dedicated ports

## Quality Log
- Phase 1 Research: PASS
- Phase 2 Design: PASS
- Phase 3 Spec: PASS
- Phase 4 Implementation: PASS (10 slices)
- Phase 5 QA: PASS
- Phase 6 Separation: PASS (3 commits + justfile fix)
- Phase 6 Sanity Test: PASS (9/9 checks)
- Phase 7 Date Filter Fix: PASS (GCS JSONL import, metadata now filterable)

## Phase 7: Date Filter Fix (2026-02-26)

**Root Cause**: Three cascading bugs in the GCS upload path:
1. `data_schema="content"` + post-import `update_document()` stores metadata but VAIS never indexes it for filtering
2. `_update_document_metadata` passed `allow_missing` as a kwarg instead of on `UpdateDocumentRequest` (silently caught TypeError)
3. GCS blob deleted before metadata update could reference it

**Fix**: Replaced two-step GCS upload with single-step JSONL document import (`data_schema="document"`). Both content (base64) and structData are in one atomic JSONL file. Also fixed `list_vais_documents` proto-plus access and preserved native types in search results.

**Verification**: project_id filter (1 result), uploaded_at range (1 result), future date (0 results) — all correct.

See `.claude/research/vais-prototype/phase-07-date-filter-fix.md` for full details.
