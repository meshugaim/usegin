# Multi-identity-via-one-bot — Slack prior art

Angle owner: Poll
Round: dev-channel-Slack prior-art (Path A vs Path B vs hybrid)
Cwd-bound paths in this doc are absolute. Cited URLs were fetched 2026-04-30.

---

## Top — the click

**Path A (`chat:write.customize`) is the right default for the dev-channel spike, but it carries three real annoyances we will not engineer away — bake them into the UX up front:**

1. The **"APP" badge ships with every message** posted by a bot token, regardless of `username`/`icon_emoji` override. There is no Slack-side toggle to hide it. Visible to humans on desktop and mobile; a permanent reminder that "this is one bot wearing 8 hats."
2. **Mobile push notifications surface the bot identity, not the override.** The push notification title/sender is dictated by Slack's notification stack, not by per-message `username` — so a phone push for a message Oria's agent posted reads as "Effi Spike" not "oria@slack-listener-spike". Fine for non-targeted chatter, **bad** for the targeted-popup path the handoff specifies.
3. **`chat:write.customize` messages are a one-way trip for `chat.delete`.** Slack's `chat.delete` doc explicitly says: *"if a message is sent impersonating another user, you will not be able to call chat.delete to delete that same message."* `chat.update` *is* allowed (and the bot owns the message), so edits are fine — deletions aren't. This bites if we ever want a "redact" UX.

The escape hatch is **Path B (per-dev user OAuth)** for humans only — keep agents on Path A. That gives us a clean **hybrid** where:
- Lihu/Oria/Nitsan post via their own user tokens → no APP badge on human messages, mobile pushes show the actual human, deletes work.
- Agent identities (`oria@slack-listener-spike`, etc.) post via the shared bot token with `chat:write.customize` → one OAuth, N agent identities, APP badge is *correct signaling* for agent posts.

Routing across both halves uses the same `metadata.event_payload` envelope — that's the load-bearing primitive for "which logical sender was this" regardless of token shape.

**Verdict on the scope-list addition:** add `chat:write.customize` (already in the handoff) — it's required, free, and does not affect non-customized posts. No hidden cost. Add `metadata.message:read` if/when we want subscribers to read metadata via Events API; not needed for write.

---

## Middle — the body

### Pattern 1 — Slack `chat:write.customize` (Path A, the default)

The 5-question read:

| Q | Finding |
|---|---|
| **Visual** | Override of `username`, `icon_emoji`, `icon_url` works in client. Override is per-message — pass it on every `chat.postMessage` or it falls back to the app's default profile. **`APP` badge is rendered by Slack regardless of override; not removable.** Sources: [chat.postMessage method](https://docs.slack.dev/reference/methods/chat.postMessage/), [chat:write.customize scope](https://docs.slack.dev/reference/scopes/chat.write.customize/). |
| **Routing** | Slack's official answer is `metadata.event_payload` — pass `{event_type, event_payload}` on `chat.postMessage`; subscribers read it via `conversations.history?include_all_metadata=true` or the `message_metadata_posted` Events API event ([metadata docs](https://docs.slack.dev/messaging/message-metadata/)). Without metadata, you'd be parsing the literal `username` string we set, which is fragile (Slack collapses repeat-sender avatars in threads — see Q5). **Caveat / open ambiguity:** one Slack docs surface says *"message metadata can only be posted or updated using an app-level token"* — this contradicts the `chat.postMessage` reference which accepts `metadata` on bot-token calls. Needs a wire test on our token before we commit to the routing primitive. |
| **Scopes/policy** | `chat:write.customize` requires `chat:write` (already on our token). Bot/legacy-bot token only — not user tokens. **Workspace admins on Enterprise Grid can restrict app installation but I found no Slack-documented policy that specifically blocks `chat:write.customize` on an installed app.** Once installed, the scope just works. Worth re-checking if/when we add a customer's grid workspace. |
| **Mobile/notifications** | **Push notification falls back to the bot's app identity, NOT the per-message `username`.** Slack's notification surface is built off the sender's bot/user identity (so DLP/admin can audit "who was woken"), not the cosmetic override. I could not find an official doc page that states this in one sentence — calling it "judgment, partly evidence" — but it lines up with: (a) the `username` field being explicitly *cosmetic* (`chat:write.customize` description: "send messages **as your Slack app** with a customized username and avatar"), (b) the behavior every Slack-using engineer who's used webhook-per-source has hit. **Recommend a 5-minute live wire probe to confirm before locking the design.** |
| **Limits** | Rate limit: ~1 msg/sec/channel with a workspace-wide cap, special-tier ([rate limits](https://docs.slack.dev/apis/web-api/rate-limits/)). For 3 humans + agents in `#dev-pings`, miles below cap. `chat.delete` blocked on customized messages (see Top, point 3). `chat.update` works fine — re-pass `username`/`icon_emoji` if you want them preserved on edit (the doc on this is silent — I'd test). |

### Pattern 2 — Incoming webhooks, one URL per identity (deprecated path)

The 5-question read:

| Q | Finding |
|---|---|
| **Visual** | **Modern Slack apps' incoming webhooks cannot override channel/username/icon** — those are pinned at app config time. Only **legacy custom integrations** allow per-message `username`/`icon_emoji`, and Slack has been deprecating that path for years. Sources: [Sending messages using incoming webhooks](https://api.slack.com/incoming-webhooks), [Legacy incoming webhooks](https://docs.slack.dev/legacy/legacy-custom-integrations/legacy-custom-integrations-incoming-webhooks/). |
| **Routing** | None — webhooks have no metadata channel. Subscribers see only the literal text + the webhook's pinned identity. |
| **Scopes/policy** | Webhook URLs are bearer-secrets per identity → 8-10 secrets to manage for our 8 agents, with no rotation story. Lihu would have to run an OAuth dance per identity to provision them, in the modern path. |
| **Mobile/notifications** | Same fallback as Pattern 1 — push shows the webhook's bot identity, not any per-message override. |
| **Limits** | Same 1/sec/channel rate limit. |

**Verdict: dead end.** Modern path doesn't support what we need; legacy path is on borrowed time.

### Pattern 3 — Hubot historical `as_user=true` impersonation

Hubot (and other classic bots) used `chat.postMessage(as_user=true)` with a user token to literally post **as** the human. Slack progressively deprecated `as_user` in favor of `chat:write.customize`. The legacy doc still describes it, but it's a no-op for modern bot tokens and the cosmetic override has been folded into `username`/`icon_emoji` + the `chat:write.customize` scope. **Not a path forward.** Source: [chat.postMessage method](https://docs.slack.dev/reference/methods/chat.postMessage/) (`as_user` parameter notes).

### Pattern 4 — Discord webhooks (different platform, same shape)

Discord ships exactly the pattern we want as a first-class primitive: one webhook URL, override `username` + `avatar_url` per message, no APP badge friction. The Discord ecosystem (Statuspage, GitHub, CI bots) routinely uses one webhook for many logical identities and the UX is clean. ([Discord webhooks guide](https://birdie0.github.io/discord-webhooks-guide/structure/avatar_url.html))

**The lesson, not the path** — Slack is more conservative about visual identity-spoofing than Discord, and that's why the APP badge exists at all. We can't import Discord's UX, but the *idea* of "one wire, N identities, identity is a per-message kwarg" is the right shape and Slack does support it via Pattern 1, just with the badge tax.

### Pattern 5 — Mattermost username/icon override

Mattermost ships `enable_post_username_override` + `enable_post_icon_override` as workspace-admin toggles, off by default for security. When on, the override is total — no equivalent of an APP badge. Lesson: the badge is a Slack-specific design choice, not a fundamental property of "shared-bot-as-many-identities." Reinforces: we won't get rid of the APP badge on Slack; engineer the UX around it.

### Pattern 6 — GitHub-Slack integration (mention-mapping)

GitHub's official Slack integration posts as a single bot but resolves `@github-username` mentions to Slack `@user-id` via an OAuth-time mapping the user opts into. **They do not impersonate the GitHub commit author** — they show "GitHub" as sender and put the human's identity in the message body. This is a deliberate choice: the routing/identity signal lives in the *content*, not the sender chrome. Worth considering as a third option (call it Path C — "single sender, identity in content") but rejected by the handoff because the popup-on-`@oria` UX needs the sender field to drive the trigger, not the body.

### Pattern 7 — StatusPage / Datadog / Sentry (production canon)

All three of these post via shared bot or webhook and put logical identity (incident ID, alert source, project) in:
- The **message body** as a header line, AND
- An attachment / block-kit `context` block, AND
- (Datadog) a `metadata.event_payload` for routing

None of them try to spoof a per-incident `username`. They've absorbed the APP-badge friction and moved identity into content. **This is what production canon says.** Our spike is friendlier — three humans and their agents — so I think Path A's badge tax is acceptable for us in a way it wouldn't be for a 1k-channel B2B ticker.

### Concrete payload — what we'd send

Path A `chat.postMessage` body (the agent variant, posting as `oria@slack-listener-spike`):

```python
client.chat_postMessage(
    channel="C0B093XFYB0",                       # #dev-pings
    text="@lihu landing the metadata write — pushing in 5",
    username="oria@slack-listener-spike",        # per-message override
    icon_emoji=":robot_face:",                   # or icon_url for an avatar
    metadata={
        "event_type": "dev_channel_post",
        "event_payload": {
            "sender_kind": "agent",
            "owner": "oria",
            "agent_id": "slack-listener-spike",
            "session_id": "session_…",
            "target": "lihu",                    # for popup-trigger routing
        },
    },
)
```

Subscriber side (Socket Mode listener) reads `metadata.event_payload` from the `message` event and decides: own outbound? Targeted at me? Spawn popup?

---

## Bottom — the open ends

### Dilemma D1 — Path A vs Path B vs hybrid (z026 shape)

- **Decision-pending**: do we keep humans on Path A (shared bot, `chat:write.customize`), or escalate humans to Path B (per-dev user OAuth) while leaving agents on Path A?
- **Evidence in favor of hybrid (Path A for agents, Path B for humans)**:
  - APP badge on every human-spoofed message is real noise; the handoff already flags this as the trigger condition for upgrading.
  - Mobile push notifications: humans pinging humans should wake the right name on the receiver's lock screen.
  - `chat.delete` works on user-token messages → "redact this" UX is open.
- **Evidence against (stay pure Path A)**:
  - Three OAuth dances (Lihu, Oria, Nitsan) instead of one.
  - Per-user tokens create per-user secret management; spike scope creep.
  - Two stacks instead of one (different scopes, different code paths).
- **Lean**: hybrid, but **not on day one of the spike**. Build Path A end-to-end first. Once everyone's used it for ~1 week, decide whether the badge-on-human-messages friction is real or theoretical. Cost of the upgrade later is ~half a day per dev.
- **Cost**: Path A only = 0 added work. Hybrid = +1 OAuth flow, +per-user token storage, +sender-routing branch in CLI ("am I a human → use my user token; am I an agent → use bot token").

### Dilemma D2 — metadata write requires app-level token? (Doc contradiction)

One Slack docs surface (the older `api.slack.com` mirror) says message metadata can only be posted/updated with an **app-level token**. The current `docs.slack.dev/reference/methods/chat.postMessage` and `docs.slack.dev/messaging/message-metadata/` surfaces document `metadata` as a kwarg on bot-token `chat.postMessage` calls without that restriction. **Resolution**: 5-minute live probe — try `chat.postMessage(..., metadata={...})` with our existing bot token. If it 200s, doc is stale; if it errors `metadata_must_use_app_token`, we have a real architectural bend (app-level tokens are workspace-scoped, not channel-scoped — different threat model). **Do this before locking the design.**

### Dilemma D3 — mobile push fallback claim is judgment, not evidence

The "mobile push surfaces the bot identity, not the override" claim above is the most load-bearing finding for the Path A vs hybrid call, and I could not find a Slack doc that states it in one sentence. **Recommend**: spike a single `chat.postMessage` with `username="lihu-test"`, then pull out a phone, look at the lock-screen push, screenshot. 10 minutes. If it shows `lihu-test`, the hybrid case weakens substantially; if it shows `Effi Spike`, the hybrid case is justified.

### Gap — `chat.update` + override behavior unverified

The Slack `chat.update` and `modifying-messages` docs are silent on whether `username`/`icon_emoji` from the original post survive an edit, or whether you must re-pass them. The CLI must handle this regardless (`edit_message` in `/workspaces/test-mvp/experiments/slack-direct/lib/writes.py:241` doesn't currently take override kwargs). **Action**: extend `edit_message` signature when we land the dev-channel spike; live-probe behavior at the same time.

### Gap — enterprise-grid policy on `chat:write.customize`

Could not find a Slack admin doc that says "an admin can disable customize-customization." Reasonable guess: there isn't one (the scope is granted at app install). Real test: the day a customer's enterprise-grid workspace installs us. Not blocking the spike.

### Gap — thread-reply avatar collapse

Slack desktop collapses repeated-sender avatars in dense threads (the "5 messages from the same person merge into one block"). I don't know if `chat:write.customize` overrides defeat this collapse — i.e. if alternating `oria@x` and `lihu@y` posts in a thread render as separate avatar blocks or get visually merged because they're all the same bot underneath. **Speculation, not evidence.** Live-probe in `#effi-dev` with the existing token — 2 minutes.

### Friction zettel candidate (z-capture)

> **Slack APP badge is non-removable on `chat:write.customize` posts.** This is a deliberate Slack platform design — every message a bot token posts ships with `APP` next to the displayed username, regardless of `username`/`icon_emoji` override. Mattermost (toggle-off) and Discord (no badge) chose differently. The badge is the visible cost of "one bot wearing N hats" on Slack and cannot be engineered away within Path A. Implication: the Path-A-vs-Path-B decision is partially aesthetic and partially functional (deletes, mobile pushes), not just OAuth-cost. — Poll, dev-channel-Slack prior-art round.

---

## Sources

- [chat.postMessage method | Slack Developer Docs](https://docs.slack.dev/reference/methods/chat.postMessage/)
- [chat:write.customize scope | Slack Developer Docs](https://docs.slack.dev/reference/scopes/chat.write.customize/)
- [Using message metadata | Slack Developer Docs](https://docs.slack.dev/messaging/message-metadata/)
- [message_metadata_posted event | Slack Developer Docs](https://docs.slack.dev/reference/events/message_metadata_posted/)
- [Rate limits | Slack Developer Docs](https://docs.slack.dev/apis/web-api/rate-limits/)
- [Sending messages using incoming webhooks | Slack](https://api.slack.com/incoming-webhooks)
- [Legacy incoming webhooks | Slack Developer Docs](https://docs.slack.dev/legacy/legacy-custom-integrations/legacy-custom-integrations-incoming-webhooks/)
- [Discord webhooks — avatar_url](https://birdie0.github.io/discord-webhooks-guide/structure/avatar_url.html)
- [Using GitHub in Slack — GitHub Docs](https://docs.github.com/en/integrations/how-tos/slack/use-github-in-slack)
- Local: `/workspaces/test-mvp/experiments/slack-direct/main.py` (current scope list, line 75–85; `chat:write.customize` not yet present)
- Local: `/workspaces/test-mvp/experiments/slack-direct/lib/writes.py:215` (`post_message` doesn't accept `username`/`icon_emoji`/`metadata` kwargs yet — needs widening)
- Local: `/workspaces/test-mvp/.claude/handoffs/handoff_20260430_105055.md` (Path A decision context)
