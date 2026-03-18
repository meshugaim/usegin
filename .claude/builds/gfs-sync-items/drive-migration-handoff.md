# Drive Migration to gfs_sync_items — Handoff

Lessons from file migration (Slices 1-4) and email/attachment migration (E1-E4, A1-A4).
Written 2026-03-18 after completing all three entity types.

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

## The big design question: download stage

Drive has a two-stage pipeline that files/emails don't:

```
pending → downloading → stored → processing → synced
         ↑ download stage ↑    ↑ upload stage ↑
```

Files/emails go straight: `pending → processing → synced`.

**Decision needed:** Does the download stage live on gfs_sync_items or stay on drive_files?

**Our recommendation: keep download on drive_files, use gfs_sync_items from `stored` onward.**

Reasoning:
- The download stage is drive-specific (Google Drive API, content_hash comparison, local file storage). It's "download from source," not "sync to GFS."
- gfs_sync_items tracks sync-to-GFS state. Adding download-specific statuses (`downloading`, `stored`, `download_failed`) to the shared table pollutes the model for all entity types.
- Analogy: emails start `blocked` in gfs_sync_items. Classification (an email-specific gate) transitions to `pending`. For drive: the download stage is the drive-specific gate. When download completes (`stored`), transition gfs_sync_items from `blocked → pending`. Then the regular sync pipeline takes over.
- This means drive files start as `blocked` in gfs_sync_items (like emails). The download pipeline runs entirely on drive_files. When the download worker finishes and the file is `stored`, it writes `blocked → pending` on gfs_sync_items to hand off to the sync worker.

**Alternative:** Put all statuses on gfs_sync_items. Simpler (one table), but contaminates the model. The `downloading`/`stored`/`download_failed` statuses are already in the gfs_sync_status enum — they'd work. But no other entity type uses them, and queries filtering "what needs syncing" would need to exclude download-stage rows.

**If you keep download on drive_files:** You need a third entity-agnostic claim RPC — `claim_pending_download` — or keep the old `claim_pending_drive_download` for the download stage only.

## Pitfalls we hit (apply these)

### 1. The old trigger's drive branch is missing event types

When we switched email writers (E2), the negative reviewer caught that the old trigger's email branch didn't handle `sync_requested`, `sync_rejected`, `sync_excluded`, `sync_blocked`. The audit trigger produces these via its CASE mapping, but the old trigger hit `ELSE RETURN NEW` — silently dropping them. Entity table never updated. Claim RPCs couldn't find the entity.

**The drive branch has the same gap.** It handles download and upload events but NOT:
- `sync_requested` (for re-sync triggers)
- `sync_excluded` (for exclusion)
- `sync_blocked` (for re-blocking)
- `sync_rejected` (probably not needed for drive)

You MUST add these to the drive branch of `update_gfs_sync_status` in your writer-switch migration. Without them, any app-initiated transition that goes through gfs_sync_items → audit trigger → event will silently fail to project to `drive_files`.

### 2. Full projection needed after worker switch

We learned this the hard way across E2 → E3:

- **E2 (writer switch):** Added `is_excluded`-only projection for emails/attachments. Reasoning: the old trigger chain handles `gfs_sync_status` and `gfs_doc_id` projection via events. Only `is_excluded` has no event-driven path.
- **E3 (worker switch):** Had to upgrade to FULL projection (`gfs_sync_status` + `gfs_doc_id` + `is_excluded`). Reasoning: once the worker writes directly to gfs_sync_items instead of inserting events, the old trigger's drive branch never fires for worker transitions. No events = no projection.

**For drive:** If you split writer and worker switches into separate slices, you'll need to upgrade projection between them. Or just start with full projection from the beginning — it's simpler and the only cost is a few redundant UPDATE statements during coexistence (old trigger also projects, but with the same values).

### 3. gfs_doc_id COALESCE won't clear NULL

The old trigger uses `COALESCE(NEW.gfs_doc_id, drive_files.gfs_doc_id)` when projecting. This means writing `gfs_doc_id = NULL` to gfs_sync_items → audit event with NULL gfs_doc_id → old trigger does `COALESCE(NULL, existing_value)` = keeps existing value. Entity table never clears.

**Workaround during coexistence:** When clearing gfs_doc_id (e.g., re-sync trigger, force_sync_at), write `gfs_doc_id = NULL` directly to `drive_files` alongside the gfs_sync_items write. Remove this workaround after readers switch.

### 4. Re-inclusion from `deleted` needs two-step update

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

### 5. Content gate uses `excluded`, not `rejected`

`rejected` is semantically reserved for resolver allowlist rejection (emails only). The content gate (file too large, empty body, unsupported format) writes `excluded`. Drive's content gate should do the same.

### 6. One migration per concern — no bundling

The file migration bundled the vocab fix with triggered_by column, projection removal, and old RPC decontamination in a single 677-line migration. Each created cascading problems. The migration was reverted.

For drive: separate migrations for backfill, trigger extension, projection, RLS, code changes. Each should be deployable and testable independently.

### 7. Old RPCs are read-only

Don't modify the old drive claim RPCs (`claim_pending_drive_download`, `claim_pending_drive_sync`, `claim_pending_drive_deletion`). They work. They get replaced by the entity-agnostic RPCs when the worker switches. Modifying them risks breaking the existing pipeline during coexistence.

### 8. "Pre-existing failure" is a claim, not a fact

If a test fails after your migration, don't label it "pre-existing" without proof. `git stash`, run at the prior commit, confirm it fails there too. If you can't confirm, it's your regression. We carried 4 "pre-existing" test failures through the file migration without verifying. Two turned out to be regressions.

### 9. db-checks trigger liveness allowlist

The liveness checker can't trace trigger→trigger chains (gfs_sync_items → audit trigger → event → old trigger). You'll need to add entries like `drive:sync_requested`, `drive:sync_excluded`, `drive:sync_blocked` to the allowlist in `tools/db-checks/src/compare/checks.ts`. These are NOT orphaned — they're produced by the audit trigger's CASE mapping. Comment explaining the chain and when to remove.

### 10. Unit test mocks break on every switch

Every writer switch (code writes to `gfs_sync_items` instead of entity table) breaks unit test mocks. The mock Supabase client doesn't know about `gfs_sync_items`. Budget for:
- Adding `.table("gfs_sync_items")` / `.from("gfs_sync_items")` to mock client setup
- Updating `.select()` assertions for computed relationship syntax
- Changing mock return data to array shape: `gfs_sync_items: [{ gfs_sync_status: "..." }]`

Every reader switch also breaks unit test mocks — the `.select()` strings change and filter names get `gfs_sync_items.` prefix.

### 11. PostgREST computed relationships return arrays

TypeScript types: `gfs_sync_items: { gfs_sync_status: string }[]` — NOT `{ ... } | null`. Access via `row.gfs_sync_items?.[0]?.gfs_sync_status`. Four TypeScript type errors caught by the push hook on E4.

### 12. Other agents switch branches

Multiple Claude sessions share the working tree. Other agents leave dirty files and switch branches. Always:
- `git checkout main` and verify `git branch --show-current` before committing
- Only `git add <specific-files>` — never `git add .`
- Don't restore/checkout other agents' dirty files
- Don't run `ruff format .` on the whole directory

### 13. test-supabase can get into a stale state

If only the DB container is running (no kong/auth/rest), do a full `test-supabase stop` + `test-supabase start`. The CLI detects the running DB and skips starting other services. Clean stop fixes it.

## Drive-specific columns not on gfs_sync_items

These stay on `drive_files` — they're drive lifecycle, not sync lifecycle:

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

## Backfill status mapping for drive

Drive files don't have a classification gate like emails. But they may have download-stage statuses. Mapping:

```sql
CASE
  -- If using "download stays on drive_files" design:
  -- Files that haven't completed download should be 'blocked' in sync table
  WHEN df.gfs_sync_status IN ('pending', 'downloading', 'download_failed')
    THEN 'blocked'::gfs_sync_status
  -- Files that are stored (downloaded, ready for GFS upload)
  WHEN df.gfs_sync_status = 'stored'
    THEN 'pending'::gfs_sync_status
  -- Defensive: 'failed' has no transitions
  WHEN df.gfs_sync_status = 'failed'
    THEN 'upload_failed'::gfs_sync_status
  -- Everything else (synced, excluded, pending_deletion, etc.) maps 1:1
  ELSE df.gfs_sync_status
END
```

If using "all statuses on gfs_sync_items" design, just copy `df.gfs_sync_status` directly (all values are valid enum members).

## Slice structure (recommended)

Same 4-slice pattern, but drive has the download stage complication:

1. **D1: Backfill + infrastructure** — Creation trigger, cleanup trigger, computed relationships, RLS SELECT policy, backfill existing drive_files
2. **D2: Switch writers** — App code (exclusion toggle, external toggle, force_sync) writes to gfs_sync_items. Add missing event types to old trigger's drive branch. Add RLS UPDATE policy. is_excluded projection (or full projection if doing it all at once).
3. **D3: Switch worker** — Download worker writes `blocked → pending` to gfs_sync_items when download completes. Sync worker uses entity-agnostic claim RPCs. Full projection if not already done.
4. **D4: Switch readers** — Admin pages, browse tools, data summary queries read from gfs_sync_items via computed relationships.

The download worker is the novel part. Everything else follows the email pattern exactly.

## Reference files

| File | What it shows |
|---|---|
| `supabase/migrations/20260318183104_slice_e1_backfill_emails.sql` | Email backfill pattern (two-step INSERT + UPDATE with trigger bypass) |
| `supabase/migrations/20260318183152_slice_e2_writer_prerequisites.sql` | Writer switch prerequisites (transitions, RLS, old trigger extension, audit trigger projection) |
| `supabase/migrations/20260318200340_slice_e3_worker_prerequisites.sql` | Worker switch prerequisites (full projection upgrade, attachment backfill) |
| `supabase/migrations/20260313162931_close_audit_gaps_deletion_and_retry.sql` | Old trigger with drive branch (13 event types) — the one you'll extend |
| `nextjs-app/lib/services/project-email.ts` | Reader switch pattern (computed relationships, array accessor, fallback) |
| `python-services/agent_api/api/email.py` | Writer switch pattern (read from gfs_sync_items, write to gfs_sync_items, coexistence entity table writes) |
| `python-services/agent_api/email_sync_service.py` | Worker switch pattern (_update_sync_item helper, dual writes) |
| `tools/db-checks/src/compare/checks.ts` | Trigger liveness allowlist |
| `.claude/builds/gfs-sync-emails/whiteboard.md` | Email migration whiteboard (process, quality log) |
| `docs/specs/gfs-sync-items/slice-e2-switch-writers.spec.md` | E2 spec (most detailed, has coexistence model) |
