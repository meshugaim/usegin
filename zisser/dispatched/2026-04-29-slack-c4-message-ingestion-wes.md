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
4. **Persistence** — write a `data_items` row:
   - `project_id` from binding
   - `entity_type = "slack_message"` (new value; free-form `str` column,
     no enum migration needed — verified)
   - `entity_id = "<team_id>:<channel_id>:<ts>"` — composite, deterministic
   - `title = <first 80 chars of text, mrkdwn-stripped>`
   - `extracted_text = <full mrkdwn-stripped text>` — Effi's index reads
     this field (verify via `python-services/agent_api/data_items/`)
   - `status = "ingested"` — matches the lifecycle precedent in
     `python-services/agent_api/data_items/__init__.py:54`
   - `access_level = "workspace"` (default) — TODO comment that channel-
     level RLS is C5 territory, NOT this slice.
5. **Idempotency** — UNIQUE INDEX on
   `(project_id, entity_type, entity_id)` IF NOT EXISTS. Add migration
   if missing. On conflict → `ON CONFLICT DO NOTHING`. **Verify the
   index doesn't already exist before adding** (other ingestors may
   have already added a similar shape).
6. **Mrkdwn → plain text** — regex-only per CF6. Pattern: strip
   `<@U…>` → `@user`, `<#C…|name>` → `#name`, `<http…|label>` → `label`,
   `*bold*` / `_italic_` / `~strike~` / `` `code` `` markers stripped.
   Inline helper in `lib/` (small; not its own file unless >40 lines).
7. **Tests** in `nextjs-app/tests/unit/lib/slack-event-handlers.test.ts`:
   - bound channel + plain message → 1 data_items row inserted
   - unbound channel → 0 rows, ApplyResult notes "channel_not_bound"
   - subtype=bot_message → ignored
   - own bot_id → ignored (feedback-loop guard)
   - re-deliver same `(team_id, channel_id, ts)` → 0 new rows (idempotent)
   - thread reply (`thread_ts` set) → still ingested as its own row;
     thread bundling is retrieval-time concern, NOT here
   - mrkdwn formatting stripped correctly (one assertion per regex
     branch)
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

- Project assignment when binding has `access_level = "channel"` —
  default to `"workspace"` for now; comment a TODO. Lihu can decide
  later; this slice doesn't need it.
- Slack stub user model (CF) — C5 territory. Skip; existing entity_id
  composite handles it.

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
