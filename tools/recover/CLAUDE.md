# recover

**Use `recover` to un-stick sync items that terminated in a failure state** —
`deleted`, `retry_exhausted`, `upload_failed`, or `excluded`. Calls the
`reset_stuck_sync_item` RPC via the Supabase Management API.

Typical use case: after shipping a worker-side bug fix, entities that ended
up in `retry_exhausted` or `deleted` need to be handed back to the worker.
The UI's "un-exclude" flow doesn't cover these edge cases (see
`docs/bugs/024-drive-vais-upload-timeout.md` for the incident that motivated
this tool).

## Quick Start

```bash
# Dry-run first, always. --env is required.
recover file drive f52c2f20-5748-4493-98c3-e3747f586d6f -e staging
recover project f0c450db-c147-4986-a737-b3d9787c9ef7 -e staging --entity drive

# Actually reset (staging — no extra confirmation needed)
recover file drive f52c2f20-... -e staging --execute

# Actually reset (production — requires --yes-i-am-sure)
recover project f0c450db-... -e production --execute --yes-i-am-sure

# Machine-readable output
recover project f0c450db-... -e staging --json | jq .
```

## Safety Model

| Guard | What it enforces |
|---|---|
| **Dry-run by default** | `--execute` is required to mutate. The default prints the plan and exits without touching anything. |
| **`--env` required** | No default. Forces an explicit production/staging choice so you can't accidentally mutate prod thinking you're on staging. |
| **`--yes-i-am-sure` for prod writes** | `production + --execute` also requires `--yes-i-am-sure`. This catches typos in project UUIDs and the "I thought I was on staging" mistake. |
| **UUID validation** | Entity and project IDs are validated as canonical UUIDs before any SQL is built, preventing malformed input from reaching the DB. |
| **`sql_literal` escaping** | All string values in the generated SQL are escaped via `sqlLiteral()`. |
| **RPC is SECURITY DEFINER + REVOKE** | The underlying `reset_stuck_sync_item` function is only callable by the service role, not by anon/authenticated. Recovery is an engineer action, not a user action. |

Both parts of the safety model matter:
- The CLI is the *handle* — it stops accidents at the command line.
- The RPC is the *primitive* — it stops bad SQL and keeps the transition logic next to the triggers that enforce it.

## Commands

### `recover file <entity_type> <entity_id>`

Un-stick one entity. `entity_type` is one of: `file`, `email`, `attachment`,
`drive`, `meeting_summary`, `meeting_transcript`, `sharepoint`.

```bash
recover file drive f52c2f20-5748-4493-98c3-e3747f586d6f -e staging
recover file drive f52c2f20-... -e production --execute --yes-i-am-sure
```

Output shows a before/after table. If the item is already in a healthy state
(`pending`, `processing`, `synced`, `blocked`), the action is `already_clean`
and nothing is touched. If the entity doesn't exist, the action is `not_found`
and the command exits non-zero.

### `recover project <project_id>`

List (dry-run) or reset (execute) every stuck item in a project.

```bash
recover project f0c450db-c147-4986-a737-b3d9787c9ef7 -e staging                  # dry-run
recover project f0c450db-...              -e staging --entity drive               # scoped
recover project f0c450db-...              -e production --execute --yes-i-am-sure  # live
```

Scopes the reset to a single entity type with `--entity drive` (or any of the
seven types). Without the filter, it resets every stuck item regardless of
type. Dry-run output lists every candidate; execute output shows the reset
result for each.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | yes | Personal access token from https://supabase.com/dashboard/account/tokens. Used only for the Management API call. |

Project refs are hardcoded in `src/lib/envs.ts` (same as `tools/project-clone`).

## How it Works

1. CLI parses args and enforces the safety guards.
2. For `project`, it first calls a read-only `SELECT` against the Management
   API (`/v1/projects/{ref}/database/query`) to list candidates.
3. Dry-run stops here and prints the plan.
4. Execute calls `reset_stuck_sync_item(entity_type, entity_id, actor)` via
   the same endpoint. The RPC:
   - Handles the `deleted → pending` two-step dance (the validate trigger
     requires `is_excluded = true` on the pending row during the transition).
   - Resets `failure_count`, `pending_gfs_doc_id`, `pending_lro_name` via the
     existing trigger.
   - Clears `drive_files.retry_reset_at`, `last_synced_at`, `sync_error` for
     drive entities (those live on `drive_files`, not projected from
     `gfs_sync_items`).
   - Returns a single row with before/after state so the CLI can render a diff.
5. On execute, each reset emits a `sync_requested` event with
   `triggered_by = <actor>` via the audit trigger — that event is how you
   prove the reset ran when reviewing the audit trail later.

## Not Wrapping the MCP

The CLI calls the Supabase Management API directly (`api.supabase.com`), not
the Supabase MCP. The MCP only runs inside a Claude session; a CLI needs to
work from a terminal, script, or cron too. Both the MCP and the CLI call the
same underlying endpoint, so going direct removes one layer rather than adding
one.

## Tests

```bash
cd tools/recover
bun test                 # unit tests for arg parsing + HTTP client
bun run typecheck        # strict tsc --noEmit
```

The RPC itself has integration tests in
`python-services/tests/integration/db/test_reset_stuck_sync_item.py` which
run against the test-supabase instance.

## Adding Entity Types

When a new entity type is added to `gfs_entity_type`:

1. Add it to `ENTITY_TYPES` in `src/lib/api.ts`.
2. If the entity has non-projected metadata fields (like `drive_files.retry_reset_at`),
   add a branch to the migration's per-type cleanup. For most entity types the
   generic `gfs_sync_items` path is enough.
3. Add a unit test for the new type in `tests/api.test.ts`.
