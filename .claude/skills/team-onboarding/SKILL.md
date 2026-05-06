---
name: team-onboarding
description: Use this when a teammate is new to AskEffi, or when an existing teammate has spun up a fresh devcontainer and needs the claude.ai connectors / Effi / Apps Script wired up. Probe what's already set up, guide them through missing items in order, verify each one. Triggered by "help me onboard", "I'm new to the team", "set me up", "onboard me", "fresh devcontainer setup", or by your own judgment when the live user is hitting auth/connector errors that look like first-time-setup gaps. NOT for: AskEffi *product* user onboarding (a separate customer-facing flow), authoring new agent skills (use `writing-skills`), repo conventions in general (`CLAUDE.md` covers that).
---

# Team onboarding

Walk the live human through the per-person setup for working with the AskEffi monorepo + agent stack. Some items are one-time per claude.ai/Google account; others repeat each fresh devcontainer. **Probe what's done, guide through what's missing, verify.**

## Step 0 — narrow the path

Ask once at the start:

> *"Are you new to AskEffi, or an existing teammate spinning up a fresh devcontainer?"*

- **New teammate** → work the whole list
- **Fresh devcontainer (existing teammate)** → only rows marked *per-container* below

## Checklist (each row: probe → run if missing → verify)

| # | Item | Scope | Probe | If missing |
|---|---|---|---|---|
| 1 | Slack workspace invite — `askeffiworkspace.slack.com` | per-teammate | Ask: do they have a Slack login at askeffiworkspace? | Tell them to ask Lihu/Guy for an invite |
| 2 | `@askeffi.ai` email + Google Workspace seat | per-teammate | Ask | Same — Lihu/Guy provisions |
| 3 | Connect **Slack** to claude.ai | per-claude.ai-account | Call `mcp__claude_ai_Slack__slack_read_user_profile` — succeeds with identity → done | Send them to https://claude.ai/settings/connectors and click "Connect" on Slack |
| 4 | Connect **Gmail** to claude.ai | per-claude.ai-account | Call `mcp__claude_ai_Gmail__list_drafts pageSize=1` — succeeds → done | Same URL, connect Gmail |
| 5 | *(Optional)* Drive / Calendar / Notion to claude.ai | per-claude.ai-account | — | Same URL; only suggest if they ask |
| 6 | *(Optional)* **Apps Script auto-send pipeline** — agent's `[auto-send]`-marked drafts ship within ~1 min instead of sitting in Drafts | per-Google-account | No programmatic probe; ask the human | Walk them through `docs/claude-ai-connectors.md` § Apps Script auto-send (~3 min). Their setup, their Google account |
| 7 | Activate claude.ai connectors **in this session** | **per-container, per-session** | Look at the deferred-tools list — if only `*_authenticate` / `*_complete_authentication` are visible for a service, this step hasn't run for that service this session | Ask them to type `/mcp` in the Claude Code prompt and pick each connector to activate |
| 8 | Bootstrap `dogfooding` Effi profile | **per-container** | `effi --profile dogfooding auth status` — exit 0 → done | Bootstrap per `.claude/skills/dogfooding-effi/SKILL.md` § Bootstrap. **Heads-up — ENG-5777**: pass `--profile dogfooding` on BOTH `auth login` AND `auth verify`, otherwise verify silently creates `<email>:prod` instead. Recovery if it happened: `effi auth rename-profile <email>:prod dogfooding` |
| 9 | `dx identify --as <name>` if SessionStart banner shows wrong human | **per-container, when needed** | Read the LIVE USER banner; mismatch with their actual name? | `dx identify --as <name>` |

## Verification (run after the missing items are fixed)

```bash
effi --profile dogfooding status      # should print: "Project: AskEffi App (really)"
```

In the current Claude Code session, ask the agent (you) to:

- *"Search Slack for recent activity in #effi-dev"* — Slack search returns real messages
- *"Find Guy's most recent email"* — Gmail search returns a thread
- *(if Apps Script set up)* *"Draft and auto-send a hello-world email to me"* — lands in Inbox within ~1 min

Any failure = the broken row, re-do.

## Background reading (point them here, don't paste it)

- `docs/claude-ai-connectors.md` — full claude.ai connector model (the three-stage activation: web OAuth → MCP shim → per-session `/mcp`) + Apps Script auto-send setup, code, and gotchas
- `.claude/skills/dogfooding-effi/SKILL.md` — Effi CLI usage; the `dogfooding` profile is the team's shared name for the AskEffi-on-AskEffi project
- ENG-5777 — open Linear ticket on the `effi auth verify --profile` CLI gap; close-watch in case it lands and the bootstrap step simplifies

## Once they're through

Surface what they unlocked, in plain terms:

- Their Claude Code session can now read the team's Slack & Gmail under their identity (no shared bot, no leakage to teammates' contexts)
- Effi can answer "what did the team decide / discuss / ship around X" via `effi --profile dogfooding ask` — synthesis across emails + Drive
- *(if they did Apps Script)* Their agent can ship outbound emails, not just draft them
- For "who's who" lookups, the family of skills `team-people`, `team-customers`, `team-slack`, `team-gmail`, `team-communication-channels` is now activated for them

## Not to be confused with

- **AskEffi product user onboarding** — separate customer-facing flow inside the product
- **`writing-skills` skill** — about authoring new agent skills, not onboarding to existing tooling
- **`workflow-setup` skill** — interactive *workflow* setup (process), not initial *teammate* setup (this skill)
- **`CLAUDE.md`** — repo conventions in general; this skill is the bootstrap subset
