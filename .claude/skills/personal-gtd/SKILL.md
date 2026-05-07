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
- **GTD-shaped, not GTD-canonical.** The file uses GTD-flavored section names — Inbox / Next Actions / Waiting For / Projects / Someday-Maybe — but their meanings are repurposed for the human↔Claude loop (see "Sections" below). In particular **Inbox is not a generic capture bucket**; the user's real inboxes (Gmail, Slack, Linear) stay where they are. Items carry source citations.
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

### Sections (our shape, not GTD canon)

| Section | Means |
|---|---|
| **Inbox** | Items we haven't clarified yet — need discussion between user and Claude before they can be classified. OK to persist across runs; we don't always have time to clear them in one pass. **Not** a generic capture bucket; the user's real inboxes (Gmail, Slack, Linear) stay where they are. |
| **Next Actions** | Things the user has explicitly committed to do next. User-promoted from **Proposed** (subsection below). |
| **Proposed** (subsection of Next Actions) | Claude-suggested actions, derived from Inbox + Waiting-For. User promotes, dismisses, or steers. |
| **Waiting For** | Blocked on someone else, with who + when sent. |
| **Projects** | Project-level orientation. Top-focus project may be expanded with sub-tracking (in-progress / backlog buckets); other projects stay flat name-only or get dropped if they're not load-bearing. |
| **Someday / Maybe** | Explicitly not-now. |

The skill's conversational triage flows through these: Inbox → discussion → Proposed → user promotes → Next Actions → action taken → deletion. Closure is always user-approved, never automatic.

### Filed tickets stay on the GTD until done-in-production

When `personal-gtd` files a Linear ticket where the user is the doer (or a co-doer), it adds a one-liner breadcrumb to **Next Actions**, not to Waiting For. Filing is not the end of the line — **Definition of Done is "shipped to production, with interested parties updated along the way"**, not "ticket exists in Linear".

The breadcrumb stays alive through file → implement → review → staging → production, and it tracks the comms thread alongside (the original reporter / stakeholders need to know it landed).

**Per-item ask at filing time** — Claude must ask the user, for each new ticket:

1. **How far do we track it?** — Options typically include:
   - **file-only** (low-stakes; track in Linear, not on GTD)
   - **through-merge** (until code lands)
   - **through-staging** (until deployed to staging)
   - **through-production** (until deployed to production — DoD default for user-visible bugs and stakeholder-flagged items)
2. **Updates to interested parties?** — Options typically include:
   - **silent** (no proactive comms)
   - **final-ack** (one message when done)
   - **on-transitions** (ack at staging, ack at production, ack on blockers)
   - **running** (open thread the user steers as they go)

The answers shape: (a) when the breadcrumb auto-clears, (b) what comms drafts the skill proposes during subsequent runs.

**Waiting For is reserved for "blocked on someone else"** — a dispatched-Gin investigation, a teammate's reply, a vendor response. Not "blocked on myself".

```markdown
# Personal GTD — <user>

> Managed by the `personal-gtd` skill (`.claude/skills/personal-gtd/SKILL.md`).
> Don't hand-edit; steer it conversationally via `/personal-gtd`. Hand-edits between runs are honored but may be flagged if unparseable.

last_run: <ISO timestamp>
gmail_account_index: <N>  # only if user has multiple Google accounts; controls /u/N in mail.google.com links

## Inbox
_Items we haven't clarified yet — need discussion between you and Claude before they can be classified. OK to persist across runs._
- <one-line description> — [<source>](<url>) — captured <date>

## Next Actions
_(promoted by you from Proposed below)_

### Proposed (Claude → you — promote, dismiss, or steer)
- <one-line proposal> — [<source>](<url>)

## Waiting For
- <what we're waiting on, from whom> — [<source>](<url>) — sent <date>

## Projects

### ⭐ <Top focus project> (ENG-XXXX) — top focus
- **In Progress**
  - <issue> — <one-liner>
- **Backlog — <bucket>**
  - <issue> — <one-liner>

## Someday / Maybe
- <one-line idea> — captured <date>
```

### Item format

One line per item:

- **Description** — terse, semantic center first ("Reply to Charles re: pricing", not "Charles emailed about pricing on Tuesday").
- **Source citation** — markdown link inline. Multiple sources allowed when an item has a chain (e.g., `[gmail](...) → [linear ENG-5400](...)` for "email that became a ticket").
- **Date** — captured date, or last-touched date for Waiting-For items.

### History model

Mutable file. Append + amend in place. **Git is the history layer** — small commits, push after each meaningful state mutation. The `git log` of the file is the audit trail; the file itself is always the current truth.

Closed items get **deleted** (not archived in-file) once Claude has proposed closure and the user has approved. The deletion shows up in `git log`; if the user wants to reconstruct what closed when, they read the log.

## Boundary — personal-gtd is meta, not work

While running personal-gtd, **Claude does not do the underlying investigative or implementation work**. The skill is for orchestration: it triages, routes, files, drafts, dispatches. Investigation (pulling a JSONL transcript, querying a DB, reading Sentry, debugging a test, writing code) happens elsewhere — in a fresh Wes/agent dispatched from here, in a separate `/fix-bug` session, in a different chat the user opens later.

**Allowed action verbs inside personal-gtd:**
- `file Linear issue` (via `plan create`)
- `draft reply` (Slack DM, Gmail) — never auto-send; show the draft, get approval
- `dispatch agent` (Wes / Explore / fresh-Gin via Agent tool, with a charter)
- `route to skill X` (hand the item to `tikur`, `zettel-capture`, `fix-bug`, etc.)
- `park` (move to Someday/Maybe, or close-and-delete)
- `capture as zettel` (via `zettel-capture`)

**Not allowed inside personal-gtd** (these need a separate session/agent):
- Pulling logs, JSONLs, DB rows, Sentry events
- Running tests, builds, queries
- Editing production code
- Anything in the "Coding vibe" (CLAUDE.md): writing/changing work artifacts beyond the GTD file itself, the new Linear issue body, or the draft reply text.

The GTD file is the only artifact this skill freely edits. Everything else is a *proposal* to the user.

**Hard rules:**
- **Per-item user approval** for every action. Never batch-execute. Never assume approval from a prior similar approval.
- **Concrete proposal, artifact-shaped.** Not "I'll investigate" — name the artifact: "I'll file `bug(scope): <title>` with body X — approve?" or "I'll draft this Slack reply: '<exact text>' — approve?".
- **Action form chosen in real time.** Don't pre-bake a policy ("always leave as draft" or "always send"). Judge per situation, propose, let the user steer. **Connector capabilities differ — know them, don't guess:**
  - **Gmail (`team-gmail`)** — `create_draft` only, no send. Anything you propose lands as a Gmail draft for the user to open + send.
  - **Slack (`team-slack`)** — both `slack_send_message` (sends directly) and `slack_send_message_draft` (lands in Slack drafts). Default to chat-show-the-text → user-approves → `slack_send_message`. Use `_draft` only when the user wants to refine in Slack itself.
- **Don't propose investigation moves, even as escape hatches.** No "want me to pull the rows first?" / "want me to read the JSONL?" / "want me to check Sentry?" — those are work, not meta. The ticket body can *list* investigation seeds for the next agent; the personal-gtd turn doesn't offer to do them. Escape hatches stay meta-shaped: steer the body, change the artifact form, defer, drop.

## Asking the user — context and shape

Without context, "pick A or B" is asking the user to commit blind. **Surface the evidence before asking the question.**

**Practices:**

- **Show, don't summarize.** Before asking "what next?", paste the relevant comms verbatim — the actual email line, the actual Slack message, the actual Linear comment. A snippet is not context.
- **One-click links.** Every cited source gets a markdown link the user can open in a browser to read the full thread. Even when quoting inline. **Respect per-user URL particulars** stored in the state file's preamble — e.g., a user with multiple Google accounts has a `gmail_account_index` so `mail.google.com/mail/u/<N>/...` lands on their actual inbox, not a logged-out tab.
- **Allow "more context" as an option.** When asking AskUserQuestion, the user should always be able to pull more depth: "show me the full thread", "show me the related runs", "show me what the agent did". Don't trap them in a forced multiple-choice.
- **One arc at a time, conversational.** Lead with the evidence + a single concrete proposal. Use AskUserQuestion only when there's a real fork between artifacts (e.g., "file as bug vs. file as chore vs. dispatch fresh-Gin to investigate"). For most asks, plain chat is fine.
- **Fetch first, then ask.** If a thread is short and pullable in seconds (Slack `slack_read_thread`, Linear `plan show`, Gmail `get_thread`), pull it and surface inline before asking. Don't make the user re-read their own email by hand.

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
