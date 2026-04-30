# Terminal/tmux ↔ Slack — prior art

Angle: **terminal-native Slack tooling**. What it does, what API path, what UX, what's alive.

## Top — the click

**There is no prior art for our two-popup tmux-native dev-channel UX.** The terminal-Slack space splits cleanly into three buckets, and **none of them does what we're designing**:

1. **TUIs** (slack-term, wee-slack, slack-tui*) — full-screen IRC-style chat clients. Live in their own window, replace your terminal. Architecturally **RTM-era and decaying** (slack-term last release 2020, uses deprecated RTM). wee-slack is the only alive one, but it's a WeeChat plugin — no fit for in-terminal/tmux popup model.
2. **Send-only CLIs** (rockymadden/slack-cli, slacktee) — pipe-to-Slack utilities. No receive path. Bash + webhook/token. Send is solved trivially; we already match this with `slack send`.
3. **Agent bridges** (aisandler/claude-slack-bridge, oh1701/codex-slack-auto-bridge) — the **closest cousins**, built 2026, for Claude Code / Codex respectively. Socket Mode + Bolt + Agent SDK. **They route Slack → SDK subprocess and reply Slack-side**; the human at the terminal sees nothing locally. **No tmux popup. No human reply UX. Single-bot, single-user, single-channel-per-session.**

The two-popup design (compose-popup keybind + auto-spawn receive-popup with inject/clipboard checkboxes) and the dual-target identity model (`<dev>` vs `<dev>@<handle>` with `metadata.event_payload` routing) are **net-new ground**. We are building, not gluing.

Reusable cribs: **claude-slack-bridge's manifest** (exact bot scopes + Socket Mode + event subscriptions for the dev-channel app), **codex-slack-auto-bridge's shell-hook auto-start pattern** (codex/claude wrapper boots the listener), wee-slack's WebSocket reconnect/backfill discipline. **Don't crib**: anything RTM-flavored, anything that owns a full-screen UI, anything that assumes single-user.

## Middle — the body

Survey: **15 tools** across TUIs, CLIs, bridges, gateways, notifiers. 5-question read on each (send / receive / UX / liveness / crib).

### Bucket A — TUIs (full-screen chat replacements)

| Tool | Send | Receive | UX | Liveness | Crib |
|---|---|---|---|---|---|
| **jpbruinsslot/slack-term** ([repo](https://github.com/jpbruinsslot/slack-term), 6.6k★) | RTM `chat.postMessage` via legacy/user token | **RTM WebSocket** (`MessageEvent` loop), confirmed in `service/slack.go` | Full-screen Go termui — channel pane + msg pane + input | **Decaying.** Last release v0.5.0 **2020-03-14**. Last commit 2024-04. RTM is deprecated by Slack for new apps — new tokens can't even open RTM connections in many workspace tiers. 68 open issues. | Don't build on RTM. Don't build a TUI. |
| **wee-slack/wee-slack** ([repo](https://github.com/wee-slack/wee-slack), 2.6k★) | OAuth bot/user token via Slack Web API | **Persistent WebSocket via `rtm.connect`** — but uses the *internal* `wss-primary.slack.com` endpoint with session cookies (Path B in our design). Code: `slack/slack_workspace.py` — `await self.api.fetch_rtm_connect()` | WeeChat plugin, IRC-style buffer per channel, threads as nested buffers | **Alive.** v2.11.0 **2024-10-09**, nightly tag 2024-02. 2356 commits. Python rewrite shipped. | Backfill-on-connect discipline, threads-as-buffers thinking, session-token escape-hatch awareness (the "OAuth has Free-tier 10-app limit" gotcha). |
| **bmalbusca/slack-tui** ([repo](https://github.com/bmalbusca/slack-tui), 10★) | Web API with `chat:write` | Polled `conversations.history` via `--show` (no realtime) | "Simple CLI, no TUI" despite name — flag-driven (`--send`, `--show`, `--vip`) | **Alive but tiny.** v1.0 2026-02-09. 4 commits. | Minimal-scope discipline (`channels:read`, `channels:history`, `users:read`, `chat:write`) for read-mostly tools. Confirms our scope set is in the right ballpark. |
| Mange/slack-tui, janza/tight, NotShrirang/slack-tui, EonHermes/terminal-chat-client | various | various | Textual / Rust / Python TUIs | All <5★, mostly hobby. NotShrirang adds Claude for "AI-assisted message drafting" — orthogonal direction (compose-help, not routing). | Nothing load-bearing. |

### Bucket B — Send-only CLIs (pipe-to-Slack)

| Tool | Send | Receive | UX | Liveness | Crib |
|---|---|---|---|---|---|
| **rockymadden/slack-cli** ([repo](https://github.com/rockymadden/slack-cli), 1.1k★) | Token (legacy or bot) → Slack Web API. Pure bash + jq. | **Metadata-read only** (file list, reminder info, snooze status). **No live receive.** | Subcommand bash CLI — `slack chat send`, `slack file upload`, etc. | **Stale.** Last commit **2023-02-05**. 38 open issues. | Pipe-friendly subcommand grammar. Our `slack_cli.py` already follows this shape. |
| **course-hero/slacktee** ([repo](https://github.com/course-hero/slacktee), 828★) | Bot token (`chat:write`, `chat:write:public`, `files:write`) OR incoming webhook. `tee`-style stdin pipe. | None — strictly unidirectional. | `cmd \| slacktee.sh` — buffered or `-n` line-by-line or `--streaming`. | **Stale.** Last commit **2023-03-24**. 11 open issues. | The `--streaming` pattern (one Slack message, edits-as-you-go) is interesting for agent long-output cases. Not for our dev-pings UX (those are atomic). |
| **slackapi/slack-cli** ([repo](https://github.com/slackapi/slack-cli), 221★) | App-dev only — no user-facing send/receive. | N/A | Manage/deploy Slack apps from CLI. | **Alive.** Last push 2026-04-30. | Useful for *managing* the dev-channel app (deploy manifest, manage tokens) — orthogonal to runtime UX. |
| lba-studio/n-cli, nareshnavinash/shelldone | Webhook | None | "ping after long command" notifiers | Niche, tiny. | The "AI CLI hooks" framing in shelldone (Claude Code, Codex, Gemini, Copilot, Cursor) confirms the *use case* is now mainstream — multiple projects converging on "agent finished, ping me on Slack". |

### Bucket C — Agent ↔ Slack bridges (the close cousins)

| Tool | Send | Receive | UX | Liveness | Crib |
|---|---|---|---|---|---|
| **aisandler/claude-slack-bridge** ([repo](https://github.com/aisandler/claude-slack-bridge)) | `@slack/bolt` v4 + Bot token (`chat:write`) | **Socket Mode** via Bolt App `socketMode: true`. Bot scopes: `app_mentions:read`, `channels:history`, `channels:read`, `chat:write`, `groups:history`, `groups:read`, `im:history`, `im:write`, `mpim:history`, `reactions:write`. Events: `app_mention`, `message.channels`, `message.groups`, `message.im`, `message.mpim`. App-level token with `connections:write`. | **Slack-only.** No tmux, no terminal UI. `npm start` boots a long-lived process. Human at the terminal sees nothing locally. Replies appear in Slack threads. `!cancel`/`!reset` are inline Slack commands. | **Alive but new.** Last push 2026-04-25. 0 stars, 7 commits. TypeScript. | **The manifest is gold** — `slack-app-manifest.yaml` is exactly the scope+events shape we need for the dev-channel app. Also: `.sessions.json` per-channel-id session map (resume by channel), busy-queue per channel, `bypassPermissions` + safe-mode disallowed-tools (`Bash`, `Edit`, `Write`, `NotebookEdit`, `KillBash`) toggle pattern. **Don't crib**: Slack-side-only UX (we want both sides), single-instance-per-workspace identity model (we want per-dev). |
| **oh1701/codex-slack-auto-bridge** ([repo](https://github.com/oh1701/codex-slack-auto-bridge)) | `slack_sdk.web.WebClient` post via Bot token | **Socket Mode** via `slack_sdk.socket_mode.SocketModeClient`. Bot scopes (inferred from manifest pattern): `app_mentions:read`, `chat:write`, history scopes. App-level token `xapp-...` with `connections:write`. | **Slack-only.** Codex CLI is invoked via `subprocess.run` with `--codex-cd <dir>`, output captured and posted back to Slack thread. Channel filtering + mention-only mode in channels (DMs unrestricted). | **Alive, niche.** Last push 2026-02-25. 2 stars. Python 3.11+. | **The shell-hook auto-start pattern** — `install-shell-hook.sh` makes `codex`/`codex resume` boot the bridge in background. Same shape works for our `claude` shell wrapper: launching Claude in a dev shell auto-starts the per-dev Socket Mode listener. Also: `MAX_CODEX_CONCURRENCY = 2` — semaphore on subprocess spawns. **Don't crib**: subprocess-per-message is wrong for our model (we inject into the *active* agent context, not spawn fresh ones). |

### Bucket D — IRC bridges (historical pattern reference)

| Tool | Architecture | Liveness | Why we care |
|---|---|---|---|
| **42wim/matterircd** ([repo](https://github.com/42wim/matterircd), 303★) | Local IRC server that proxies to Slack (or Mattermost) — connect any IRC client (irssi, weechat, mIRC) to it | Last push 2024-09-18 — slowing. | Inversion-of-control idea: instead of one TUI per chat platform, expose a stable local protocol and let users bring their own client. **Not for us** (we want Slack-aware tooling, not IRC) — but worth knowing the pattern existed. |
| **insomniacslk/irc-slack** ([repo](https://github.com/insomniacslk/irc-slack), 207★) | Same idea — IRC-to-Slack gateway, daemon on localhost. | Alive — last push 2026-04-27. | Same comment. The IRC-bridge subculture is the historical origin of "I want Slack but in my terminal" — they all hit the RTM cliff in 2022 and shifted to user-tokens or session cookies (wee-slack pattern). |
| **slackapi (legacy)** XMPP/IRC gateway | Slack used to ship a first-party IRC/XMPP gateway. **Killed 2018.** | Dead. | Reference only. Slack's stance: terminal-native is not officially supported. |

### Bucket E — Adjacent: notification bridges

| Tool | Pattern | Crib |
|---|---|---|
| **wonjun3991/iterm-notification** | macOS native notif → click → focus iTerm tab | iTerm-side, not us, but the click-to-focus contract is the right shape for "Slack ping → focus tmux pane". |
| **mifkata/iterm2-focus** | macOS app for focusing specific iTerm window/tab/pane via URL scheme | Same pattern — for tmux we'd use `tmux switch-client` + `select-pane` from the listener. Worth designing into the receive-popup flow if Lihu's outside the agent pane when ping arrives. |
| dunst / notify-send rules | desktop-notif daemons can route by app | We bypass; tmux popup is the notif. |

## Bottom — the open ends

### Dilemmas (z026 shape)

**D1 — TUI temptation.** wee-slack proves a maintainable Slack-in-terminal client is buildable; ~14 ksLoC of Python over 5 years. **The pull**: build a real TUI for `#dev-pings`, show channel state, scrollback, threads. **The fork**: that's a different product. Our locked design says "no full-screen UI; tmux popups only". Holding the line keeps scope tight; the cost is no scrollback UX without falling back to `slack messages` text-mode commands.

**D2 — Single-bot vs per-dev tokens.** All agent bridges (claude-slack-bridge, codex-slack-auto-bridge) use **single-bot, single-instance**. Our design uses **single-bot Path A** (shared bot, per-message `chat:write.customize` username override). The bridges' single-instance model collapses identity to "the bridge user" — fine for solo, broken for our 3-dev setup. **The pull**: per-dev OAuth (Path B) — each dev's listener uses their own user token, identity is real. **The fork**: 3× OAuth dance, 3× free-tier app-slot pressure (wee-slack's known pain), and `chat:write.customize` is bot-only — Path A users get the `APP` badge whether they like it or not. Decision deferred (handoff line 96); no prior art biases it either way.

**D3 — Inject-into-active-agent vs spawn-fresh.** claude-slack-bridge spawns a fresh `query()` per turn (with session resume). Our design **injects into the human's active Claude Code session** via tmux popup checkbox. **The pull**: spawning is cleaner — no race with whatever the agent is doing, no popup. **The fork**: that's a different product (Slack-driven agent, not an in-terminal communication channel). The popup-injection pattern (mirror of `parking-question`'s `!question` banner — handoff line 81) is intentional: we want the human-or-agent to *choose* to read the message, mid-flow.

**D4 — Cross-machine durability.** Already flagged in handoff line 96 as deferred. **No prior art helps.** All terminal bridges are local-listener-only; if Lihu's listener is offline, the message just sits in Slack. We'd need a server-side daemon (or just lean on Slack's own message persistence — read-on-startup backfill, which is already in the design).

### Gaps in this survey

- **Did not deep-read** wee-slack's threading code (could inform our reply UX in the receive popup if we ever want to thread).
- **Did not test** any tool live — all from README + targeted source reads. claude-slack-bridge could be cloned and run against `Effi Spike` in 30min if we want to confirm scopes/manifest match what we'd ship.
- **No data on Slack's app-tier limits** for Socket Mode (rate limits, connection limits per app). Worth probing before the first prod-tier app gets created. Slack docs claim "Socket Mode is suitable for production" but tier-tier specifics are sparse.
- **Did not survey** Mattermost / Discord terminal tooling deliberately — out of scope, but the patterns rhyme. matterircd is the only crossover.
- **WeeChat-as-platform** angle uninvestigated. If we ever wanted a "real" chat surface beyond `#dev-pings`, wee-slack inside WeeChat-in-tmux is the only mature option.

### Friction zettels

None captured this round — charter was clear, no uninterpretable constraints. Two minor friction notes worth the team:

- The official `slackapi/slack-cli` has nothing for end-user terminal UX. Anyone Googling "slack cli" hits this first and gets confused; we should keep our own CLI's name distinct (it already is — `slack` as a command lives in our `experiments/slack-direct/` not as a global binary).
- The agent-bridge cluster (claude-slack-bridge, codex-slack-auto-bridge, shelldone, claude-slack-bridge knowledge-miner) is **all built in 2026 Q1**. The pattern is converging in real time. Worth a 30-day re-survey before we ship — there's a ~30% chance someone publishes a tmux-native variant before us.

### Adjacent surfaces that surfaced

- **`@anthropic-ai/claude-agent-sdk`** (used by claude-slack-bridge) — confirms the SDK's `query()`/`session_id`/`abortController` shape works cleanly with Slack-side `!cancel` / `!reset` commands. Reusable if we ever need a Slack-driven agent path next to the in-terminal one.
- **Bolt v4 default-export quirk** (commented in `bridge.ts:5-7`) — `import { App } from "@slack/bolt"` works at runtime, default-import doesn't. Worth a memory note when we adopt Bolt for our listener (we're currently slack_sdk-only).
- **Manifest-as-code** (`slack-app-manifest.yaml`) — Slack supports declarative app manifests. Our `Effi Spike` app was clicked-together; for the dedicated dev-tool app, ship the manifest as a file in the repo so re-creation is one CLI call, not 20 dashboard clicks.

## Sources

- [aisandler/claude-slack-bridge](https://github.com/aisandler/claude-slack-bridge) — manifest at `slack-app-manifest.yaml`, bridge at `src/bridge.ts`
- [oh1701/codex-slack-auto-bridge](https://github.com/oh1701/codex-slack-auto-bridge) — `scripts/slack_codex_bridge.py`, shell-hook installer
- [jpbruinsslot/slack-term](https://github.com/jpbruinsslot/slack-term) — RTM confirmed in `service/slack.go`
- [wee-slack/wee-slack](https://github.com/wee-slack/wee-slack) — WebSocket loop in `slack/slack_workspace.py`
- [rockymadden/slack-cli](https://github.com/rockymadden/slack-cli)
- [course-hero/slacktee](https://github.com/course-hero/slacktee)
- [slackapi/slack-cli](https://github.com/slackapi/slack-cli)
- [bmalbusca/slack-tui](https://github.com/bmalbusca/slack-tui)
- [42wim/matterircd](https://github.com/42wim/matterircd), [insomniacslk/irc-slack](https://github.com/insomniacslk/irc-slack)
- [wonjun3991/iterm-notification](https://github.com/wonjun3991/iterm-notification), [mifkata/iterm2-focus](https://github.com/mifkata/iterm2-focus)
- [nareshnavinash/shelldone](https://github.com/nareshnavinash/shelldone)
