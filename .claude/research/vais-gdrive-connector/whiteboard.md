# VAIS Google Drive Connector — Build Whiteboard

## Current State
Phase: 2 Design+Spec | Status: DONE | Iteration: 1
Last checkpoint: Spec written to `phase-02-spec.md`. 8 slices, all decisions resolved.
Next: Implementation (Phase 3) — start with Slice 1 (DB migration).

## Auto-Inject (survives compaction — read this every time you re-orient)
Process: Re-read skill (§Pre-Phase Hook) → read whiteboard → note-to-self (§Note-to-Self) → spawn agent → read summary only → update whiteboard
Role: I am the director. I NEVER do work myself — not checking, not reviewing, not fixing, not reading code. Every action = a subagent. If I'm about to do it myself, I stop and delegate. (§Hard Rules, §Role Collapse)
Output: Tell every agent "return ≤10 line summary; write details to phase file." I read summaries, never details. If unclear, spawn a follow-up agent to clarify — don't read the source. (§Agent Output Protocol)
Verification: Spawn sanity-check agents at phase boundaries AND between phases for continuous confidence. Not just in QA. (§Continuous Verification)

## Goal
Build a standalone Google Drive connector for the VAIS prototype — per-user OAuth via Unified.to, folder selection, internal/external classification, with a simple but operational UI.

## Scope & Constraints
- **Standalone** — do NOT touch or mix with existing app (nextjs-app main, python-services main API)
- VAIS prototype: `agent_api/vais/` (Python) + `vais-ui/` (Next.js)
- Use Unified.to for OAuth + Drive API (existing integration in codebase)
- User wants: connect Drive → pick folders → choose internal/external → sync to VAIS
- Separate DataStores for internal/external is acceptable if simpler
- If any auth/deps/libs needed from user — STOP and ask

## Prior Research Summary
- Native Drive connector: rejected (Workspace admin, org-wide, Preview, silent failures)
- Existing pipeline: Unified.to OAuth → folder scan → download to Supabase Storage → GFS upload
- DB tables exist: `drive_connections`, `drive_folder_scopes`, `drive_files`
- VAIS upload: GCS → JSONL (content.uri + structData) → import
- No new auth/infra needed

## Research Findings
- **Unified.to**: OAuth middleware. 3 env vars: `UNIFIED_API_KEY`, `UNIFIED_WORKSPACE_ID`, `UNIFIED_WEBHOOK_SECRET`. `UnifiedClient` is self-contained (httpx + unified_python_sdk + sentry_sdk only).
- **OAuth flow**: `get_auth_url(success_redirect=URL)` → Unified.to hosted auth → browser redirect to callback with `?id=connection_id`. `success_redirect` is caller-controlled, localhost works for dev.
- **File pipeline**: Stage 1: Drive → Supabase Storage (`drive-files` bucket) via BFS folder scan. Stage 2: Storage → GFS. We add Stage 3: Storage → VAIS.
- **Coupling**: `UnifiedClient` = 100% reusable. `DriveSyncService` = tightly coupled to GFS, need to rebuild for VAIS. DB pattern (3 tables) = good model to replicate.
- **VAIS state**: Zero Drive awareness. Own schema (`vais_prototype`). Own sync worker handles Storage → GCS → JSONL → Discovery Engine.
- **Decision: Standalone tables** in `vais_prototype` schema (not bridging to existing `drive_files`). Simpler, fully decoupled.
- **OAuth callback**: Route in `vais-ui/` or VAIS Python server. Localhost works for dev. For deployed: needs `VAIS_PUBLIC_URL`.

## Phase Map
1. Research — [ DONE ] — PASSED with 1 iteration (OAuth gap closed)
2. Design+Spec — [ DONE ] — Spec in `phase-02-spec.md`, 8 slices
3. Implementation — [ planned ]
4. QA — [ planned ]
5. Final Push — [ planned ]

## Design Decisions
- Standalone `vais_drive_*` tables in `vais_prototype` schema
- Reuse `UnifiedClient` directly (import from existing code)
- OAuth callback in VAIS Python server (simpler than vais-ui route)
- `success_redirect` to localhost for dev
- entity_type: "drive_file" in VAIS metadata for filtering

## Open Questions
(All resolved in spec)

## Quality Log
- Phase 1 Research: ITERATE (OAuth callback gap) → PASS (gap closed)
- Phase 2 Spec: PASS (1 iteration, all questions resolved)
