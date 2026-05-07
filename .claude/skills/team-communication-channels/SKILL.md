---
name: team-communication-channels
description: Meta-skill / decision tree across the team's communication surfaces. Use this when the channel choice is ambiguous — "I want to find/say X, where do I go?". Triggered by "find the discussion about X" or "tell the team Y" without a named channel. Routes to the per-channel skills (`team-slack`, `team-gmail`, `team-drive`, `dogfooding-effi`, `use-gin`). NOT a replacement for those — this skill points; it doesn't act.
---

# Team communication channels

Decision tree across the team's surfaces. Lands here when the channel choice isn't obvious; fans out to per-channel skills.

## Quick routing

| Goal | Skill |
|---|---|
| "Find what was decided/discussed about X" — denseness matters more than channel | `dogfooding-effi` (Effi synthesizes across email + Drive; Slack coming) |
| "Find a specific Slack message / thread / DM" | `team-slack` |
| "Find a specific email thread; draft a reply" | `team-gmail` |
| "Read a Google Doc / Sheet / Slides / PDF (by URL or fileId)" | `team-drive` |
| "Post a status update / decision" — speaking *as* the human | `team-slack` (live as you) |
| "Post a status update / decision" — speaking *as* an agent (with attribution + ENG-ID auto-link) | `use-gin` § Slack (`dx slack` bot path) |
| "Send an outbound email — customer, advisor, etc." | `team-gmail` (draft, you press send) |
| "Auto-sent recurring email" | `team-gmail` § auto-send pipeline (`[auto-send]` body marker) |
| "Who is X / what do we know" — internal | `team-people` |
| "Who is X / what do we know" — external | `team-customers` |
| "Read another teammate's Claude Code session" | `use-gin` § session/code-history |

## Live-as-you vs attributed-bot (Slack)

Two write surfaces, different shapes:

| Surface | Identity | Attribution | Auto-link ENG-IDs |
|---|---|---|---|
| `team-slack` (claude.ai connector) | The live human, real | None | No |
| `use-gin` § `dx slack` | Shared UseGin bot | `[via <human>]` prefix | Yes |

Pick **claude.ai connector** when speaking *as* the human (DM, casual reply, customer-facing). Pick **`dx slack`** when speaking *from* an agent (status post, ENG-id-laden update, attribution for traceability).

## Send-now vs draft-then-press (Gmail)

| Surface | Send semantics |
|---|---|
| `team-gmail` baseline | Agent drafts; human presses send |
| `team-gmail` § auto-send pipeline | Agent drafts with `[auto-send]` body marker; Apps Script ships within ~1 min |

Default to baseline; use auto-send only when the human explicitly asks for it.

## Not to be confused with

- The per-channel skills themselves — this skill *points to* them; doesn't replace them
- `delegating-to-claude-bot` — a different concern (delegation patterns), not channel routing
- AskEffi the *product*'s communication features — this skill is about *our team's* internal surfaces only
