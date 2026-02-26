# VRAG Prototype — Whiteboard (COMPLETE)

## How to Run
```bash
just vrag          # Start both (API on 58100, UI on 63100)
just vrag-api      # Python API only
just vrag-ui       # Next.js UI only
just vrag-kill     # Stop both
```
- UI: http://localhost:63100/rag
- API: http://localhost:58100
- Prerequisites: `gcloud auth application-default login --project effi-vertex-experiment`

## Architecture (Fully Separated)
- `vrag-ui/` — standalone Next.js app (port 63100). Own package.json, own .next cache.
- `python-services/vrag_server.py` — standalone FastAPI app (port 58100). Sync worker included.
- `vrag_prototype` Supabase schema — shared local DB (schema isolation).
- Zero coupling to `nextjs-app/` or main Python app.

## Ports (tell ENG-2096 to avoid)
- 58100 — VRAG Python API
- 63100 — VRAG Next.js UI

## Quality Log
- Phases 1-7: All PASS
- Phase 8 UI Extraction: PASS — standalone app works, main app clean, no type errors
