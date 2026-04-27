# Slack Integration R&D — Resume Pointer

**Status:** in flight as of 2026-04-27
**Skill:** rnd (`.claude/skills/rnd/SKILL.md`)
**Linear parent:** ENG-5399

## What this round is

Compare two Slack-integration paths — **Unified.to (a.k.a. "Unified 2")** vs **direct Slack platform (Bolt SDK / Web API / Events API)** — for three product surfaces:

1. **Customer-facing**: 1 Slack channel ↔ 1 AskEffi project. Channel messages sync into project as data items, indexed for Effi.
2. **UseGin-Slack (internal)**: Slack as the team's task/discussion surface, **mediated by Gin** — humans talk to Gin, Gin reads/writes Slack. Linear-shape, not human-clicks-Slack-UI shape.
3. **AskEffi-Slack (internal)**: AskEffi-Slack integration on the team's own AskEffi tenant — relationship to #1 is a clarification angle (likely it IS #1 dogfooded, not a separate build).

For each path × surface, R&D the tradeoffs, lock-in, time-to-MVP, risks, and bring back a ready-to-spec recommendation.

## Goal output

- 8 angle-whiteboards under `usegin/research/slack-integration/<angle>/whiteboard.md`
- 1 `SYNTHESIS.md` cross-cutting
- 1 `recommendation.md` in z026 shape (decisions for Lihu)
- Linear parent + 8 sub-issues for graph legibility

## Round structure (8 angles)

| # | Folder | Charter focus |
|---|---|---|
| A | `unified-platform/` | What "Unified 2" is in our code; how existing integrations (Fathom etc.) flow through Unified.to; Slack-via-Unified path |
| B | `slack-direct-platform/` | Slack APIs deep-dive: Bolt, Web API, Events API, Socket Mode, OAuth, scopes, rate limits, signing |
| C | `customer-channel-binding/` | UX + data model for 1 channel ↔ 1 project; ingestion, backfill, RLS, lifecycle (rename/archive/delete) |
| D | `usegin-slack-team/` | UseGin-Slack as Gin-mediated team R/W surface, Linear-shape (we don't click Slack — Gin does) |
| E | `askeffi-slack-team-relation/` | Is "AskEffi-Slack for the team" a separate build or just C dogfooded on our tenant? |
| F | `comparative-paths/` | Direct cross-cut: Unified vs direct — build matrix, divergence, lock-in, escape hatch, what build-twice buys |
| G | `risks-failure-modes/` | Slack-platform risks (rate limits, retention, perm creep, app review) + integration-shape risks |
| H | `auth-identity-cardinality/` | Slack-workspace ↔ AskEffi-workspace mapping; per-user OAuth vs bot token; org→workspace migration; Fathom per-recorder analog |

## Resume guide (if power dies / new agent picks up)

1. **Read this file.**
2. **Check folder state**: `ls usegin/research/slack-integration/*/whiteboard.md` — every present whiteboard is done. Missing ones are still in flight or never fired.
3. **Check git log**: `git log --oneline | grep "research(slack"` — committed whiteboards are persisted to origin/main.
4. **Check Linear**: `plan show <parent-id> --tree` once the parent ID is recorded in this file.
5. **Resume options**:
   - **All 8 whiteboards present, no SYNTHESIS.md** → run synthesis. Either spawn an N+1 synthesizer professor (charter: "read all 8 whiteboards, distill cross-cutting findings into SYNTHESIS.md") or do it main-thread.
   - **Some whiteboards missing** → re-read the charter under `usegin/research/slack-integration/<angle>/charter.md`, spawn a fresh Explore sub-agent with that charter.
   - **SYNTHESIS.md present, no recommendation.md** → write `recommendation.md` in z026 shape (Decision needed → Options → Lean → Why → Price → Risk → For you to weigh). Bring to Lihu.
   - **All artifacts present** → close round, write closing zettel, update Linear parent comment with synthesis pointer.
6. **Don't batch commits.** Per `feedback_commits_at_every_change` + `reference_autosync_concurrent_collisions`, commit each whiteboard as it lands.

## Constraints baked into the charters

- Each professor must use `zettel-capture` for friction (z009 friction loop).
- Each professor writes ONLY into its own folder; does NOT commit (orchestrator commits).
- Whiteboard shape: top (the click) / middle (evidence) / bottom (open ends + dilemmas in z026 shape).
- ≤10-line summary returned in chat by each professor.

## Known constraints from memory

- Org→workspace migration in flight — design Slack-integration ownership against **workspace**, not org.
- Fathom per-recorder gotcha: a Slack OAuth = one workspace's bot, **not** team coverage of multiple Slack workspaces. Surface analog risks.
- Email-splitter precedent (ENG-5197): regex-only, no LLM. May or may not apply to Slack message extraction — flag in angle C if relevant.
