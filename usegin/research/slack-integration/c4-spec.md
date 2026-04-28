# C4 spec — Slack message ingestion → data_items → Effi-queryable

**Slice goal.** A user posts a message in a Slack channel that's bound to
an AskEffi project. Within seconds, that message is indexed and Effi can
answer questions citing it.

**Read this if you want to know:** what the smallest C4 vertical slice
looks like, what's settled vs `[ORIA]`-open, and what the Linear sub-issue
breakdown will be.

---

## Why this slice now

CLOSE.md § "Next action": *"Once both demos work, the next slice is C4
(Events ingestion → message data items → Effi can answer questions about
Slack messages)."*

C1-C3 already shipped: workspace install, channel-binding picker, Events
route receiving + verifying signed events. C4 is the layer that turns a
received `message` event into a queryable `data_item`.

## Architecture (already settled by the round)

Per `recommendation.md` and SYNTHESIS:

- **Per-message data_items** (CF5). Not per-channel rollups, not
  per-thread. Each Slack message → one `data_items` row.
- **Born-together pattern** (`recommendation.md:130`). Same shape as
  `create_sharepoint_file_with_data_item` (migration
  `20260410133824`): a single atomic RPC inserts the `slack_messages`
  row + its `data_item` row + their FK link. No two-phase claim window.
- **Idempotent on `(team_id, channel_id, ts)`** (SYNTHESIS, B5). Slack
  retries Events delivery; second insert returns the first row's id, no
  duplicate ingestion.
- **90-day backfill window default** (R5 / `recommendation.md:104`).
  Out of scope for C4 itself — C4 ships *go-forward only*; backfill is
  C5 (next slice). Honest framing: "search-from-now-on" at C4, "search-
  recent-history-too" at C5.
- **Read-only at MVP** (D2). C4 is consume-only — no posting back, no
  reaction handling at MVP, no thread-bundling at indexing time
  (thread bundling happens at retrieval, per CF5).
- **Direct Slack** (R1 lean a). No Unified.to dependency in C4.

## Out-of-scope (deferred to later slices)

- Backfill / history walk → C5.
- Reactions as signal → captured in `raw` field but not indexed → C6.
- Edit / delete event handling → C7.
- Thread-bundling at retrieval → cross-cuts retrieval pipeline, not C4.
- Slack Connect / shared-channel stub-user → C8.
- DM / mpim ingestion → never (refused at customer surface).

## Acceptance criteria

A1. **Message → data_item.** A `message` event delivered to
    `/api/slack/events` for a `channel_id` that is in
    `slack_channel_bindings` produces exactly one `slack_messages` row
    and exactly one linked `data_item`, atomic.

A2. **Idempotency.** Slack delivers the same event twice (or three times,
    per their retry policy). The result is exactly one row and one
    data_item; the second delivery is a no-op success.

A3. **Unbound channels are dropped.** A `message` event in a channel that
    is not in `slack_channel_bindings` is acknowledged with 200 (so Slack
    stops retrying) but ingests nothing.

A4. **Bot messages are skipped.** Messages where `bot_id` matches our
    own integration's bot user id are skipped — we don't index our own
    posts back in (avoids feedback loops with UseGin-Slack and any
    customer-side automation we wire up later).

A5. **Subtype filter.** `message` events with `subtype` in the
    "noise" set (`channel_join`, `channel_leave`, `bot_message`,
    `message_changed`, `message_deleted`) are dropped. Edits and
    deletes ship in C7.

A6. **`data_items.status` lifecycle.** Born at `'ingested'`. Failure
    paths (e.g. write error mid-ingest) set `'failed'` +
    `failure_reason`. Same shape as the SharePoint born-together pattern.

A7. **RLS.** `slack_messages` row tenant-scoped via the binding's
    `workspace_id`/`project_id`; `data_items` row scoped per existing
    convention. CI assertion on every new table.

A8. **Effi can answer.** End-to-end: post a message in a bound channel,
    ask Effi a question that should cite that message via the
    dogfooding-effi CLI, get the citation back. Acceptance is empirical
    via the existing retrieval pipeline — no Effi changes required.

A9. **Latency budget.** From `message.ts` (Slack server-side) to
    `data_items.created_at` (our DB), p95 < 5s under no backlog. The
    Events route is already async (returns 200 immediately), so latency
    is bounded by the worker pickup + ingest time.

## Test plan layers

- **python-llm:** none (no SDK contract change for this slice).
- **python-db:** ingestion RPC contract, idempotency on `(team_id,
  channel_id, ts)`, RLS assertions, status lifecycle.
- **nextjs-db:** Events route → ingestion-RPC call wiring; subtype
  filter; bot-skip filter; unbound-channel drop.
- **nextjs-browser:** none (no UI change for this slice — the binding
  card from C3 already shows the bound channel).
- **e2e:** one Playwright test driving the demo path: bind channel →
  post → assert message visible in project's data_items panel.

## Slice decomposition (sketch — slicing-specs will refine)

C4.1 — Schema: `slack_messages` table + `create_slack_message_with_data_item` RPC + RLS.
C4.2 — Events route: handle `event.type=message`, filter (A3/A4/A5),
       call RPC.
C4.3 — Idempotency: enforce on `(team_id, channel_id, ts)` unique
       constraint + ON CONFLICT DO NOTHING semantics in the RPC.
C4.4 — End-to-end test: bind → post → assert (A8).
C4.5 — Failure-path coverage (A6): inject ingest error, assert
       `'failed'` + `failure_reason`.

## Posture questions for Oria — `[ORIA]` holes

These don't block C4.1-C4.3 (they're known-shape work). They block
C4.4-C4.5 because each one moves the acceptance bar.

### Q1 — Backfill ETA story for the demo

C4 ships go-forward-only. Pilot customers connecting see "messages from
now on." That's honest, but Day-1 in a connected channel they'll see
nothing. Choices:

- **(a) Ship C4 standalone.** First message demos the slice. Customer
  has to wait for organic traffic.
- **(b) Manual seed at install time.** When the binding is created,
  fetch the last *N* messages from the channel API and ingest them
  inline (so the binding is born with its history). This is a degenerate
  C5 — bounded backfill (e.g. last 7 days, capped at 100 messages) just
  to make the demo feel alive.
- **(c) Wait for C5.** Don't ship C4 alone; pair it with a real
  backfill walk. Adds 2-3 days but the demo lands clean.

**Lean: (b).** Tiny additional surface; uses an API we'll need anyway
for C5; makes Day-1 demo work. `[ORIA] answer:` ___

### Q2 — Reactions in the `raw` field at C4 or wait?

SYNTHESIS says capture-in-`raw`-don't-index-at-MVP. Choice is whether
the C4 ingest already stores `reactions` in the message's `raw` JSON
column for future use, or leaves the column empty until C6.

- **(a) Capture now in `raw`.** Tiny extra work; saves a future
  migration to backfill historical reactions.
- **(b) Wait.** Keep C4 minimal; C6 backfills if we need it.

**Lean: (a).** `raw` is opaque storage; capturing more costs nothing
schema-wise. `[ORIA] answer:` ___

### Q3 — Failure visibility — surface to customer or silent log?

When ingestion fails (A6), do we:

- **(a) Customer-visible warning** in the project's Integrations panel
  (e.g. "Slack: 12 messages failed to ingest in last 24h").
- **(b) Sentry-only.** Customer sees only "channel connected"; we get
  paged.
- **(c) Defer the UI.** Sentry only at C4; customer-visible at C7+.

**Lean: (c).** The C7 edit/delete slice is a better moment to think
about message-state UX as a whole. `[ORIA] answer:` ___

### Q4 — When does C4 ship — before or after the demo?

The demo Lihu is going to run interactively (D6) is just C1-C3 (install
+ binding + Events-receive-and-ack). C4 *could* slot in before the demo
or after it.

- **(a) Before demo.** Demo includes "post a message → Effi answers
  about it" — the wow moment. Adds ~1 week of work before the demo.
- **(b) After demo.** Demo is just install + binding; Effi-citation
  comes in the next session. Keeps the demo small and shippable.

**Lean: (b).** Per D6 (interactive demo, see what surprises us), keep
the demo small. C4 starts the autonomous run *after* you've seen C1-C3
work end-to-end. `[ORIA] answer:` ___

---

## What happens once Q1-Q4 land

Charter in hand, the next Gin:

1. Creates ENG-5XXX sub-issues for C4.1-C4.5 under ENG-5409.
2. Runs `slicing-specs` → `test-architecture` → `tdd-impl-plan` →
   `tdd-execute` per the standard workflow.
3. Lands C4.1-C4.3 (schema + Events route wiring + idempotency)
   end-to-end without re-prompting (per `feedback_autonomous_between_slices`).
4. Pauses for Lihu before C4.4 because A8 acceptance is empirical
   against the dogfood project.

**Time to unblock from your side: ~5 minutes.** Time to land C4.1-C4.5:
~1 week single-Gin (or ~3 days parallel-Gin once D5.1 ships).

## Threading

↑`recommendation.md` (CF5, R5, R1) · ↑SYNTHESIS (CF5, B5) ·
~CLOSE.md "Next action" · ~`20260410133824_born_together*` migration
(reference impl) · ~ENG-5409 (parent: customer Slack handoff) ·
~D5.1-charter-session-wt.md (per-session worktrees → enables parallel C4).
