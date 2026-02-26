# Phase 03: VAIS Prototype — Implementation Spec

Spec date: 2026-02-26
Parent issue: ENG-2096

---

## Slice Inventory

10 sub-issues under ENG-2096, ordered by dependency (build in sequence):

| # | Issue | Title | Layer |
|---|-------|-------|-------|
| 1 | ENG-2099 | vais: database migration — tables, enums, RPCs | DB |
| 2 | ENG-2100 | vais: python config and type definitions | Python |
| 3 | ENG-2101 | vais: store service — DataStore + Engine creation | Python |
| 4 | ENG-2102 | vais: schema service — metadata indexing setup | Python |
| 5 | ENG-2103 | vais: document service — upload, delete, list | Python |
| 6 | ENG-2104 | vais: search service — semantic search with filters | Python |
| 7 | ENG-2105 | vais: sync worker — poll and upload pending documents | Python |
| 8 | ENG-2106 | vais: FastAPI API routes | Python |
| 9 | ENG-2107 | vais: search playground UI at /admin/vais/search | Next.js |
| 10 | ENG-2108 | vais: upload and file management UI at /admin/vais/files | Next.js |

## Key Decisions

- **UI routes**: `/admin/vais/search` and `/admin/vais/files` (NOT `/projects/[projectId]/vais-*`)
- **API routes**: `/api/vais/projects/{project_id}/...` (project-scoped)
- **One DataStore per project** — access control via metadata `ANY()` filtering, not separate stores
- **All tables `vais_` prefixed** — zero coupling to production GFS tables
- **Sync worker gated by `VAIS_SYNC_ENABLED` env var** — default off
- **SDK**: `google-cloud-discoveryengine`, location `global`
- **Metadata schema set before first upload** (per experiment findings ENG-1478)
- **CHUNKS search mode** — extract doc ID from `chunk.name` path since `result.document` is None

## Dependency Graph

```
Slice 1 (DB) ← Slice 2 (types) ← Slices 3-6 (services, parallel) ← Slice 7 (worker) ← Slice 8 (routes) ← Slices 9-10 (UI, parallel)
```

Slices 3-6 can be built in parallel once types exist. Slices 9-10 can be built in parallel once routes exist.

## Design Reference

Full design with SQL, service signatures, and UI wireframes: `phase-02-design.md`
