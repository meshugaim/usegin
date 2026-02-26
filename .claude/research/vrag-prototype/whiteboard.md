# VRAG Prototype — Whiteboard (COMPLETE)

## How to Run
```bash
just vrag          # Start both (API on 58100, UI on 63100)
```
- UI: http://localhost:63100/rag (files) + http://localhost:63100/rag/search (search)
- API: http://localhost:58100

## Architecture
- `vrag-ui/` — standalone Next.js app (port 63100)
- `python-services/vrag_server.py` — standalone FastAPI app (port 58100)
- `vrag_prototype` Supabase schema

## Filter System (AIP-160)
- Full AIP-160 syntax: `key = "value"`, `key > N`, AND/OR compounds
- 21 filter keys across 3 entity types (file/email/email_attachment)
- Polymorphic `email_id` key (resolves to different columns per entity type)
- TEXT[] array containment, boolean coercion, entity_type validation
- Parser: `aip160_parser.py`, Registry: `filter_keys.py`
- 57 unit tests covering parser + query builder

## Ports (tell ENG-2096 to avoid)
- 58100 — VRAG Python API
- 63100 — VRAG Next.js UI

## Access Control
- Current: 1 corpus per project, Supabase pre-filter + `rag_file_ids` for internal/external
- **Review (2026-02-26):** The "1 corpus" decision conflated filtering correctness with isolation architecture. Physical separation (multiple corpora per access level) is possible — no product limitation prevents it. See [`access-control-across-products.md`](../access-control-across-products.md) for full analysis.

## Quality Log
- Phases 1-8: All PASS (base prototype + separation)
- Phase 9.1 Research: PASS — complete GFS filter key mapping
- Phase 9.2 Design: ITERATE→PASS (fixed email_id dual mapping)
- Phase 9.4 Implementation: PASS — 7 slices committed
- Phase 9.5 QA: PASS — 57/57 filter tests, 1333/1333 full suite, runtime API tests pass
