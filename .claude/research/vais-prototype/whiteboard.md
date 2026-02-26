# VAIS Prototype — Whiteboard (COMPLETE)

## Final State
Phase: DONE | Full build + separation + sanity test complete
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

## Sanity Test Results (All PASS)
- API health, store creation, upload, list, search, UI routes, delete — all verified
- Sync stays `pending` without GCP creds (expected for local)

## Quality Log
- Phase 1 Research: PASS
- Phase 2 Design: PASS
- Phase 3 Spec: PASS
- Phase 4 Implementation: PASS (10 slices)
- Phase 5 QA: PASS
- Phase 6 Separation: PASS (3 commits + justfile fix)
- Phase 6 Sanity Test: PASS (9/9 checks)
