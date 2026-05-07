---
name: personal-gtd
description: Personal, per-user, stateful "what needs my attention" skill in the GTD shape. Pull-on-demand via /personal-gtd. Loads your prior state, scans communications and work substrates (Gmail, Slack DMs/mentions/team channels, Fathom, Linear, git, Effi dogfooding, optional Claude sessions), computes the delta, surfaces findings to triage conversationally, and takes actions on your behalf with per-item approval. Triggered by "/personal-gtd", "what did I miss", "catch me up on me", "what's waiting on me", or by your own judgment when the live user opens a session and wants to see what moved on their personal substrate. Distinct from morning-brief (read-only dev substrate, stateless).
---

# Personal GTD

Personal, per-user GTD-shaped attention manager. Working name — may change.

Distinct from `morning-brief` (read-only dev substrate, no state, no actions). This skill is **personal**, **stateful**, and **bidirectional** — it can take action on your behalf with per-item approval.

## What it is

- **Personal.** From the live user's point of view. Identity is resolved from the SessionStart `LIVE USER` banner — never from git config, never from auto-memory.
- **Stateful.** A markdown file at `usegin/personal-gtd/<user>.md` holds your open items, decisions, and project list. Subsequent runs read it so the skill doesn't re-prompt you on resolved threads.
- **GTD-shaped.** The file uses the canonical GTD sections: Inbox / Next Actions / Waiting For / Projects (list only) / Someday-Maybe. Items carry source citations.
- **Bidirectional.** Not just a digest — the skill proposes actions (reply, file Linear, capture zettel, etc.), takes them on user approval, and writes the result back to the file.
- **Pull-on-demand.** No cron, no hook. User runs `/personal-gtd` when they want to know what's open.

## When to use

- Opening a work session after >12h away.
- Before a meeting where you want to know what's open with the participants.
- Mid-day reset — what changed since this morning?
- Anytime you want to know what's waiting on you.

Don't use for: project-level synthesis (`dogfooding-effi`), dev-substrate digest (`morning-brief`), a one-off question (just ask).

## The loop

When `/personal-gtd` runs:

1. **Resolve identity.** Read the live user from the SessionStart `LIVE USER` banner. If absent, refuse to run — never guess from git config or auto-memory.
2. **Load state.** Read `usegin/personal-gtd/<user>.md`. If absent → first-run path: ask the user conversationally how far back to scan (e.g., "no state yet — last 7 days, 30 days, since a date?"). Otherwise use `last_run` from the file header as the cutoff.
3. **Scan sources.** In parallel where the tooling allows. For each source, find what's new since the cutoff:
   - **Gmail** (`team-gmail`) — unread + sent-but-unanswered
   - **Slack DMs + @-mentions** (`team-slack`) — direct messages, mentions, threads where the user is participating
   - **Slack team channels** — only when a discussion explicitly tags the user's areas (don't dump every channel post)
   - **Fathom** (`mcp__claude_ai_Fathom__*`) — meetings the user was in, recent first
   - **Linear** (`plan` CLI) — issues assigned to or watched by the user; status/comment changes
   - **git** — commits touching files the user authored or commented on
   - **Effi dogfooding** (`dogfooding-effi`) — Effi reports what changed at project level; Claude uses the user's GTD state as the relevance filter and drills down by asking Effi follow-ups when something looks load-bearing.
   - **Claude sessions** (optional, lower priority) — open-to-empty zettels, in-flight sub-Gins, decisions awaiting user
4. **Compute the delta.** Cross-reference findings against the file:
   - **NEW** — never seen before
   - **UNCHANGED** — already in the file, no movement
   - **RESOLVED** — was open last time, now looks closed (reply landed, issue merged, meeting happened)
   - **NEW MOVEMENT** — was on the list, but new info changes the picture (a "waiting on Dennis" item where Dennis just replied)
5. **Update the file.** New findings land in **Inbox**. Items that look RESOLVED get a **closure proposal** — never auto-deleted; the user must approve. Commit + push (small commits, see Git rhythm below).
6. **Surface to user.** Present the top of the file conversationally — newest + most-actionable first. Don't dump the whole file; show the click and let the user opt into depth.
7. **Triage.** User responds in chat. For each **Inbox** item, clarify conversationally into Next Actions / Waiting For / Project / Someday / ignore. For each **closure proposal**, the user approves or declines. Every state mutation = small commit + push.
8. **Take actions.** When the user wants Claude to act on an item, Claude proposes the concrete action in real time — judging the most fitting form for the situation (leave as Gmail draft / send / file as Linear / capture as zettel / file a tikur / etc.). Wait for explicit per-item approval. Execute. Update the file. Commit + push.
9. **Stop.** No loop. The next run is the user's next `/personal-gtd`.

## State file shape

`usegin/personal-gtd/<user>.md` — committed to the repo. Team-visible by design (matches the team-substrate stance; the team can see *that* you have an open thread with Dennis, not what was said).

**Claude-managed.** The file is written by this skill, not hand-edited. Humans read it; they steer it conversationally during triage. The file itself carries a self-describing preamble (see template below) so any reader — human or future agent — knows the contract. If a human does hand-edit between runs, the skill treats the manual edit as authoritative (the file is the source of truth) but flags items it can't parse.

**What goes in:** one-line item descriptions, source citations (markdown links), tags only where load-bearing, captured/last-touched dates.

**What does NOT go in:** message bodies, draft text, anything the user wouldn't want a teammate reading. Drafts live in Gmail Drafts / transient session state — not this file.

### Sections (GTD canon)

```markdown
# Personal GTD — <user>

> Managed by the `personal-gtd` skill (`.claude/skills/personal-gtd/SKILL.md`).
> Don't hand-edit; steer it conversationally via `/personal-gtd`. Hand-edits between runs are honored but may be flagged if unparseable.

last_run: <ISO timestamp>

## Inbox
- <one-line description> — [<source>](<url>) — captured <date>

## Next Actions
- <one-line action> — [<source>](<url>) — captured <date>

## Waiting For
- <what we're waiting on, from whom> — [<source>](<url>) — sent <date>

## Projects
- <project name>
- <project name>

## Someday / Maybe
- <one-line idea> — captured <date>
```

**Projects is a flat list of project names**, not a drill-down of next actions. The actions for each project live in **Next Actions** (and the connection between them is implicit / loose; tag with `[<project>]` prefix only when ambiguous).

### Item format

One line per item:

- **Description** — terse, semantic center first ("Reply to Charles re: pricing", not "Charles emailed about pricing on Tuesday").
- **Source citation** — markdown link inline. Multiple sources allowed when an item has a chain (e.g., `[gmail](...) → [linear ENG-5400](...)` for "email that became a ticket").
- **Date** — captured date, or last-touched date for Waiting-For items.

### History model

Mutable file. Append + amend in place. **Git is the history layer** — small commits, push after each meaningful state mutation. The `git log` of the file is the audit trail; the file itself is always the current truth.

Closed items get **deleted** (not archived in-file) once Claude has proposed closure and the user has approved. The deletion shows up in `git log`; if the user wants to reconstruct what closed when, they read the log.

## Action scope

Open-ended. Claude can take any action it has tooling for: reply to email (`team-gmail`), reply to Slack (`team-slack`), create/update Linear issues (`plan`), capture a zettel (`zettel-capture`), file a tikur (`tikur`), record a decision (`recording-decisions`), commit and push code, run `dx his`, etc.

**Hard rules:**
- **Per-item user approval** for every action. Never batch-execute. Never assume approval from a prior similar approval.
- **Concrete proposal.** Not "I'll handle it" — name the action: "I'll reply to Guy: '<exact draft>' — approve?"
- **Action form chosen in real time.** Don't pre-bake a policy ("always leave as draft" or "always send"). Judge per situation, propose, let the user steer. The connector limitations factor in (e.g., Gmail connector currently only drafts — say so when proposing).

## Git rhythm

Small commits, push after each. Suggested cadence:

- One commit after the scan + delta lands in the file.
- One commit per accepted action (action taken + file updated).
- One commit per closure-batch (multiple closures approved in one user turn can land in one commit).

Commit messages: `personal-gtd(<user>): <verb> — <one-line summary>`. Verbs: `scan`, `triage`, `act`, `close`. Examples: `personal-gtd(lihu): scan — 4 new in Inbox`, `personal-gtd(lihu): act — replied to Charles re pricing`, `personal-gtd(lihu): close — 3 items resolved`.

Push after each commit (per the team's commit-and-push convention).

## Pitfalls

_To be populated from real usage. Add an entry only when an actual friction surfaces — not from pre-emption._

## Related skills

Skills this one composes with, runs alongside, or hands off to:

- `morning-brief` — parallel sibling. Different surface (dev substrate, not personal comms) and stateless. Both can run at session start without overlap.
- `team-gmail`, `team-slack`, `team-drive`, `team-communication-channels` — the source-surface skills the scan step calls.
- `dogfooding-effi` — Effi as an active project-substrate source; the GTD state filters its diffs to what's user-relevant.
- `parking-question` — different shape: a non-blocking question the user fires mid-work. This skill is its inverse — the user comes asking what's on the world's mind, not parking their own.
- `zettel-capture`, `tikur`, `recording-decisions`, `plan` — common targets when the action step decides "capture this", "post-mortem this", "record the decision", or "file as Linear".
