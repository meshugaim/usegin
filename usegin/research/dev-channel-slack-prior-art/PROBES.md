# Wire probes — dev-channel Slack design

Live tests against the `Effi Spike` Slack app on the AskEffi workspace.
Run on 2026-04-30. All probes left no residue (test messages auto-deleted).

Scripts live under `probes/`. To rerun, ensure Doppler has
`USEGIN_SLACK_APP_TOKEN` (xapp-...) and `USEGIN_SLACK_BOT_TOKEN`, then:

```
doppler run -- uv run --project experiments/slack-direct \
    python usegin/research/dev-channel-slack-prior-art/probes/<probe>.py
```

## Findings (one-line summary)

| # | Question | Verdict | Design impact |
|---|---|---|---|
| iv | Does Socket Mode load-balance or broadcast across multiple listeners on the same app? | **Load-balanced.** Each event lands on exactly one listener. | Each dev's listener sees only ~1/N of messages; poll-as-correctness layer is mandatory. |
| offline | When NO listener is connected, are events buffered or dropped? | **Dropped.** Reconnect delivers zero gap messages. | Reinforces (iv) — offline windows force a `conversations.history` backfill on startup. |
| i | Does `chat.postMessage(metadata=...)` work with our bot token? Does Socket Mode deliver `event_payload`? | **Yes** to both. Bot token is enough; Socket Mode delivers the full payload inline. | No app-level token needed for posting metadata; receivers route on the inline payload — no extra round-trip. Caveat: `conversations.history` strips `event_payload` unless `include_all_metadata=true`. |
| iii-update | Does `chat.update` preserve username/icon_emoji overrides set on the original post? Does it accept different overrides on update? | **Identity locked at post time.** Update without override: identity persists. Update with a different override: ignored — message stays under the original identity. | No identity drift on edit; but no way to "rewrite history" under a different persona either. |
| iii-delete | Is `chat.delete` blocked on overridden messages? (Handoff suspected yes.) | **No — chat.delete works on overridden messages.** All 4 cases (control, username only, icon only, both) deleted cleanly and were confirmed gone. | Disproves one of the 3 suspected Path A annoyances. Path A is one less annoyance than the handoff thought. |
| bot-self | Does Socket Mode deliver the bot's own messages back to its listeners? | **Yes**, with `bot_id` set to the bot's `B…` id. | Receiver code MUST filter self-echo (matches the 18 cribbable patterns; check `bot_id`, `bot_profile.app_id`, AND `user`). |
| ii (mobile push) | Does mobile push notification show the `username`-overridden identity or the bot's identity? | **Deferred** — needs human's phone for the lock-screen check. Script ready: `probes/probe_ii_mobile_push.py`. | Outstanding. The suspected Path A blocker. |
| Q1 (MCP) | Does stock Claude Code recognize `notifications/claude/channel` MCP messages from the `claude-code-slack-channel` plugin? | **Not run.** Future-upgrade question, low priority. | TBD. |

## Detail per probe

### Probe iv — load-balance vs broadcast

Two passes:

1. **Interactive, N=3, 2 listeners, real human typing.** 3-of-3 messages went to exactly one listener, never both. Initial signal.
2. **Auto-poster, N=20, 3 listeners, bot posting messages to itself.** 20-of-20 messages went to exactly one listener. Distribution: `L1=6, L2=10, L3=4`. Distribution is uneven (Slack appears to have sticky routing within a connection lifecycle), but the invariant holds: every event lands on exactly one connection.

Slack's docs claim this is intended behavior; we've now confirmed it ourselves. With N developers each running a listener against the shared `Effi Spike` app, each dev sees `1/N` of messages on average via Socket Mode alone.

### Probe offline-queueing

When the only connected Socket Mode listener disconnects, then 3 messages are posted into the channel during the gap, then a fresh listener reconnects: **0-of-3** gap messages were delivered to the reconnected listener after an 8s settle.

Slack does not buffer events while no Socket Mode connection is open. (If a Request URL were configured for the app, Slack would deliver via HTTP webhook instead — but we have only Socket Mode.)

**Implication for design:** every receiver must, on startup AND at a regular cadence (e.g. every 15-30s), call `conversations.history` over the relevant channels to fill in any messages it missed. This is the poll-as-correctness layer that `SYNTHESIS.md` D1 lean B prescribes — now confirmed mandatory, not "nice to have".

### Probe i — metadata field

- **Bot token can post messages with `metadata={event_type, event_payload}`.** No app-level token required for posting.
- **Slack persists the metadata.** Confirmed via `conversations.history(include_all_metadata=true)`.
- **Socket Mode delivers the full payload inline.** The `message` event's `metadata` field includes both `event_type` and `event_payload`. No extra API call needed for receiver routing.
- **Caveat:** `conversations.history` returns only `event_type` by default. To get `event_payload` from the history endpoint (used by the poll-as-correctness layer), you must pass `include_all_metadata=true`. Slack docs say this requires the `metadata.message:read` scope; our bot token works without that scope being explicitly listed, suggesting Slack may have made it part of the default app-author capability.

### Probe iii (update) — identity at post-vs-update

| sub-test | post override | update override | identity after update |
|---|---|---|---|
| A | `oria`/`✨` | none | `oria`/`✨` (persists) |
| B | `oria`/`✨` | `oria`/`✨` (same) | `oria`/`✨` |
| C | `oria`/`✨` | `lihu`/`👋` (different) | `oria`/`✨` (update silently ignored the new override) |

Identity is bound at post time. `chat.update` cannot rewrite identity. This is fine for our design (no risk of identity drift after the first append) but means edit history can't reattribute a message under a different persona.

### Probe iii (delete) — does delete work on overridden messages?

| sub-test | post override | chat.delete result | history check |
|---|---|---|---|
| control | none | `ok=True` | gone |
| username only | `oria` | `ok=True` | gone |
| icon_emoji only | `:sparkles:` | `ok=True` | gone |
| username + icon | `claude-on-lihu`/`:robot_face:` | `ok=True` | gone |

The handoff's claim "chat.delete blocked on overridden messages" is wrong. **Delete works.**

### Bot-self events

Probe i's Socket Mode test happened to surface this: when the bot posts a message to a channel its app subscribes to, the resulting `message` event IS delivered back to the bot's own Socket Mode listeners. The event has `bot_id` set to the bot's `B…` id and `user` set to the bot user id.

This means receiver code MUST implement self-echo filtering. The 18 patterns in `READING-claude-code-slack-channel.md` recommend checking three fields: `bot_id`, `bot_profile.app_id`, and `user`. We should lift that pattern verbatim.

## Open

- **Probe ii (mobile push).** Script ready, needs human at phone. ~30 seconds when convenient.
- **Q1 (MCP recognition).** Install `claude-code-slack-channel` plugin, run stock `claude` (without `--dangerously-load-development-channels`), DM the bot, watch for `<channel>` system tag in Claude's context. Determines whether MCP-based injection is a future-available alternative path. Low priority.
- **APP badge visual.** Wasn't probed — visual constraint that Slack documents. Verify by eye on a test message: post one with a username override and look for a small `APP` label next to the name. (Confirmed by Slack docs and many third-party reports; running probes wouldn't add information.)

## Updated decision impact

`SYNTHESIS.md` D1 lean B (poll-as-correctness layer) is no longer a "consider" — it's **required**. Two independent reasons confirmed:

1. Socket Mode load-balances across listeners → each dev sees ~1/N of messages without polling.
2. Slack drops events for windows with no Socket Mode connection → offline gaps would lose messages without a backfill on reconnect.

`SYNTHESIS.md` D6 (Path A "3 annoyances" list) is now **2 annoyances**:

- non-removable `APP` badge — still standing (visual)
- mobile push fallback to bot identity — **still suspected, needs probe ii**
- ~~chat.delete blocked on overridden messages~~ — **disproven by probe iii-delete**
