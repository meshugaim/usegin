# Drive Migration to gfs_sync_items — Handoff

Read this entire document before writing any code or specs.

Lessons from file migration (Slices 1-4), email/attachment migration (E1-E4, A1-A4), and the drive planning session (2026-03-18). This document is the single source of truth for the drive migration.

---

## What was done before you

Files, emails, and attachments all write and read through `gfs_sync_items`. The sync table is the source of truth. Entity tables (`project_files`, `inbound_emails`, `email_attachments`) are kept current by the audit trigger's projection — temporary, for backward compatibility until old columns are dropped.

Drive is the only entity type still on the old pipeline: app/worker writes to `drive_files` columns directly or via events into `gfs_sync_events`, the old `update_gfs_sync_status` trigger projects to `drive_files`.

## What exists for drive already

**In gfs_sync_items:**
- Partition `gfs_sync_items_drive` exists (created in Slice 1 infrastructure)
- FK constraint `fk_gfs_sync_items_drive_entity` exists
- **No creation trigger** on `drive_files` (unlike file/email/attachment)
- **No cleanup trigger** (BEFORE DELETE) on `drive_files`
- **No computed relationship functions** for PostgREST
- **No backfill** — zero drive rows in gfs_sync_items
- **No RLS UPDATE policy** for drive entity type

**Old infrastructure (still active):**
- `claim_pending_drive_download` — claims from `drive_files` for download stage
- `claim_pending_drive_sync` — claims from `drive_files` for GFS upload stage
- `claim_pending_drive_deletion` — claims from `drive_files` for deletion
- Old trigger `update_gfs_sync_status` drive branch (13 event types across 3 stages)
- `drive_files` columns: `gfs_sync_status`, `gfs_doc_id`, `is_excluded`, `deleted_at`, `last_synced_at`, `force_sync_at`, `retry_reset_at`, `remote_updated_at`, `content_hash`

**Entity-agnostic claim RPCs** (`claim_pending_sync`, `claim_pending_deletion`) already handle all entity types — no entity_type filter. Drive rows become claimable once they have sync rows with the right status.

---

## Key design decisions

### 1. Sync row creation: at INSERT, with `blocked`

Create the gfs_sync_items row when the `drive_files` row is INSERTed, with status `blocked`. Same pattern as emails and attachments.

**Reasoning:** `is_excluded` needs a single home. If we created at `stored`, pre-download exclusion would write to `drive_files` and post-download exclusion would write to `gfs_sync_items` — split brain. Creating at INSERT means `is_excluded` always lives on `gfs_sync_items`. A creation trigger on `drive_files` creates sync rows with `blocked` status.

### 2. Download stage stays on `drive_files`

The download lifecycle (`pending` -> `downloading` -> `stored` -> `download_failed`) is drive-specific. It stays on `drive_files`. When download completes (`stored`), transition the sync row from `blocked` -> `pending`. This is the handoff point — same concept as email classification unblocking sync.

**Pipeline comparison:**
```
Files:  pending -> processing -> synced
Emails: blocked -> [classification] -> pending -> processing -> synced
Drive:  blocked -> [download on drive_files] -> pending -> processing -> synced
```

**Implication:** The old `claim_pending_drive_download` RPC stays as-is during the migration. It claims from `drive_files` for the download stage. Only the sync and deletion claim RPCs switch to entity-agnostic.

### 3. Column split in cleanup (not part of migration slices)

`drive_files.gfs_sync_status` currently tracks both download and GFS lifecycles. Same design problem as emails having `status` + `gfs_sync_status`. In cleanup: rename to `download_status`, strip GFS values. This is a future cleanup task, not part of D1-D4.

### 4. Testing approach

**Do NOT write mock-heavy unit tests.** The email migration had 6 fix commits for unit test mocks — 50% of all fixes. The mocks test query shapes (which table, which filter), not logic.

For drive:
- **pgTAP:** Test DB logic (transitions, triggers, projection, claim RPCs)
- **Integration tests:** Test full flows (app -> DB -> triggers -> result)
- **Unit tests:** Only for pure app logic (parameter validation, response formatting) — if any exists. No hand-built Supabase client mocks.

### 5. Orchestration

Use `/build-liaison` (2-layer). The email migration was 2x faster than the file migration with equal rigor. The handoff + whiteboard give the implementing agent everything it needs.

### 6. Spec writing

Specs define WHAT and WHY. The implementor writes the HOW by reading email migration code as reference. Do NOT include copy-paste SQL in specs — that is how the vocabulary bug survived 4 slices (nobody read what they pasted).

---

## Slice structure

### D1: Infrastructure
- Creation trigger on `drive_files` (creates `blocked` sync rows)
- Cleanup trigger (BEFORE DELETE) on `drive_files`
- Computed relationship functions for PostgREST
- RLS SELECT policy for drive entity type
- Backfill existing `drive_files` into `gfs_sync_items`

### D2: Switch writers
- App code (exclusion toggle, external toggle, force_sync) writes to `gfs_sync_items`
- Add missing event types to old trigger's drive branch
- RLS UPDATE policy
- Full projection in audit trigger (start with full projection from D2, not partial)

### D3: Switch worker
- Download worker writes `blocked` -> `pending` on gfs_sync_items when download completes
- Sync worker uses entity-agnostic claim RPCs (`claim_pending_sync`, `claim_pending_deletion`)
- Download worker writes `last_synced_at` directly to `drive_files` (see pitfall D2)

### D4: Switch readers
- Admin pages, browse tools, data summary queries read from gfs_sync_items via computed relationships
- `admin_get_drive_connection_stats()` RPC rewritten to JOIN gfs_sync_items (see pitfall D8)

---

## Backfill status mapping

The creation trigger creates all new rows as `blocked`. Backfill needs to set the correct status for existing rows. With the creation trigger already in place, backfill is simpler:

- Files at download stage (`pending`, `downloading`, `download_failed`) already have `blocked` from the creation trigger. **ON CONFLICT DO NOTHING** — the creation trigger already set the correct status.
- Files at `stored` (downloaded, ready for GFS upload) need `pending` in gfs_sync_items.
- Files at GFS lifecycle stages (`processing`, `synced`, `excluded`, `pending_deletion`, `deleting`, `deleted`) map 1:1.
- Files at `failed` map to `upload_failed` (defensive — `failed` has no transitions).

For files whose sync row is `blocked` (from creation trigger) but entity table shows a GFS-stage status (e.g., `synced`), use a two-step UPDATE with trigger bypass:

1. `SET session_replication_role = 'replica'` (bypasses BEFORE UPDATE trigger validation)
2. UPDATE gfs_sync_items SET gfs_sync_status, gfs_doc_id, is_excluded, etc. from drive_files
3. `RESET session_replication_role`

This is the same pattern used in `20260318183104_slice_e1_backfill_emails.sql`.

---

## Drive-specific pitfalls (8 pitfalls)

### D1. `download_skipped` fast-path

When `content_hash` matches and `gfs_doc_id` exists, the download worker skips download. Today it emits `download_skipped` -> old trigger sets `synced` + updates `last_synced_at`. After migration: the download worker sees the file already has a sync row with `synced` — it should skip entirely. But `last_synced_at` still needs updating on `drive_files`. Worker must write it directly.

### D2. `last_synced_at` and `force_sync_at` orphaning

The old trigger updates these on `sync_succeeded` and `download_skipped`. Once the worker writes directly to `gfs_sync_items` (stops inserting events), the old trigger never fires for sync transitions. Worker must write `last_synced_at` and clear `force_sync_at` directly on `drive_files` alongside the `gfs_sync_items` write. Easy to miss because they are drive-lifecycle columns updated by the sync trigger.

### D3. Disconnect bulk write

Disconnecting Drive orphans potentially hundreds of files. Each needs `pending_deletion` on `gfs_sync_items`. Individual UPDATEs fire audit trigger + projection per row. Test with realistic volumes. Consider a batch approach.

### D4. Re-scan resurrection

Re-scan finds a previously deleted `remote_file_id`. Resurrects the `drive_files` row (`deleted_at = NULL`). The sync row also exists with `deleted` status. Needs `deleted` -> `pending` transition — which requires `is_excluded = true` (BEFORE UPDATE business rule). Two-step pattern, triggered by scan, not user toggle.

### D5. `is_external` vs `access_level`

Files and emails use `access_level` (text). Drive uses `is_external` (boolean). The `gather_drive_metadata` function needs to expose this for GFS store routing. Either map to `access_level` at gather time, or make upload accept both.

### D6. No creation trigger initially existed

Unlike files/emails/attachments which got creation triggers in Slice 1, drive did not. We are adding one now. It creates `blocked` rows (like emails/attachments, not `pending` like files).

### D7. `deleted_at` conditional

The old trigger sets `deleted_at` on `deletion_succeeded` only when `NOT is_excluded`. Drive files excluded by the user do not get `deleted_at` when the GFS doc is cleaned up. The audit trigger's projection needs this same conditional. Unlike emails (sibling-aware `deleted_at`), drive is straightforward but the condition must be preserved.

### D8. Admin stats RPC is SQL

`admin_get_drive_connection_stats()` counts by `gfs_sync_status`. During coexistence, projection keeps `drive_files` current. After cleanup (column drop), this RPC needs to JOIN to `gfs_sync_items`. That is a SQL migration in D4, not just TypeScript.

---

## General pitfalls (13 pitfalls, from file and email migrations)

### G1. Vocab fix — audit trigger CASE mapping

The audit trigger writes action-vocabulary events (`sync_succeeded`, `sync_requested`), not status-vocabulary (`synced`, `pending`). This was fixed in Slice 4.5 with a CASE mapping. The mapping already exists and handles all entity types. For drive, verify that all drive-specific transitions produce correctly mapped events. Do NOT introduce new event names without checking the CASE mapping.

### G2. Old trigger's drive branch is missing event types

The old trigger's drive branch handles download and upload events but NOT:
- `sync_requested` (for re-sync triggers)
- `sync_excluded` (for exclusion)
- `sync_blocked` (for re-blocking)
- `sync_rejected` (probably not needed for drive)

You MUST add these to the drive branch of `update_gfs_sync_status` in the writer-switch migration. Without them, any app-initiated transition that goes through gfs_sync_items -> audit trigger -> event will silently fail to project to `drive_files`.

### G3. Full projection needed after worker switch

We learned this the hard way across E2 -> E3:

- **E2 (writer switch):** Added `is_excluded`-only projection. The old trigger chain handles `gfs_sync_status` and `gfs_doc_id` projection via events.
- **E3 (worker switch):** Had to upgrade to FULL projection (`gfs_sync_status` + `gfs_doc_id` + `is_excluded`). Once the worker writes directly to gfs_sync_items instead of inserting events, the old trigger never fires for worker transitions.

**For drive:** Start with full projection from D2. It is simpler and the only cost is a few redundant UPDATE statements during coexistence (old trigger also projects, but with the same values).

### G4. gfs_doc_id COALESCE will not clear NULL

The old trigger uses `COALESCE(NEW.gfs_doc_id, drive_files.gfs_doc_id)` when projecting. Writing `gfs_doc_id = NULL` to gfs_sync_items -> audit event with NULL gfs_doc_id -> old trigger does `COALESCE(NULL, existing_value)` = keeps existing value. Entity table never clears.

**Workaround during coexistence:** When clearing gfs_doc_id (e.g., re-sync trigger, force_sync_at), write `gfs_doc_id = NULL` directly to `drive_files` alongside the gfs_sync_items write. Remove this workaround after readers switch.

### G5. Re-inclusion from `deleted` needs two-step update

The BEFORE UPDATE trigger on gfs_sync_items has a business rule:
```sql
IF OLD.gfs_sync_status = 'deleted' AND NEW.gfs_sync_status = 'pending' THEN
  IF NOT NEW.is_excluded THEN
    RAISE EXCEPTION 'Cannot re-include: entity was deleted, not excluded';
  END IF;
END IF;
```

A single update `{is_excluded: false, gfs_sync_status: "pending"}` fails because `NEW.is_excluded` is `false`. Must do:
1. `{gfs_sync_status: "pending"}` — while is_excluded is still true (passes validation)
2. `{is_excluded: false}` — now safe

### G6. Content gate uses `excluded`, not `rejected`

`rejected` is semantically reserved for resolver allowlist rejection (emails only). The content gate (file too large, empty body, unsupported format) writes `excluded`. Drive's content gate should do the same.

### G7. One migration per concern — no bundling

The file migration bundled the vocab fix with triggered_by column, projection removal, and old RPC decontamination in a single 677-line migration. Each created cascading problems. The migration was reverted.

For drive: separate migrations for backfill, trigger extension, projection, RLS, code changes. Each should be deployable and testable independently.

### G8. Old RPCs are read-only

Do not modify the old drive claim RPCs (`claim_pending_drive_download`, `claim_pending_drive_sync`, `claim_pending_drive_deletion`). They work. They get replaced by the entity-agnostic RPCs when the worker switches. Modifying them risks breaking the existing pipeline during coexistence.

### G9. "Pre-existing failure" is a claim, not a fact

If a test fails after your migration, do not label it "pre-existing" without proof. `git stash`, run at the prior commit, confirm it fails there too. If you cannot confirm, it is your regression. We carried 4 "pre-existing" test failures through the file migration without verifying. Two turned out to be regressions.

### G10. db-checks trigger liveness allowlist

The liveness checker cannot trace trigger->trigger chains (gfs_sync_items -> audit trigger -> event -> old trigger). You will need to add entries like `drive:sync_requested`, `drive:sync_excluded`, `drive:sync_blocked` to the allowlist in `tools/db-checks/src/compare/checks.ts`. These are NOT orphaned — they are produced by the audit trigger's CASE mapping. Comment explaining the chain and when to remove.

### G11. Unit test mocks break on every switch

Every writer switch (code writes to `gfs_sync_items` instead of entity table) breaks unit test mocks. Every reader switch also breaks them. Given our testing approach decision (D4 above in design decisions), avoid writing new hand-built Supabase client mocks for drive. Use pgTAP and integration tests instead. If existing drive unit tests break, update the mocks minimally:
- Adding `.table("gfs_sync_items")` / `.from("gfs_sync_items")` to mock client setup
- Updating `.select()` assertions for computed relationship syntax
- Changing mock return data to array shape: `gfs_sync_items: [{ gfs_sync_status: "..." }]`

### G12. PostgREST computed relationships return arrays

TypeScript types: `gfs_sync_items: { gfs_sync_status: string }[]` — NOT `{ ... } | null`. Access via `row.gfs_sync_items?.[0]?.gfs_sync_status`. Four TypeScript type errors caught by the push hook on E4.

### G13. Other agents switch branches

Multiple Claude sessions share the working tree. Other agents leave dirty files and switch branches. Always:
- `git checkout main` and verify `git branch --show-current` before committing
- Only `git add <specific-files>` — never `git add .`
- Do not restore/checkout other agents' dirty files
- Do not run `ruff format .` on the whole directory — scope to changed files only

---

## Drive-specific columns not on gfs_sync_items

These stay on `drive_files` — they are drive lifecycle, not sync lifecycle:

| Column | Purpose | Stays on drive_files |
|---|---|---|
| `last_synced_at` | Cooldown timer for re-sync | Yes |
| `force_sync_at` | Manual re-sync trigger | Yes |
| `retry_reset_at` | Reset retry count after re-scan | Yes |
| `remote_updated_at` | Google Drive file modification time | Yes |
| `content_hash` | Deduplication — skip unchanged files | Yes |
| `folder_scope_id` | Which drive folder this came from | Yes |
| `remote_file_id` | Google Drive file ID | Yes |
| `storage_path` | Local storage path after download | Yes |

These are all drive-specific and have no meaning for files/emails/attachments. Putting them on gfs_sync_items would be wrong.

---

## Reference files

Follow these as patterns. Read the email migration code — it is the most recent and cleanest implementation of each pattern.

| File | What it shows |
|---|---|
| `supabase/migrations/20260318183104_slice_e1_backfill_emails.sql` | Email backfill pattern (two-step INSERT + UPDATE with trigger bypass) |
| `supabase/migrations/20260318183152_slice_e2_writer_prerequisites.sql` | Writer switch prerequisites (transitions, RLS, old trigger extension, audit trigger projection) |
| `supabase/migrations/20260318200340_slice_e3_worker_prerequisites.sql` | Worker switch prerequisites (full projection upgrade, attachment backfill) |
| `supabase/migrations/20260313162931_close_audit_gaps_deletion_and_retry.sql` | Old trigger with drive branch (13 event types) — the one you will extend |
| `nextjs-app/lib/services/project-email.ts` | Reader switch pattern (computed relationships, array accessor, fallback) |
| `python-services/agent_api/api/email.py` | Writer switch pattern (read from gfs_sync_items, write to gfs_sync_items, coexistence entity table writes) |
| `python-services/agent_api/email_sync_service.py` | Worker switch pattern (_update_sync_item helper, dual writes) |
| `tools/db-checks/src/compare/checks.ts` | Trigger liveness allowlist |
| `.claude/builds/gfs-sync-emails/whiteboard.md` | Email migration whiteboard (process, quality log) |
| `docs/specs/gfs-sync-items/slice-e2-switch-writers.spec.md` | E2 spec (most detailed, has coexistence model) |

---

## Summary for the implementing agent

1. **Read the reference files** above — especially the E1 backfill and E2 writer prerequisites migrations. They are your templates.
2. **Follow the 4-slice structure** (D1 -> D2 -> D3 -> D4). Each slice is one logical change. Do not bundle.
3. **The download stage is the only novel part.** Everything else follows the email pattern exactly. Download stays on `drive_files`. The handoff from download to sync is `blocked` -> `pending` on gfs_sync_items when the download worker sets `stored`.
4. **Watch for all 8 drive-specific pitfalls.** Especially D1 (download_skipped fast-path) and D2 (last_synced_at orphaning) — these are the easiest to miss because they involve columns updated by the old trigger that the new pipeline must update directly.
5. **Watch for all 13 general pitfalls.** Especially G2 (missing event types in old trigger), G3 (full projection from D2), and G4 (COALESCE NULL).
6. **Test with pgTAP and integration tests.** No hand-built Supabase client mocks unless updating existing ones that break.
7. **Specs define WHAT and WHY.** You write the HOW by reading the email migration code.
