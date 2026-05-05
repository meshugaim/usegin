# Dispatch — Slack C4 message ingestion (Wes-implementer)

**Date:** 2026-04-29
**Spawned by:** Zisser (Lihu busy; running autonomous-vibe)
**Type:** sub-Gin charter (Wes, Opus, slice implementer)
**Linear:** new sub-issue under ENG-5409 (TBD: Wes opens it via `plan create`)
**Plan:** `zisser/plans/2026-04-29-slack-fully-functional.md` (section B)

## Goal

Land **first slice of Slack message ingestion** — a `message` event handler
in `nextjs-app/lib/slack-event-handlers.ts` that, on receipt of a
`message.channels` / `message.groups` event for a bound channel, inserts
one `data_items` row per message with idempotent semantics on
`(team_id, channel_id, ts)`.

This is the C4 slice the existing `slack-event-handlers.ts` parks as
"out of scope." The event-API receiver and signing-secret verification
already exist. Wes adds the message branch + the persistence path.

## Why this slice (small, high-leverage)

- Customer-facing Slack today: customer can connect (OAuth), bind a
  channel — but **nothing flows.** This slice is the missing pipe.
- Per `usegin/research/slack-integration/SYNTHESIS.md` CF5: per-message
  granularity, idempotent on `(team_id, channel_id, ts)`. Settled —
  not a re-decision.
- Per CF6: NO LLM in ingestion. Mrkdwn → plain text via regex (email-
  splitter ENG-5197 precedent applies).
- Webhook-ingress invariant per CF8: signing-secret verify already lives
  in Next.js; route already proxies. Wes just adds the handler branch.

## Scope (what to build)

> **Charter revised 2026-05-05** after first Wes halted at orientation:
> charter as originally written assumed pre-v3-pivot `data_items` shape
> (string `entity_id`, `access_level='workspace'`, project-scoped unique).
> Live schema is post-pivot: `entity_id uuid NULL`, `access_level CHECK
> ('internal','external')`, partial unique on `(entity_type, entity_id)
> WHERE entity_id IS NOT NULL AND deleted_at IS NULL`. Aurea's call: option
> 1 — match the schema, SharePoint born-together precedent. §4–5 below
> reflect the revised shape; §1–3 and §6–8 are unchanged.

1. **Event handler** in `nextjs-app/lib/slack-event-handlers.ts`:
   - Add `message` to `SlackEventType` union.
   - Add `SlackMessageEvent` shape covering core fields: `type: "message"`,
     `channel: string`, `user?: string`, `text: string`, `ts: string`,
     `subtype?: string`, `thread_ts?: string`, `bot_id?: string`.
   - Add `handleMessageEvent(admin, envelope)` returning ApplyResult
     (existing shape).
2. **Filter logic** — ignore (return early, `installsAffected: 0,
   bindingsAffected: 0`):
   - `subtype` in {`bot_message`, `channel_join`, `channel_leave`,
     `channel_topic`, `channel_purpose`, `message_changed`,
     `message_deleted`} (deliberately conservative for v0; revisit
     edits/deletes in C4.5 — note in handler comment)
   - `bot_id` is set AND matches our own `bot_user_id` from
     `slack_installs` (avoid feedback loop)
3. **Binding lookup** — query `slack_channel_bindings` for
   `(slack_install_id, channel_id)`. If no row → ignore (channel not
   bound to a project). Use the install row keyed by
   `(team_id, app_id [, enterprise_id])`.
4. **Persistence — born-together pattern (SharePoint precedent at
   `supabase/migrations/20260410133824_born_together_create_sharepoint_file_with_data_item.sql`).**

   Migration: new `bunx supabase migration new slack_messages_born_together`.

   - **New table `slack_messages`:**
     - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
     - `project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
     - `slack_install_id uuid NOT NULL REFERENCES slack_installs(id) ON DELETE CASCADE`
     - `slack_channel_binding_id uuid NOT NULL REFERENCES slack_channel_bindings(id) ON DELETE CASCADE`
     - `team_id text NOT NULL`
     - `channel_id text NOT NULL`
     - `ts text NOT NULL` — Slack's message timestamp (e.g. `"1716482853.123456"`)
     - `thread_ts text NULL`
     - `slack_user_id text NULL` — `event.user`
     - `subtype text NULL` — preserved for diagnostics, even though most subtypes are filter-rejected upstream
     - `bot_id text NULL`
     - `raw_text text NULL` — mrkdwn-original
     - `data_item_id uuid NOT NULL REFERENCES data_items(id) ON DELETE CASCADE`
     - `created_at timestamptz NOT NULL DEFAULT now()`
     - `updated_at timestamptz NOT NULL DEFAULT now()`
     - `deleted_at timestamptz NULL` — soft-delete column to align with the live partial-unique shape on `data_items`
     - **Partial unique:** `CREATE UNIQUE INDEX slack_messages_team_channel_ts_unique ON slack_messages (team_id, channel_id, ts) WHERE deleted_at IS NULL` — this is the idempotency key per CF5
     - RLS: enable, mirror `slack_channel_bindings` access pattern (`TO authenticated` policies, see `supabase/migrations/20260427201822_slack_channel_bindings.sql` for the precedent). The channel binding's project_id is the source of truth; `slack_messages` rows are visible to whoever can see the binding's project at the appropriate access_level.

   - **RPC `create_slack_message_with_data_item(...)`** — atomic born-together (clone the SharePoint RPC's shape):
     1. INSERT `data_items` at `entity_type='slack_message'`, `status='ingested'`, `access_level='internal'`, `project_id=<binding.project_id>`, `title=<first 80 chars of plain_text>`, `extracted_text=<plain_text>` → returns new `data_items.id`.
     2. INSERT `slack_messages` with all fields including `data_item_id=<new data_items.id>`. ON CONFLICT against `slack_messages_team_channel_ts_unique` DO NOTHING.
     3. If `slack_messages` insert was a no-op (conflict — concurrent re-deliver race), DELETE the orphan `data_items` row created in step 1 (mirror SharePoint RPC lines 113–117) and return empty.
     4. UPDATE `data_items.entity_id = <new slack_messages.id>` (mirror SharePoint RPC lines 121–123 — the entity_id link is set after both rows exist).
     5. RETURN the `slack_messages` row.
   - SECURITY DEFINER, search_path = public, REVOKE FROM PUBLIC, GRANT EXECUTE TO service_role.
   - The handler calls this RPC via the admin client (existing test pattern uses `mock.module("next/headers")` chain-builder; clone it).

5. **Idempotency** — guaranteed by the partial unique on `slack_messages (team_id, channel_id, ts) WHERE deleted_at IS NULL` PLUS the RPC's ON CONFLICT DO NOTHING + orphan-cleanup. No additional `data_items` index needed; the v3 partial unique on `data_items (entity_type, entity_id) WHERE entity_id IS NOT NULL AND deleted_at IS NULL` already protects the `data_items` side because each `slack_messages.id` is unique.
6. **Mrkdwn → plain text** — regex-only per CF6. Pattern: strip
   `<@U…>` → `@user`, `<#C…|name>` → `#name`, `<http…|label>` → `label`,
   `*bold*` / `_italic_` / `~strike~` / `` `code` `` markers stripped.
   Inline helper in `lib/` (small; not its own file unless >40 lines).
7. **Tests** in `nextjs-app/tests/unit/lib/slack-event-handlers.test.ts`:
   - bound channel + plain message → 1 RPC call to `create_slack_message_with_data_item` with the right args; ApplyResult counts the row
   - unbound channel → 0 RPC calls, ApplyResult notes "channel_not_bound"
   - subtype=bot_message → ignored, 0 RPC calls
   - own bot_id (matches `slack_installs.bot_user_id`) → ignored, 0 RPC calls
   - re-deliver same `(team_id, channel_id, ts)` → RPC returns empty (mocked), ApplyResult notes "duplicate" — 0 net rows from caller's perspective
   - thread reply (`thread_ts` set) → still ingested as its own row;
     thread bundling is retrieval-time concern, NOT here
   - mrkdwn formatting stripped correctly (one assertion per regex
     branch — pure-logic test on the helper, no DB involvement)
8. **Wire into route** — in
   `nextjs-app/app/api/slack/events/route.ts`, dispatch
   `event.type === "message"` to `handleMessageEvent`. Existing
   handlers already return ApplyResult; just add the branch.

## Out of scope (deliberately — DO NOT EXPAND)

- Backfill (`conversations.history` initial fetch) — that's C4.2.
- Edit / delete events — C4.5.
- File attachments — C5+.
- Reactions, threads-as-rollups — retrieval-time, not ingestion.
- Channel-level RLS / access_level beyond "workspace" — C5 binding
  posture.
- Slash commands / app_mentions — bidirectional surface, R2.
- Subscribe to events on the Slack app side — that's Lihu/Brown
  paperwork on api.slack.com (covered in `zisser/plans/...slack-fully-
  functional.md` block list).

## Tooling expected

- TDD trio: read `.claude/skills/test-architecture/SKILL.md`,
  `tdd-impl-plan`, `tdd-execute`. **Hook-enforced strict TDD** for the
  pure-logic seams (mrkdwn stripper, filter predicates). Wire the
  Supabase client behind a thin shim in tests (existing test file
  already does this for the other handlers — clone the pattern).
- Migration if needed: `bunx supabase migration new
  slack_data_items_idempotency` — only if the unique index isn't
  already present. Check first.
- Format with prettier before commits (per
  `feedback_format_before_tdd.md`).
- Commit per logical change (per `feedback_commits_at_every_change.md`).
  Push after each commit (per `feedback_always_push.md`).

## Acceptance criteria

1. New `message` branch in `slack-event-handlers.ts` + dispatch in
   `events/route.ts`.
2. Unit tests pass. All 7+ test cases above.
3. New migration (if added) applies cleanly locally.
4. Committed to `main` referencing this charter file path AND a Linear
   sub-issue under ENG-5409 that Wes opens via `plan create` (title:
   `rd-slack: C4.1 — message event handler + data_items persistence`).
5. No prod-DB writes. No staging/production deploys. Local-only
   validation.

## Open questions Wes should NOT block on

- Channel-level access_level posture — defer; this slice writes
  `data_items.access_level = 'internal'` per existing precedent
  (SharePoint, Drive). C5 territory.
- Slack stub user model (CF) — C5 territory. Skip.
- Backfill of historical messages — C4.2; out of scope.

## Stop conditions

- Lihu absent — DO NOT touch production DB or deploys.
- If a prior migration / index already collides with the idempotency
  shape → halt and surface; don't paper over.
- If signing-secret env is missing locally — surface; tests should mock
  the verify step (it's not on the unit-test path).
- 3 same-root failures at one TDD cycle → tikur + halt.

## Resume pointer

If Wes is interrupted, this charter file is the SOT. Resume entry:
`usegin/research/slack-integration/RESUME.md` for round-context;
`usegin/research/slack-integration/SYNTHESIS.md` for the convergent
findings that drove this slice's decisions.

## Dispatch return shape (Wes writes here on completion)

(Below this line, Wes appends results.)

---

## Wes return — 2026-05-05 — HALTED at orientation (no commits)

**Status:** halted before TDD per charter stop condition #2 ("prior migration /
index already collides with the idempotency shape → halt and surface; don't
paper over"). Two collisions, one config gap. Zero files touched, zero
commits, no Linear sub-issue opened.

### Schema collisions vs charter

| Charter (acceptance criteria 4) | Live schema (verified) | Collision |
|---|---|---|
| `entity_id = "<team_id>:<channel_id>:<ts>"` (composite string) | `data_items.entity_id uuid NULL` (migration `20260408092532_data_items_entity_id_partial_unique.sql:73`) | type mismatch — string into uuid column rejects at DB |
| `access_level = "workspace"` | `CHECK (access_level IN ('internal','external'))` (`20260331180810_data_items_pivot.sql:33`, never widened — `grep -rn "access_level IN" supabase/migrations/2026*.sql` shows internal/external only across all 13 sites) | CHECK constraint reject |
| Idempotency: `UNIQUE(project_id, entity_type, entity_id) IF NOT EXISTS` | Existing partial unique: `UNIQUE(entity_type, entity_id) WHERE entity_id IS NOT NULL AND deleted_at IS NULL` (no `project_id`) | shape mismatch on the unique key — different scoping; can't `IF NOT EXISTS` over it |

The lifecycle parts the charter cites are correct: `status='ingested'` is a
valid CHECK value (`20260407110156`), `extracted_text TEXT` exists on
`data_items` (`20260407110418`), `entity_type` is free-form text. The two
breaks are entity_id type and access_level value.

### Config gap (charter stop condition #3)

`SLACK_SIGNING_SECRET` not set locally — verified via env probe. Not
on the unit-test path (the charter is right that we'd mock the verify
step), but worth flagging here because the route can't be exercised
end-to-end locally without it.

### Why I stopped (not papering over)

Three plausible patches surface immediately, each meaningfully different in
posture, none of them mine to pick (Mark's slot, not Wes'):

1. **Match the schema** — drop the composite-string idea, mint a Slack
   `slack_messages` table whose `id uuid` becomes `data_items.entity_id`,
   pattern-match SharePoint's "born together" approach
   (`20260410133824_born_together_create_sharepoint_file_with_data_item.sql`).
   New table = new surface. Bigger slice than charter scoped.
2. **Widen `data_items` constraints** — add `'workspace'` to the
   `access_level` CHECK, change `entity_id` to text-or-jsonb, broaden
   `data_items_live_entity_unique` to include `project_id`. Touches
   shared infrastructure for one ingestor; cross-cutting; needs Mark.
3. **Sidestep `data_items` for v0** — write Slack messages to a
   Slack-local table; bridge to `data_items` later. Decouples the
   slice from the shared-pivot collision. Punts the "data flows into
   the project" half of the customer-facing goal Aurea narrowed to today.

All three are direction calls. The charter is settled on shape ("per CF5: per-
message granularity, idempotent on `(team_id, channel_id, ts)`. Settled — not
a re-decision.") but **the shape it settled on doesn't fit the v3 data_items
pivot** that landed after CF5 was written. That's a synthesis-vs-current-state
gap, not an implementation puzzle.

### What's solid (no recheck needed when resumed)

- `bot_user_id` exists on `slack_installs` (verified) — feedback-loop guard
  shape works.
- `slack_channel_bindings (slack_install_id, slack_channel_id)` lookup is
  correct (verified — unique idx exists at `20260427201822:80`).
- Existing `slack-event-handlers.ts` shape (admin-client-shim, ApplyResult,
  notes[], dispatch switch) cleanly accommodates a `handleMessageEvent`
  branch when the persistence question is settled.
- The `mock.module("next/headers")` + chain-builder test pattern in
  `tests/unit/lib/slack-event-handlers.test.ts` is a fine clone-base for the
  message-handler tests.

### ↑Q for Aurea / Lihu (need direction before this slice can land)

- **Q1 (load-bearing).** Which of the three options above? My read: option
  (1) "match the schema" is the cleanest — keeps `data_items` invariants,
  follows the SharePoint precedent, but expands the slice to ~2x. Option (2)
  is a one-migration shortcut but contaminates a shared surface for one
  ingestor. Option (3) defers the customer goal but unblocks the rest.
- **Q2.** If (2): is `'workspace'` actually the right value, or should
  Slack-channel-derived items be `'internal'` (existing precedent — same
  posture as a SharePoint file under an internal scope)? The charter's
  TODO comment ("channel-level RLS is C5 territory") suggests Aurea wants
  to *avoid* deciding access posture in this slice — `'internal'` is the
  zero-decision default and would dodge Q2 entirely.

### Files I read (no edits anywhere)

- `nextjs-app/lib/slack-event-handlers.ts`
- `nextjs-app/app/api/slack/events/route.ts`
- `nextjs-app/tests/unit/lib/slack-event-handlers.test.ts`
- `supabase/migrations/20260331180810_data_items_pivot.sql`
- `supabase/migrations/20260407110156_data_items_status_ingested_dispatched_processing.sql`
- `supabase/migrations/20260407110418_data_items_extracted_text_pivot.sql`
- `supabase/migrations/20260408092532_data_items_entity_id_partial_unique.sql`
- `supabase/migrations/20260427182028_slack_installs.sql`
- `supabase/migrations/20260427201822_slack_channel_bindings.sql`
- `python-services/agent_api/data_items/__init__.py`

### Resume cue (when direction lands)

Edit this charter's Scope section #4 (Persistence) and #5 (Idempotency) to
reflect the chosen option, re-dispatch a fresh Wes against the updated
charter. Sections 1–3 (event handler shape, filter logic, binding lookup)
and 6–8 (mrkdwn stripper, tests, route wiring) are unaffected and can land
as-is.

---

## Wes return — round 2 — 2026-05-05 — DONE

**Status:** option-1 (born-together SharePoint precedent) implemented end-to-
end. Linear sub-issue **ENG-5778** opened, work landed on `main`, issue closed.

### Commits (in order)

| SHA | Commit |
|---|---|
| `c540f01a9` | format(slack-events): biome pre-TDD pass on handler test |
| `4fd1d63c7` | feat(slack): slack_messages table + born-together RPC |
| `29e64238d` | feat(slack): handleMessageEvent + stripSlackMrkdwn for C4.1 |
| `6cff7eaf1` | docs(slack): route-level mention of C4.1 message dispatch |

All four pushed via autosync.

### What landed

- **Migration** `supabase/migrations/20260505164013_slack_messages_born_together.sql`:
  - `slack_messages` table — born-together columns + soft-delete + partial unique
    on `(team_id, channel_id, ts) WHERE deleted_at IS NULL` (CF5 idempotency key).
  - RLS: `TO authenticated`, project-member SELECT gated via the linked
    `data_items.access_level` (single source of truth — slack_messages cannot
    drift from its data_item's posture). Writes are service_role only.
  - RPC `create_slack_message_with_data_item(...)` — atomic born-together pair,
    `ON CONFLICT DO NOTHING` + orphan-cleanup mirroring SharePoint lines 113–117,
    `data_items.access_level='internal'` per the option-1 decision.
  - Applied locally with `bunx supabase migration up` cleanly.
  - `bun tools/db-test/src/cli.ts security` → 852 checks pass.
- **Handler** `nextjs-app/lib/slack-event-handlers.ts`:
  - `SlackEventType` extended with `"message"`.
  - `SlackMessageEvent` shape (channel, ts, text, user?, subtype?, thread_ts?,
    bot_id?).
  - `handleMessageEvent(admin, envelope)` — filter order: subtype reject → install
    lookup → own-bot guard (`event.user === bot_user_id`) → binding lookup →
    mrkdwn-strip → RPC. Empty RPC return surfaces `notes:["duplicate"]`. Errors
    surface `notes:["rpc_error:..."]`.
  - `stripSlackMrkdwn(input)` — regex-only per CF6 (NO LLM). Strips `<@U..>` →
    `@user`, `<#C..|name>` → `#name`, `<url|label>` → `label`, `*bold*` /
    `_italic_` / `~strike~` / `` `code` `` markers, decodes `&amp;`/`&lt;`/`&gt;`.
  - Dispatch `case "message"` added.
- **Route** `nextjs-app/app/api/slack/events/route.ts`: header-comment-only
  update — the route already calls `dispatchSlackEvent`, no behavior change
  needed beyond the dispatcher's new branch.

### Test counts

| File | Tests | Status |
|---|---|---|
| `nextjs-app/tests/unit/lib/slack-event-handlers.test.ts` | 28 (9 lifecycle existing + 11 stripper new + 8 message-handler new) | all green |

stripper coverage hits every regex branch the helper documents (one assertion
per branch + a combined "all branches in one message" smoke). handler coverage
hits all 7 charter cases plus the dispatch-routes-message smoke.

### Out-of-scope (deliberately punted, charter §117–128 unchanged)

- Backfill — C4.2.
- Edit / delete events — C4.5 (subtypes filtered today, table has `deleted_at`
  reserved for that path).
- File attachments — C5+.
- Slack stub user model + per-user-id resolution (`<@U..>` collapses to
  `@user` for now).
- Channel-level `access_level` posture beyond `'internal'` — C5.

### ↑Q for Aurea / Lihu (not blocking, FYI)

- **Q1.** `stripSlackMrkdwn` collapses every `<@Uxxx>` to literal `@user` (the
  display-name resolution is a Slack-stub-user concern, C5). Confirm that's
  fine for v0 — alternative is to keep the U-id literal (`@U123ABC`) so a
  future migration can resolve it. I went with `@user` because it's how the
  charter §6 named the substitution.
- **Q2.** Same for `<#Cxxx>` (no `|name`): collapses to `#channel`. Probably
  rare in practice (Slack usually emits `<#Cxxx|name>`), but the regex covers
  the bare form defensively.

### Friction (none)

Charter §4 revision was unambiguous; SharePoint precedent + Supabase CLAUDE.md
+ `user_can_see_at_access_level` helper composed cleanly. Local supabase
needed `API_EXTERNAL_URL=http://127.0.0.1:54321` to pass health (the just
recipe sets it; the bare CLI doesn't) — surfaced once, no time lost.
