# agent↔human Slack bridge — prior art

Angle owner: Poll. Round: dev-channel-Slack prior art.
Charter: map shipped tools that post to and receive from Slack on behalf of human devs working with coding agents. Read against the handoff at `/workspaces/test-mvp/.claude/handoffs/handoff_20260430_105055.md`.

## Top — the click

**Two camps exist; we sit between them, with one genuinely novel piece.**

- **Camp A — cloud-task delegation.** Devin, Cursor, Claude Code in Slack, Continue, GitHub Copilot Coding Agent. `@Bot` mention spawns a remote VM session, work happens in the cloud, status posts back to the thread. Bot posts as itself. User identity comes from per-user OAuth account linkage (Slack email → vendor account). No terminal-side anything.
- **Camp B — local-CLI-listener.** `claude-code-slack-channel` (jeremylongshore, MIT, 16★, v0.8.0, actively shipped), `slack_codex_bot` (M6saw0), `remote-coder` (PeterShin23). One Slack app, Socket Mode, server runs on a dev's laptop, mention triggers the local CLI. The first one is *especially* close to our shape — same scopes, same Socket Mode + `chat:write`, per-thread session isolation, policy-gated tool approvals via Block Kit.
- **The novel slice for us.** The `claude/channel` MCP capability (Anthropic, research preview, Claude Code v2.1.80+, allowlisted plugins only — Telegram/Discord/iMessage/fakechat officially) means Claude Code itself now has a first-class "external event push into a live session" hook. `claude-code-slack-channel` already implements Slack as such a channel — Slack messages arrive in the running terminal session as `<channel>` tags. **That's the auto-inject-into-active-agent-context piece our handoff describes** — and someone shipped it in March 2026.

So the thing the handoff calls out as "auto-inject into the active agent" is **not novel as Slack-into-Claude-Code** — `claude-code-slack-channel` does it. What's still ours:
1. `chat:write.customize` for **per-message human-vs-agent identity overrides** (`<dev>` vs `<dev>@<handle>`). No prior art uses `chat:write.customize` this way — every Camp-A and Camp-B tool posts as itself, even when the human triggered it.
2. **One bot, three humans + N agents on the same workspace, distinguished at message-display level, not just metadata.** `claude-code-slack-channel`'s "multi-agent coordination via `allowBotIds`" still requires *separate Slack apps per agent*; the chat:write.customize move collapses that to one app + display-name overrides.
3. The **tmux-popup-with-two-checkboxes receive UX** — every Camp-B tool injects unconditionally or notifies unconditionally. The "[x] inject into active agent / [ ] copy to clipboard for another session" branch at receive-time is unique.

We should read `claude-code-slack-channel`'s `server.ts` end-to-end before building. It has solved problems we haven't thought about (event dedup, self-echo triple-check on `bot_id`/`bot_profile.app_id`/`user`, tamper-evident audit journal, policy-gated tool approvals).

## Middle — the body

The 5 questions for each row:
1. **Posts on behalf?** Per-user-as-bot, or only as itself?
2. **Receives + auto-injects?** Into active agent context, queued, or notify-only?
3. **Slack scopes** (esp. `chat:write.customize`)?
4. **Identity model** — shared bot + overrides? per-user OAuth? webhook?
5. **How target a specific agent?**

### Camp A — cloud-task delegation

| Tool | (1) on behalf | (2) auto-inject | (3) scopes | (4) identity | (5) targeting |
|---|---|---|---|---|---|
| **Devin** ([docs](https://docs.devin.ai/integrations/slack), [Slack Marketplace](https://slack.com/marketplace/A06A3TU8H39-devin)) | No — posts as @Devin only. Workspace-wide bot avatar/name customizable; no per-message override. | Notify-only. `@Devin` in thread spawns a cloud session; replies in thread route back via thread_ts. | `chat:write`, `channels:history`, `users:read.email`, `files:read.write`, `reactions:write`, `chat:write.customize` *listed* but only for workspace-wide rebrand (not per-msg). | Per-user account linkage by Slack email = Devin email. One bot in workspace. | Thread = session. New thread = new Devin. `!ask` for cheap-mode, `!aside`/`!mute` to gate. |
| **Cursor Background Agents** ([docs](https://cursor.com/docs/integrations/slack), [Marketplace](https://slack.com/marketplace/A08SKDT6QUW-cursor)) | No — single workspace bot. | Notify-only. `@Cursor` spawns sandboxed VM, opens PR, notifies thread. | 20 scopes incl. `app_mentions:read`, `channels:history`, `groups:history`, `chat:write`. `chat:write.customize` not documented. | Per-user OAuth (Cursor account ↔ Slack). One workspace bot. | `@Cursor agent <prompt>` = new agent; `@Cursor <prompt>` in same thread = follow-up to existing agent (only if you own it). Routing rules: explicit repo > recent-activity > custom keyword map > channel default > user default. |
| **Claude Code in Slack** ([docs](https://code.claude.com/docs/en/slack), [Marketplace](https://slack.com/marketplace/A08SF47R6P4)) | No — single bot ("Claude"). | Notify-only. `@Claude` spawns claude.ai/code session in browser; status posts to thread; "View Session" / "Create PR" buttons. | Standard chat scopes; channel-membership-gated (`/invite @Claude`). | Per-user account link in App Home ("Connect your Claude account"). Sessions run on user's plan. **Enterprise Grid only.** | Routing modes: Code-only, Code+Chat (intent classifier). Repo selector dropdown when ambiguous. |
| **GitHub Copilot Coding Agent** ([docs](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/integrate-cloud-agent-with-slack)) | No — posts via "GitHub App for Slack". | Notify-only. `@GitHub` mention spawns Copilot cloud agent; thread context captured into the PR. | Inherits via the GitHub App; uses linked-GitHub-account permissions for actions. | Per-user GitHub linkage. | Thread context = task brief. |
| **Continue Slack Agent** ([docs](https://docs.continue.dev/mission-control/integrations/slack-agent)) | No — `@Continue` bot. | Notify-only. Thread context = full thread; new top-level message = single-message context. | Beta, going through Slack approval. | Per-user GitHub link via Mission Control. | Default-repo selector. |
| **Sourcegraph Cody Slack** ([changelog](https://sourcegraph.com/changelog/releases)) | No — Deep Search bot replies. | Notify-only / Q&A only. Not a coding agent in the cloud-task sense. | Standard. | Site-admin-installed. | Mention. |

### Camp B — local CLI listeners (closest to our shape)

| Tool | (1) on behalf | (2) auto-inject | (3) scopes | (4) identity | (5) targeting |
|---|---|---|---|---|---|
| **claude-code-slack-channel** ([repo](https://github.com/jeremylongshore/claude-code-slack-channel), [gist](https://gist.github.com/jeremylongshore/2bef9c630d4269d2858a666ae75fca53), [Stoneberg writeup](https://stonebergdesign.com/blog/slack-bridge-for-claude-code)) — **read this end-to-end before building** | No — single Slack bot per Claude Code install. Implements MCP `claude/channel` capability. | **YES — into the active Claude Code session via `<channel>` tag injection** (the thing our handoff calls "auto-inject"). Per-thread session isolation. Two-way: bot replies via explicit MCP `reply` tool. | `chat:write`, `channels:history`, `groups:history`, `im:history`, `reactions:write`, `files:read`, `files:write`, `users:read`, app-level `connections:write`. **No `chat:write.customize`.** Bot events: `message.im`, `message.channels`, `message.groups`, `app_mention`. | One bot. Per-user pairing via 6-char DM code → `/slack-channel:access pair <code>`. Allowlist gates by Slack `user_id` (not channel — author explicit: "gating on membership would let anyone in the channel inject messages"). | Each Slack thread = isolated session. `allowBotIds` for cross-bot coordination in a shared channel (separate apps per agent). |
| **slack_codex_bot** ([repo](https://github.com/M6saw0/slack_codex_bot)) | No — single shared bot. | Spawns new `codex exec --full-auto` per mention with thread context as prompt — *not* injection into a running session. | `app_mentions:read`, `chat:write`, `groups:history`. | Single bot, broad GitHub PAT for repo access. | Mention = new Codex run. |
| **remote-coder** ([repo](https://github.com/PeterShin23/remote-coder)) | No — single shared daemon. | Spawns local CLI per Slack message; streams output back. Not in-session injection. | `app_mentions:read`, `channels:history`, `channels:read`, `chat:write`, `message.channels`. | `SLACK_ALLOWED_USER_IDS` allowlist. | Channel ↔ repo mapping. Each thread = isolated session. |
| **pi-agent** ([repo](https://github.com/agentic-dev-io/pi-agent)) | No. Slackbot delegates messages to pi coding agent CLI. | Spawn-per-message. | Standard bot scopes. | Single bot. | Mention. |

### Camp C — historical / adjacent

| Tool | Note |
|---|---|
| **Hubot + ChatGPT forks** ([slackapi/hubot-slack](https://github.com/slackapi/hubot-slack), [pedrorito/ChatGPTSlackBot](https://github.com/pedrorito/ChatGPTSlackBot), [Zeta36/chatgpt-slack-bot](https://github.com/Zeta36/chatgpt-slack-bot)) | The historical pattern: bot listens for `app_mention`, calls LLM, posts reply. Q&A only, no agent loop, no terminal injection. Single bot identity, no `chat:write.customize`. Pre-agent era. |
| **Slack Agentforce / Slackbot 3.0** ([Slack page](https://slack.com/ai-agents)) | Slack-platform-side: Slackbot becomes MCP client, can orchestrate Agentforce + 6000 apps. Vendor-controlled, not a dev-coding bridge. Not our shape. |
| **Anthropic "Claude in Slack" (general)** ([page](https://www.anthropic.com/claude-in-slack)) | Pre-Claude-Code-routing baseline. Same app + Routing Mode toggle in App Home now branches to Claude Code on coding intent. |

### Mapping the handoff design to prior art

| Handoff decision | Prior art match | Novel? |
|---|---|---|
| Single channel `#dev-pings` | Devin, Cursor, claude-code-slack-channel all support multi-channel via opt-in. We're stricter. | No |
| Path A: shared bot + `chat:write.customize` per-message override | **No prior art uses this for agent-vs-human distinction.** Devin lists the scope but for workspace-wide rebrand only. | **Yes** |
| `<dev>` vs `<dev>@<handle>` display format | None | **Yes** |
| `metadata.event_payload {sender_kind, owner, agent_id, session_id}` for routing | claude-code-slack-channel keys on `user_id` + `thread_ts`; no use of `metadata.event_payload`. Slack's `metadata` field is general-purpose; using it for agent routing is uncommon but spec-clean. | Mostly novel |
| Env-var enforcement (`SLACK_DEV_OWNER` mandatory; refuse if `CLAUDE_*` env present but `AGENT_HANDLE` missing) | None — Camp B's allowlist gates on Slack-side `user_id`, not env-side identity. | **Yes** |
| Same `slack send` CLI for humans + agents | Closest: `rockymadden/slack-cli` ([repo](https://github.com/rockymadden/slack-cli)), `shaharia/SlackCLI` — but neither does the human/agent identity branch. | **Yes (the branch)** |
| Targeting via `--to oria` / inline `@oria` parse | Cursor does inline-mention agent-vs-human distinction; we extend to per-dev. | Partial |
| tmux compose popup (sender) | None — typical pattern is `slack send` from terminal direct. | **Yes** |
| Receiver: per-dev local Socket Mode listener, always-on | claude-code-slack-channel: yes, but one process per Claude Code session, not per-dev-always-on. remote-coder: per-machine daemon. | Partial |
| **Receive popup auto-inject into active Claude Code session** | **claude-code-slack-channel does this exactly via `claude/channel`** — and it's the official-blessed path (research preview, allowlisted plugins only currently). | **Mostly not novel** — but our two-checkbox UX (inject vs clipboard) IS novel |
| Two checkboxes `[x] inject into active agent / [ ] copy to clipboard` | None | **Yes** |
| Backfill on listener startup | None document this. | **Yes** |

## Bottom — the open ends

### Dilemmas (z026 shape)

**D1 — Build on top of `claude/channel` MCP, or roll our own listener?**
- Options: (a) implement our dev-pings as a `claude/channel` MCP plugin like `claude-code-slack-channel`. (b) Roll independent Socket-Mode listener as designed.
- Lean: (a). The `<channel>` injection mechanism is the official blessed path for "external event into running Claude Code"; rolling our own means re-solving event dedup, self-echo filtering, prompt-injection defense, session pairing — all of which `claude-code-slack-channel` already shipped.
- Why: less code, official primitive, future-proof against Anthropic's roadmap. The handoff's "auto-inject" requirement IS this primitive.
- Price: `claude/channel` is research-preview, allowlisted-plugins-only — would need to either (i) get on Anthropic's allowlist (unclear path) or (ii) run with `--dangerously-load-development-channels` per dev. The latter is fine in our internal dev tool but blocks productizing later.
- Risk: API churn during research preview — `claude-code-slack-channel` already updated through v0.8.0 in ~6 weeks.

**D2 — One Slack app or three (one per dev)?**
- Options: (a) Single shared `Effi Spike` (or `dev-pings`) app, `chat:write.customize` for identity. (b) Per-dev Slack app, each owns its bot user.
- Lean: (a) — matches handoff Path A, matches Camp B convention, lower OAuth-management overhead.
- Why: handoff is explicit on Path A; the only reason to go (b) is if the `APP` badge in Slack becomes annoying.
- Price: `chat:write.customize` requires user-grant — fine, we already have OAuth control.
- Risk: per-message customization can drift visually (avatar inconsistent across messages); audit-trail noisier.

**D3 — Auto-inject default = on or off?**
- Options: (a) Default on, checkbox to disable (handoff design). (b) Default off, checkbox to enable.
- Lean: (a) per handoff. But: prompt-injection defense is the load-bearing concern (`claude-code-slack-channel` ships a five-layer defense for exactly this reason). The two-checkbox UX MUST not bypass that defense.
- Why: the popup IS the human-in-the-loop step. If the human clicks "inject" they've granted consent.
- Price: a malicious teammate (or compromised account) could nudge the human into auto-injecting. Mitigated by the popup being an *explicit click*, not silent.
- Risk: needs a per-message inject-policy — not "always on", per *this incoming message*.

### Known gaps

- Did not read `claude-code-slack-channel/server.ts` directly — only README, gist, Stoneberg writeup. **Strong recommendation: read the source before designing.** Repo: https://github.com/jeremylongshore/claude-code-slack-channel
- Did not look at OpenHands' Slack integration in depth — `docs.openhands.dev` only mentions Slack as community chat + a one-line "Integrations with Slack, Jira, Linear" in OpenHands Cloud; could not find the technical doc page. Marked `?` on its row above.
- Did not enumerate Slack's full Socket Mode rate limits or the `chat:write.customize` audit/abuse surface — out of charter, but a follow-up Poll for security/scope-justification would be load-bearing.
- The `claude/channel` allowlist policy from Anthropic is unclear — research-preview-only, plugins must be allowlisted. Did not find the application path. Could be a hard blocker on D1 lean (a).
- Did not investigate **cross-machine durability** — handoff flags it as deferred. None of Camp B solves it; Camp A solves it implicitly (state in cloud).

### Friction zettels captured

None this round. The charter was clean and the tools were on the open web.

### Suggested follow-up Polls

1. **Source-deep-dive Poll on `claude-code-slack-channel`** — read `server.ts`, `ACCESS.md`, the policy engine, the five-layer prompt-injection defense, and emit a "what to copy / what to reject" diff against our handoff. This is the single highest-leverage follow-up.
2. **`claude/channel` allowlist + research-preview Poll** — what does it take to get on Anthropic's allowlist? Is `--dangerously-load-development-channels` viable for our internal dev tool indefinitely?
3. **Security scope-justification Poll** — defend `chat:write.customize` to a Slack admin reviewing our app. What's the abuse surface? What's the audit story?

## Sources

- [Devin — Slack docs](https://docs.devin.ai/integrations/slack)
- [Devin — Slack Marketplace listing](https://slack.com/marketplace/A06A3TU8H39-devin)
- [Cursor — Slack docs](https://cursor.com/docs/integrations/slack)
- [Cursor — Slack Marketplace listing](https://slack.com/marketplace/A08SKDT6QUW-cursor)
- [Cursor — Background Agents in Slack changelog](https://cursor.com/changelog/1-1)
- [Claude Code in Slack — official docs](https://code.claude.com/docs/en/slack)
- [Claude in Slack — Anthropic page](https://www.anthropic.com/claude-in-slack)
- [Claude for Slack — Marketplace listing](https://slack.com/marketplace/A08SF47R6P4)
- [GitHub Copilot — Slack integration docs](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/integrate-cloud-agent-with-slack)
- [Continue.dev — Slack agent docs](https://docs.continue.dev/mission-control/integrations/slack-agent)
- [Sourcegraph — releases](https://sourcegraph.com/changelog/releases)
- [OpenHands — docs root](https://docs.openhands.dev/)
- [claude-code-slack-channel — repo](https://github.com/jeremylongshore/claude-code-slack-channel)
- [claude-code-slack-channel — one-pager gist](https://gist.github.com/jeremylongshore/2bef9c630d4269d2858a666ae75fca53)
- [Stoneberg — Slack bridge for Claude Code via Channels MCP](https://stonebergdesign.com/blog/slack-bridge-for-claude-code)
- [allthings.how — Claude Code Channels: external events into a live session](https://allthings.how/claude-code-channels-how-to-push-external-events-into-a-live-session/)
- [slack_codex_bot — repo](https://github.com/M6saw0/slack_codex_bot)
- [remote-coder — repo](https://github.com/PeterShin23/remote-coder)
- [Slack docs — chat:write.customize](https://docs.slack.dev/reference/scopes/chat.write.customize/)
- [Slack docs — Socket Mode (Python)](https://docs.slack.dev/tools/python-slack-sdk/socket-mode/)
- [hubot-slack](https://github.com/slackapi/hubot-slack)
- [pedrorito/ChatGPTSlackBot](https://github.com/pedrorito/ChatGPTSlackBot)
- [rockymadden/slack-cli](https://github.com/rockymadden/slack-cli)
