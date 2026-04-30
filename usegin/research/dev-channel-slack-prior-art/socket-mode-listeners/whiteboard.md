# Socket Mode Listener Architecture — whiteboard

Angle: per-dev local Socket Mode listener, single shared bot, multi-machine.
Charter: `/workspaces/test-mvp/.claude/handoffs/handoff_20260430_105055.md` (dev-channel design recap).
Author: Poll (sub-agent), 2026-04-30.

---

## Top — the click

**Slack Socket Mode load-balances events across connections; it does NOT
broadcast.** With one shared bot ("Effi Spike") and one Socket Mode
listener per dev, each Slack message lands on **exactly one** of the N
listeners — chosen by Slack with no documented pattern. The "every dev
sees every message in their terminal" property the design assumes does
NOT come from Socket Mode itself; we have to build it.

> "When multiple connections are active, each payload may be sent to any
> of the connections. It's best not to assume any particular pattern for
> how payloads will be distributed across multiple open connections."
> — `docs.slack.dev/apis/events-api/using-socket-mode/`

This single fact decides the architecture: **the design as written in
the handoff (one-listener-per-dev, no coordinator) does not work.**
Three options, none free, in the Bottom section.

---

## Middle — the body

### F1. Auth shape — app-level token, `connections:write`, max 10 connections

- Socket Mode requires a separate **app-level token** (`xapp-…`) with
  scope `connections:write`, distinct from the bot token (`xoxb-…`)
  already cached at `~/.cache/slack-direct/token.json`. Source:
  `docs.slack.dev/apis/events-api/using-socket-mode/`.
- The token is **per-Slack-app, not per-installation/workspace**. All N
  dev machines listen with the *same* `xapp-…` token under the *same*
  app. There's no "per-machine token" path on the shared-bot
  architecture (Path A in the handoff).
- Rotation: app-level tokens are managed in the Slack app config UI,
  same surface where Socket Mode is enabled. No OAuth flow.
- Hard cap: **10 concurrent WebSocket connections per app** — comfortably
  above N=3 devs but a wall if we ever stretch this pattern (e.g.
  per-dev *and* per-agent connections).
- The current `experiments/slack-direct/main.py:75-85` `SLACK_SCOPES`
  list is bot-token scopes only; app-level token + `connections:write`
  are NOT yet on the spike (handoff confirms this at line 48).

### F2. Fan-out semantics — load-balanced (THE finding)

- Slack documents: "each payload may be sent to *any* of the
  connections." Multiple GitHub issues against `slackapi/bolt-python`
  (#462, #579, #1071) confirm this empirically: events go to **one
  connection chosen by Slack**, not all of them. No control over the
  selection.
- Slack's stated motivation for multi-connection is **active-active
  redundancy and graceful restart**, not multi-subscriber broadcast.
  From `docs.slack.dev/apis/events-api/using-socket-mode/`: "if you'd
  like to gracefully restart your app's services, you can use multiple
  connections for temporary active-active redundancy."
- This is THE distinguishing fact. Every other gotcha
  (dedup, filter-own, backfill) is downstream of the fan-out shape;
  fan-out itself is the architectural pivot.

### F3. Dedup contract — `ts` is the message identity, `envelope_id` is the delivery identity

Two distinct ids on a Socket Mode `events_api` envelope:

- **`envelope_id`** — per-delivery UUID. Used ONLY for ack
  (`SocketModeResponse(envelope_id=...)`). Never reused to dedup *across
  listeners* — one envelope = one connection, by definition.
- **`event.ts`** — Slack's canonical message timestamp (`"1730000000.123456"`,
  microsecond precision, monotonic per channel). This is the
  message identity. Two listeners that *somehow* both received the same
  message (e.g. via backfill + live) would see the same `ts`.
- Edits/deletes carry their own `event_ts` plus the original
  message's `ts` inside `event.message.ts` — dedup against the
  *original* `ts` to avoid double-rendering an edited line.

Slack's at-least-once retry policy (3x exponential, then optionally
"Delayed Events" hourly for 24h — see F6) means a single listener can
receive the same `envelope_id` twice if its first ack timed out. So
**dedup keyed on `(channel, ts, event_subtype)` is also load-bearing
for single-machine correctness**, not just multi-machine.

### F4. Filter-own — `bot_id` is broken; `metadata.event_payload` is the escape hatch

`bot_id` matching is the conventional pattern and Bolt's default
`ignoreSelf` middleware. **It does not work for our design.**

- All three devs share `bot_user_id=U0B098LR8EA` (handoff line 21). A
  message Lihu posts and a message Oria posts both arrive at every
  listener with identical `bot_id`. The filter says "ignore self" and
  drops every message — including the ones *meant* for the receiving
  dev.
- Bolt's `ignoreSelf` is even buggier in practice — `bolt-js#580`
  and `bolt-python#946` document cases where it silently fails to
  filter the bot's own DMs because the payload lacks `subtype:
  bot_message`. We can't rely on it.

The right pattern for our shape is **per-message metadata** —
`chat.postMessage` already accepts `metadata={event_type, event_payload}`
(handoff design at line 37 calls this out). The receiver checks
`event["metadata"]["event_payload"]["sender_machine"]` against its own
machine id and drops matches. Properties:

- Arbitrary JSON in `event_payload` works, but Slack restricts:
  - No nested objects (unless a custom Slack-defined type).
  - No arrays of objects/arrays.
  - Flat key→scalar (or scalar arrays) only.
  Source: `docs.slack.dev/messaging/message-metadata/`.
- The receiver sees metadata on the incoming `message` event. Slack
  also fires a parallel `message_metadata_posted` event; we should
  pick one channel-of-events and stick to it (likely just the
  `message` event — `message_metadata_posted` is duplicative).
- For incoming events Bolt-Python already surfaces `event["metadata"]`
  by default; for `conversations.history` reads (backfill path), pass
  `include_all_metadata=true` or the `event_payload` is stripped.

**Recommended `event_payload` fields** (flat per the constraint above):

```
{
  "sender_machine": "lihu-laptop",      # filter-own key
  "sender_kind": "human" | "agent",
  "owner": "lihu" | "oria" | "nitsan",
  "agent_id": "claude-code-session-abc",
  "session_id": "<uuid>",
  "target": "oria" | "*"                # for popup-routing per F7
}
```

This matches the handoff design at line 37 and is consistent with the
flat-only constraint. `sender_kind`/`owner`/`agent_id`/`session_id`
match handoff line 37; `sender_machine` and `target` are mine.

### F5. Backfill on startup — `conversations.history` since checkpoint

No prior art surprises here. Standard pattern:

- Each listener stores a per-channel checkpoint
  `{channel_id: last_seen_ts}` on disk (sqlite or json file under
  `~/.cache/slack-direct/`).
- On startup, for each subscribed channel, call
  `conversations.history(channel=…, oldest=last_seen_ts,
  include_all_metadata=true)` and replay newest-first or
  oldest-first into the local UI.
- Pagination via `response_metadata.next_cursor` — the existing
  `lib/channels.py:140-147` pagination pattern is reusable.
- After replay, save the newest `ts` as the new checkpoint.
- Required scope: `channels:history` (already on the token,
  `experiments/slack-direct/main.py:76`).

Subtleties:

- **Threads**: `conversations.history` returns top-level + first reply
  per thread but NOT all replies. For full backfill of threaded
  conversations, follow up with `conversations.replies` per parent ts.
- **Edits/deletes during offline window**: `conversations.history`
  returns the *current* state (already-edited or skipping deleted),
  so the listener replays the post-edit text without seeing the
  intermediate state. Acceptable for our use.
- **`include_all_metadata=true`** is required to surface the
  `event_payload` we use for filter-own; without it the
  `sender_machine` field never reaches the receiver and the
  filter-own logic on backfill drops nothing.
- **Rate limit**: `conversations.history` is Tier 3 (50+ rpm),
  comfortable for one #dev-pings channel per startup.

### F6. Offline durability — Slack's Delayed Events helps single-listener; not multi-listener

Slack's standard ack contract:

- Default: 3 retries (immediate, +1min, +5min) on missed ack.
- New (2026-02-05): **"Delayed Events"** opt-in extends to **hourly
  retries for 24 hours** after the initial 3 retries. Source:
  `docs.slack.dev/changelog/2026/02/05/retry-events-feature/`.

This rescues a *single* listener that flaps for an hour. **It does NOT
solve the multi-listener offline-durability question** raised in the
handoff (line 96: "Lihu sees Oria's messages even if Lihu's listener
was offline"). Reasoning:

- Slack picks ONE connection for delivery (F2). If Oria's listener is
  online and acks, Slack considers the event delivered. Lihu's
  listener was offline — Slack has no concept of "deliver to Lihu's
  connection too." There's no per-connection retry queue.
- "Delayed Events" only kicks in if **no listener acks**. As long as
  any one of the N connections acks, the rest of the connections
  never replay.

So the offline-durability problem is real and Slack-side mechanisms
don't fix it.

### F7. The popup-routing question is independent of fan-out

Worth flagging because it's easy to conflate: `metadata.target` (handoff
line 38) decides whether the *receiving listener* spawns the tmux popup.
That's a local decision keyed off `event_payload.target == this_owner`.
It's orthogonal to which listener received the event — i.e. it's a
filter, not a routing mechanism. Whatever F2/F8 decides about
delivery, the targeting check is independent.

### F8. Bolt Python Socket Mode handler — relevant defaults

Reading `docs.slack.dev/tools/python-slack-sdk/socket-mode/`:

- `SocketModeClient` does NOT auto-ack. Each registered listener must
  call `client.send_socket_mode_response(SocketModeResponse(envelope_id=...))`.
  An open `slack_sdk#1299` asks for opt-in auto-ack — not yet shipped.
- The slack-bolt wrapper DOES auto-ack at the start of dispatch
  (or after handler return; the SDK's at-least-once contract).
- Default sync client uses Python threads; async variants
  (`aiohttp`/`websockets`) for asyncio shops.
- Auto-reconnect on disconnect is built in to both sync and async
  clients; we shouldn't need to handle the WebSocket lifecycle
  ourselves.
- `apps.connections.open` returns a fresh `wss://` URL valid for one
  session. Slack rotates URLs; the SDK fetches a new one on
  reconnect.

### F9. Existing slack-direct codebase — wire shape

- We already use `slack_sdk.WebClient` (sync). Adding Socket Mode means
  adding `from slack_sdk.socket_mode import SocketModeClient` (or the
  Bolt-Python `App(token=…, app_token=…)` shorthand if we want
  decorator routing).
- Bot token currently bound to a single client at `lib/auth.py`
  load-time. App-level token will need a sibling field on the cached
  bundle (`bundle["app_token"]` next to `bundle["bot_token"]`) and a
  load helper.
- `lib/writes.py:_post_via_slack` currently takes only `channel_id` +
  `text` + `thread_ts`. Adding `metadata=` is a one-line change to
  pass through to `chat_postMessage` — but the spec-stable response
  dict (`_normalize_post_response`) would need a `metadata` key too if
  callers care to read back what they sent.

---

## Bottom — the open ends

### D1. Dilemma: how to get N-of-N delivery on a shared bot — three options

Slack only delivers each event to ONE of the N listeners. The design
needs every listener to see every message. Three concrete options:

- **D1.a — Central coordinator (one Socket Mode listener, fanout
  service).** A single process listens on Socket Mode, parses each
  event, and re-broadcasts to N per-dev local listeners over our own
  transport (HTTP webhook to localhost-tunneled URL, or a tiny pub/sub
  like Redis-on-Railway, or a long-poll endpoint). Pros: matches Slack's
  recommended production shape; backfill happens once, not N times;
  filter-own is per-dev not per-bot. Cons: introduces a central
  service the dev-channel claims to avoid; per-dev listeners need
  stable inbound URLs (back to the HTTP-events problem the handoff
  ruled out for the *Slack-side* reason — but our internal hop has no
  Slack-firewall constraint).
- **D1.b — Per-dev Slack apps (one bot per dev).** Each dev installs a
  separate Slack app with its own bot token + app-level token; the
  three bots all sit in `#dev-pings`. Each dev's Socket Mode listener
  is the only listener for that bot, so fan-out is moot. Pros: clean
  separation, no coordinator, each dev's bot is genuinely "their
  agent's voice." Cons: blows up the OAuth/bootstrap step 3x; the
  channel shows three different APP badges; filter-own becomes
  trivial (`bot_user_id` differs per dev) but at-launch UX gets noisy
  (three install flows).
- **D1.c — Each listener also runs `conversations.history` polling.**
  Treat Socket Mode as a *latency-reduction* layer (fast for the
  listener that wins the lottery) and `conversations.history` polled
  every N seconds as the *correctness* layer (every listener catches
  up via dedup-on-`ts`). Pros: minimal new infra, fits our existing
  `lib/channels.py` shape. Cons: every listener does 60×N
  history-pulls per minute against `conversations.history`; latency
  for non-winners is ~poll-interval; doubles the dedup burden
  (Socket Mode delivery + poll seeing the same `ts`).

I lean **D1.a (central coordinator)** if we can stomach hosting one
process; **D1.c (poll-as-fallback)** if we want to stay strictly
local-and-distributed. **D1.b** is the "we're really committed to
local-only" answer at a UX cost.

This dilemma is z026-shape: it's the architectural fork the spike
needs to resolve before any code is written. Captured as a frictionless
decision-now-or-later, not "explore later."

### D2. Open: offline-durability — Slack-side won't help

If Lihu's machine is closed for an hour, Slack delivers to Oria's or
Nitsan's listener. Lihu's listener never gets those messages from
Slack. Resolution paths:

- Lihu's startup runs `conversations.history` since `last_seen_ts` —
  this is F5, already in the design. **This solves D2.** The
  remaining question is: backfill on startup vs continuous
  catch-up while running? D1.c above implicitly handles both.
- Or D1.a's coordinator persists missed events for offline subscribers
  and replays on reconnect — same role as Slack's Delayed Events but
  per-listener, which Slack doesn't offer.

### D3. Friction — "shared bot" is an honest cost

Path A in the handoff (shared bot + per-message identity override) was
chosen to avoid the OAuth-3x penalty of Path B. But shared bot makes
filter-own architecturally weaker (F4 — `bot_id` is useless, we have
to invent `metadata.sender_machine`) and makes fan-out (F2)
unavoidable. If we end up at D1.a or D1.c anyway, the decision has
non-trivial cost.

Worth a zettel: "Shared-bot vs per-dev-bot: the cost is paid in
filter-own + fan-out, not OAuth flows." (Will capture via
`zettel-capture` if I run another pass.)

### D4. Gap — couldn't read

- The `slackapi/bolt-python` issues #462, #579, #946 were summarized
  via search results, not source-read. The conclusion ("load-balanced,
  not fan-out") is supported by Slack's official docs (the load-bearing
  source) plus user-reports in the issue threads; I didn't read raw
  Bolt source for the Socket Mode dispatcher.
- I did not read the Hubot Slack adapter or any agent integrations
  (Devin/Cursor/OpenHands) that might use Socket Mode. Charter
  asked; gap. None of them are documented as multi-subscriber-on-
  shared-bot, but I can't rule out a clever pattern.
- I did not read source of `slack_sdk.socket_mode.SocketModeClient`
  or `slack_bolt.App` Socket Mode wiring. The auto-ack semantics in
  F8 are docs-stated, not source-verified.

### D5. Test plan to verify F2 against `Effi Spike` (DO NOT RUN — orchestrator's call)

If we want to disprove F2 empirically before committing to D1.a/b/c:

1. Add `connections:write` app-level token to the `Effi Spike` app and
   enable Socket Mode in the app config UI.
2. Open two `slack_sdk.socket_mode.SocketModeClient` connections in
   parallel (same `xapp-…` token, same process or two terminals).
3. Subscribe both to `message.channels`.
4. Post 50 messages from a third terminal via `slack send` to a test
   channel; tag each with a sequence number in the body.
5. Tally how many of the 50 each listener saw. F2 predicts: a
   ~50/50 split with NO message seen by both. Broadcast (ruled out)
   would predict: each listener sees all 50.

A 30-line script. Skipping; orchestrator decides if/when.

---

## Q-summary (charter's 5 questions)

1. **Fan-out semantics** — load-balanced. Each event → ONE of N
   connections, no pattern. (F2)
2. **Auth shape** — app-level token (`xapp-…`) + `connections:write`,
   max 10 concurrent connections per app. Per-machine same token on
   shared bot. (F1)
3. **Dedup contract** — `(channel_id, ts)` is the canonical message
   identity. `envelope_id` is delivery-only and not portable across
   listeners. (F3)
4. **Filter-own** — `bot_id` is broken on shared bot. Use
   `metadata.event_payload.sender_machine` set on `chat.postMessage`,
   read on incoming `message` event (or `include_all_metadata=true`
   on backfill reads). (F4)
5. **Backfill + offline durability** — `conversations.history` since
   per-channel checkpoint solves backfill. Slack's Delayed Events does
   NOT solve multi-listener offline durability — only D1.a/b/c can. (F5,
   F6, D1, D2)
