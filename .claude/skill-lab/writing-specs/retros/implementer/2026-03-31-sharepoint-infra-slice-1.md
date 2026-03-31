### 2026-03-31 — SharePoint integration spec (ENG-3886), slice 1 (ENG-4158)
**Verdict:** worked well
**Key observations:**

**1. What did I have to figure out that the spec should have told me?**
- The spec says `UNIQUE(project_id, remote_item_id) WHERE deleted_at IS NULL` for sharepoint_files (AC line 130). It also mentions the Drive lesson about partial uniques breaking PostgREST upserts (Risks section). These two statements contradict — the spec tells you to use a partial unique AND warns you not to. A clear decision one way or the other would have saved the implementer from having to reason through it.
- The spec doesn't mention that `drive_folder_scopes` RLS policies store `drive_connections` as expression text (not resolved OIDs). This was the highest-risk finding in the implementation — the rename would have silently broken RLS at runtime. The spec's "What Doesn't Change" section says Drive folder scopes stay unchanged, which is true for the table but false for the policies that reference the renamed table.
- The spec doesn't mention `admin_get_drive_connection_stats()` — a database function that references `FROM drive_connections` in its body. The "Reference Files" section points at migration files and app code, but not at database functions.
- The spec doesn't specify whether `cloud_connections` needs `deleted_at` added or if it already exists. The implementer had to check the live DB state.

**2. What did the spec get wrong?**
- AC #42: "Insert trigger: sharepoint_files INSERT → create gfs_sync_items row" directly contradicts the design decision in the Two-Status Design section and the explicit note at line 133: "NO insert trigger for gfs_sync_items." The AC table has a bug.
- AC #10: "trigger creates gfs_sync_items rows" — implies a database trigger, but the design says BackgroundTask creates these explicitly. Misleading wording in the AC.
- The spec says `UNIQUE(project_id, provider)` for cloud_connections. The existing Drive setup uses a partial unique index (`WHERE deleted_at IS NULL`). Switching to a full unique changes reconnect semantics — soft-deleted connections block re-insert. The spec doesn't acknowledge this behavioral change or specify how reconnect should work under the new constraint.

**3. What criteria did I add?**
- Reconnect-after-soft-delete behavior: the spec doesn't specify what happens when a user disconnects Google Drive (soft-delete) and reconnects. The existing code uses a revive pattern (UPDATE, not INSERT), but the spec's unique constraint change affects this flow. I had to update the test to match.
- `provider` field on INSERT: the spec says "add provider column, backfill google_drive" but doesn't mention that all existing INSERT code paths need updating. The callback route's INSERT was missing `provider`, which would have failed at runtime.
- drive_folder_scopes RLS policy recreation — not in any AC.
- admin_get_drive_connection_stats() update — not in any AC.
- CHECK constraint rename (drive_connections_status_check → cloud_connections_status_check) — cosmetic but not mentioned.

**4. What bugs came from spec gaps?**
- The soft-delete.test.ts failure ("allows reconnect after soft-delete") was a direct consequence of the unspecified constraint behavior change. Caught by test run, not by the spec.
- The missing `provider` field on the callback INSERT would have been a production bug if not caught during code review.

**5. What did the spec prescribe that I had to ignore?**
- AC #42 (insert trigger) — explicitly contradicts the design. Had to ignore it.
- The partial unique on sharepoint_files — spec says partial, but the Drive lesson (also in the spec) says don't use partial. Chose full unique.

**6. What did the spec get right?**
- **"What Doesn't Change" section was excellent.** Clear boundary-setting. Prevented scope creep into drive_files, drive_folder_scopes, drive_sync_events, or the claim RPCs.
- **Reference Files section was highly actionable.** The exact migration files, the partition pattern, the PostgREST computed relationship pattern — all pointed at the right code. Saved significant exploration time.
- **Two-Status Design table** was the clearest documentation of the lifecycle I've seen. Made it obvious why there's no insert trigger and where each status transition happens.
- **Decisions table with rationale** — Decision #11 (entity table is source of truth) with the explicit rationale about the Drive audit prevented me from copying Drive's broken pattern.
- **Risks & Hazards section** — the Drive audit lessons were directly applicable. "PostgREST partial unique indexes don't work with ON CONFLICT" saved me from using a partial unique on sharepoint_files.
- **Separate RLS policy pattern** (discovered from the meetings migration, not the spec) — the spec assumed DROP+recreate of the CASE policy, but the meetings precedent of a separate additive policy was better. Not the spec's fault — this was a codebase discovery.
- **The scope table** was well-designed. Self-referential parent_scope_id with item_type discrimination is the right model for SharePoint's site→library→folder→file tree.
- **The slice decomposition** (ENG-4158 through ENG-4163) was well-ordered. Infra first, then connect+browse, then scope+download, etc. Each slice builds on the previous one's committed schema.

**Suggestions for future specs:**
- When a table rename is in scope, add a "Database Objects to Update" section that lists: tables, FK constraints, RLS policies (including policies on OTHER tables that reference the renamed table via expression text), database functions, CHECK constraints, indexes. The implementer shouldn't have to discover these by dumping the DB.
- When ACs contradict design decisions, resolve the contradiction before slicing. AC #42 was a copy-paste from a template; the design section was correct. The AC should have said "No insert trigger — gfs_sync_items rows created by BackgroundTask."
- When changing a unique constraint's semantics (partial → full), explicitly specify the behavioral impact on existing flows (reconnect, re-sync after soft-delete).
