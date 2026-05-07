# Personal GTD — nitsan

> Managed by the `personal-gtd` skill (`.claude/skills/personal-gtd/SKILL.md`).
> Don't hand-edit; steer it conversationally via `/personal-gtd`. Hand-edits between runs are honored but may be flagged if unparseable.

last_run: 2026-05-07T12:30:00Z

## Inbox
_Items we haven't clarified yet — need discussion between you and Claude before they can be classified. OK to persist across runs; we don't always have time to clear them in one pass. Not a generic capture bucket — your real inboxes (Gmail, Slack, Linear) stay where they are._

- Guy's scheduled-updates feedback — reported "10 min after scheduled time, still no email; manual test also nothing" — [gmail thread](https://mail.google.com/mail/u/0/#inbox/19dfe69d103bdb2c) — captured 2026-05-07
- Guy DMs ("let me try" → "nope") — context unclear from snippets, fresh — [slack](https://askeffiworkspace.slack.com/archives/D09N6780Y13/p1778112431719459) — captured 2026-05-07
- Calendar invite: Critical loop / AskEffi — weekly Fri 18:30–19:00 CEST recurring — [gmail](https://mail.google.com/mail/u/0/#inbox/19de5803c5df06b3) — captured 2026-05-01
- "Weekly Status update — Nitsan Edition" Q "Where's the commit data coming from?" — Guy deflected to "ask her", never answered — [gmail](https://mail.google.com/mail/u/0/#inbox/19de0d4a9ce2722c) — captured 2026-05-01

## Next Actions
_(promoted by you from Proposed below)_

### Proposed (Claude → you — promote, dismiss, or steer)
- Reply to Guy on scheduled-updates failure — first check staging logs / sync_worker for the missed fire, then draft. — [gmail](https://mail.google.com/mail/u/0/#inbox/19dfe69d103bdb2c)
- Read full Guy DM thread (D09N6780Y13) to decode "let me try / nope" context — likely related to scheduled-updates testing. — [slack](https://askeffiworkspace.slack.com/archives/D09N6780Y13/p1778112431719459)
- Accept or decline the Critical loop / AskEffi weekly invite (Fri 18:30 CEST). — [gmail](https://mail.google.com/mail/u/0/#inbox/19de5803c5df06b3)
- Dismiss "where's the commit data coming from?" — Guy moved on; not load-bearing.


## Waiting For
- Guy re-testing scheduled-updates after deploy — Nitsan said "Deploying now, check again" 2026-05-06 18:02; Guy replied with new failures 22:11 — Nitsan's turn — [gmail](https://mail.google.com/mail/u/0/#inbox/19dfe69d103bdb2c) — sent 2026-05-06

## Projects

### ⭐ Scheduled Updates / Reports (ENG-5318) — top focus
- **In Progress**
  - ENG-5753 — '< back to config' from report detail loads slowly
- **Backlog — UX polish queue (Guy's feedback batch)**
  - ENG-5811 — flip default to 'Send right away'; collapse Approval/Preview into Advanced
  - ENG-5816 — render markdown in run-content view (replace `<pre>`)
  - ENG-5815 — expose test-fire + manual-fire on report list-row card
  - ENG-5813 — soften delete confirmation / transition
- **Backlog — model/scope work**
  - ENG-5812 — per-report internal/external data scope toggle + clearer copy
  - ENG-5512 — reports as first-class project data items (own tools, Data tab)
  - ENG-5514 — design: report-agent system prompt — what it tells the agent and why
- **Backlog — adjacent surfaces**
  - ENG-5814 — also push report to executive dashboard widget


## Someday / Maybe
- DB cleanup: gfs_sync_item triggers (ENG-5272)
