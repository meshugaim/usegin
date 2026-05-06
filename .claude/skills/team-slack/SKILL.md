---
name: team-slack
description: Use this when an agent needs to read or write the team's Slack via the claude.ai Slack connector — find what was discussed, send a DM, search across channels. Triggered by "search Slack for X", "what's in #effi-dev", "DM Lihu about Y", "post to #...". NOT for: the `dx slack` UseGin shared-bot path (see `use-gin` skill — different attribution model), AskEffi's *product* Slack integration (`nextjs-app`/`python-services` code, not agent tooling), bulk historical analytics across channels (use `dogfooding-effi` synthesis instead).
---

# Team Slack via claude.ai connector

Read and write the AskEffi Slack workspace as the live human via the claude.ai connector. The agent acts under your real identity — no bot wrapper, no `[via …]` prefix.

For the full lifecycle (claude.ai web OAuth → MCP shim → per-session `/mcp` activation → tool surface), see `docs/claude-ai-connectors.md`.

## Workspace and channels worth knowing

- Workspace: `askeffiworkspace.slack.com` (note: NOT `askeffi.slack.com`)

| Channel | What's there |
|---|---|
| `#effi-dev` | Internal eng chatter, dogfooding talk, mid-flight engineering |
| `#all-askeffi` | Everyone-comes-here channel |
| `#client-discovery` | Guy's intake notes after every customer call. Densest source for `team-customers` |
| `#unified-askeffi` | Unified.to integration discussion |
| `#gtm` | GTM channel |
| `#site-inbound` | Inbound site leads |
| `#slacker-log`, `#slacker-alerts` | Oria's slack-effi promotion work |

## Activation check

If the connector tools aren't responding (only `*_authenticate` tools visible), prompt the live human to run `/mcp` in the Claude Code prompt and select "claude.ai Slack". Per-Claude-Code-session — the credential persists at Anthropic but the tool surface re-activates.

## Read

```bash
# Search by content (semantic if phrased as a question)
mcp__claude_ai_Slack__slack_search_public query="what did we decide about <topic> in:#effi-dev"

# Search a specific user's posts
mcp__claude_ai_Slack__slack_search_public query='from:@oria' sort='timestamp'

# Read a channel directly when you have the channel id
mcp__claude_ai_Slack__slack_read_channel channel_id='C0B01M3MJMB'   # #effi-dev
```

Search semantics: phrasing as a **question** activates semantic search (recall-leaning, finds topically-related msgs without exact keywords). Bare keywords fall back to a loose-AND match. Slack search is recency- and author-biased regardless of mode — eyeball relevance, don't trust top-N as a strict filter.

`slack_search_public_and_private` has a built-in consent gate in its tool description ("request user consent"). Default to `_public`; escalate only when the human asks.

## Write

```bash
# DM (use the user_id as channel_id)
mcp__claude_ai_Slack__slack_send_message channel_id='U09P3TPJPJL' message='hey Lihu — ...'

# Channel post
mcp__claude_ai_Slack__slack_send_message channel_id='C0B01M3MJMB' message='...'
```

**Sends go live immediately under your real identity** — no bot wrapper, no `[via …]` prefix. Different shape from `dx slack` (UseGin shared-bot with attribution).

The tool description prescribes `slack_send_message_draft` first when the human hasn't reviewed the message — draft → confirm → send is the safer default for non-trivial sends.

Cannot post to externally shared (Slack Connect) channels — explicit limitation.

## Cross-references

- `use-gin` § "Read / write the team Slack via Gin" — the **`dx slack` shared-bot path** with `[via <human>]` attribution and ENG-id auto-linking
- `dogfooding-effi` — for **synthesizing** across Slack + Gmail + Drive (Effi doesn't index Slack as of 2026-05; coming)
- `team-people` — turn `@U09P3TPJPJL` into "Lihu"
- `team-customers` — for DM'ing or @-mentioning a customer rep

## Not to be confused with

- **`dx slack`** (UseGin shared-bot path, in `use-gin` skill) — different attribution model; live-as-you vs attributed-bot
- **AskEffi's *product* Slack integration** (`nextjs-app/...`, `python-services/...`) — that's product code being built for our customers; not agent tooling
- **`effi-session-audit` skill** — about Effi session JSONLs in Supabase, not Slack at all
