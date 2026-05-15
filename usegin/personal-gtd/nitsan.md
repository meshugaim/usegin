# Personal GTD — nitsan

> Managed by the `personal-gtd` skill (`.claude/skills/personal-gtd/SKILL.md`).
> Don't hand-edit; steer it conversationally via `/personal-gtd`. Hand-edits between runs are honored but may be flagged if unparseable.

last_run: 2026-05-15T08:30:00Z
gmail_account_index: 2  # nitsan's Gmail is /u/2 in the multi-account URL — use this when minting mail.google.com links

## Inbox
_Items we haven't clarified yet — need discussion between you and Claude before they can be classified. OK to persist across runs._

### 🚨 Time-sensitive
- **Lihu DM (~2h ago) — orphan Google-OAuth verification draft in YOUR Drafts** — [slack](https://askeffiworkspace.slack.com/archives/D09NNHXAKT3/p1778822397538899) — Lihu: "I asked Claude to draft a response… might have done it in YOUR email! Please check… don't send it. I sent from my email." Confirmed: draft `19e29e6b23954dbc` exists in your Drafts ([gmail](https://mail.google.com/mail/u/2/#drafts/19e29e6b23954dbc), written 2026-05-15 04:30Z). Lihu already sent his own reply, so this one is stale. — captured 2026-05-15

### 📬 New since last run
- **Guy: "Effi's priorities"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e2a4d78074393c) — "My work as a product manager is done. Effi prioritized below… P3 can actually be delivered with scheduled updates." Unread, 2026-05-15 06:23Z. — captured 2026-05-15
- **Guy: "Workspace level email requirements"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e249d28290e8d5) — Effi-generated spec for the workspace-email feature. **This is direct movement on the previously-parked "emailing Effi" item below.** Unread, 2026-05-14 03:52Z. — captured 2026-05-15
- **Guy: "Slack (+other) redesign" + 02:33 follow-up** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e27d13817b0f25) — Guy iterated on a Slack/source-channel redesign mock (built on your idea, ran through Claude); your only reply so far is "cool"; he came back at 02:33Z with more depth. — captured 2026-05-15
- **Guy: "Wikis / user inputs"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e28ce814c5d19b) — forward-looking, priority TBD: 4 input scopes (user / project / workspace / role). — captured 2026-05-15
- **Guy: "Using Claude CoWork with Effi"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e2875cf9508526) — feedback from using CoWork: dashboard worked, project query timed Effi out. — captured 2026-05-15
- **Lihu fwd: "Slack Support Data and FedRAMP"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e2602ee3c8395e) — "let me know if you need my help to start the Slack verification process". Unread, 2026-05-14 10:22Z. — captured 2026-05-15
- **Elsante thread: sync-times feedback + your 5-slide deck** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e22a7edaf2a530) — Elsante sent a [loom](https://www.loom.com/share/9385133810d64f6ab1984c6f2c293dbf) (password: 1234); Guy will incorporate to "send to all Internal / External / Both + manual"; you sent a 5-slide deck back. Open thread. — captured 2026-05-15
- **Guy fwd: "Fathom — Update to API List Meetings Endpoint"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e189b30685b1ab) — "not sure if it affects us". Unread, 2026-05-11. — captured 2026-05-15
- **Open Guy thread: xlsx support** — [gmail](https://mail.google.com/mail/u/2/#inbox/19dfff045815bfb0) — Guy: "anything I can tell him other than 'we don't support xls yet?'"; Lihu: "I may have a solution"; Guy: "anything I can communicate?"; you haven't replied. — captured 2026-05-15 (from 2026-05-07)
- **Open Decision-Brief thread you started** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e091aa34fafb7d) — you asked Guy "Do you think in general that reports shouldn't become project canon?"; he replied with thoughts on tuning Effi's context-awareness. Open question. — captured 2026-05-15 (from 2026-05-08)

### 🧠 Mind-sweep (from your 2026-05-15 scratchpad)
- rm slack toggle (likely landed via recent commits — confirm)
- add `files:read` Slack scope
- Elsante feedback — helpers for adding internal / external members / workspace members w access
- Slack self-invite — scope question; need it to still work w/o it
- Access-level ↔ recipients-canon-classification correlation (external recipients → save report as external)
- Staging Slack app — re-do with new scopes
- VAIS pipeline for Slack
- Experiment w/ Excel — what does "we support excel" mean? (cross-refs Guy's xlsx thread above)
- Claude upgrade
- Open Claude Code issues status
- Claude design — what's that?

## Next Actions
_Filed tickets stay here until done-in-prod (DoD). Each carries `track:<depth>` and `comms:<cadence>` so future runs know what to surface and what to draft._

_(empty — see closure proposals below)_

### Closure proposals (Claude → you — approve, decline, or steer)
- **ENG-5838** (Loose-ends silent fire) — Linear `Done`. Tracking was `through-production` + `comms:Guy on-solve + on-deploy`. Confirm: shipped to prod? Guy notified? — proposed 2026-05-15
- **ENG-5839** (remove email frame wrapper) — Linear `Done`. Tracking was `through-production` + `comms:Guy final-ack`. Confirm: shipped to prod? Guy acked? — proposed 2026-05-15

### Proposed (Claude → you — promote, dismiss, or steer)
- **Discard stale Google-OAuth verification draft** (id `19e29e6b23954dbc`) — Lihu sent his own reply already; yours is stale. Action: I'll delete the draft on your approval.
- **Reply to Guy's xlsx question** — week-old thread, Lihu offered "I may have a solution"; Guy explicitly asked "anything I can communicate?". Draft a one-liner to unblock Guy?
- **File "workspace-email feature — spec'd"** as a Linear issue, parented under ENG-5318 or as a new spec — Guy's "Workspace level email requirements" email contains an Effi-generated spec; this is the trigger to un-park the "emailing Effi" item from Someday.
- **File "Slack design polish — from Guy's redesign mock"** as a Linear issue — Guy's 5/14 + 5/15 02:33 emails contain concrete UX iteration on the work that just landed; file before it loses context.
- **Mind-sweep → Linear** for the recent scratchpad items (Slack scope work, Elsante helpers, VAIS for Slack, xlsx experiment) — surface each one-by-one if you want me to file them.

## Waiting For
_(empty)_

## Projects

### ⭐ Top focus — open question
The 2026-05-15 mind-sweep is heavily Slack-shaped (scopes, self-invite, staging redo, VAIS, marketplace). Scheduled-reports (ENG-5318) is still in-progress but the last 2 days of commits are roughly half-and-half Slack-UX + scheduled-reports follow-ups. Worth deciding whether top focus shifts from scheduled-reports → Slack integration for the next stretch.

Other in-progress Linear (no recent movement attributed to you here):
- ENG-6010 — design-audit sweep
- ENG-5938 — dependency sweep
- ENG-5318 — scheduled reports (parent of recent fixes)
- ENG-5272 — gfs_sync_item triggers
- ENG-5019 — chat streaming richer events
- ENG-5010 — tool ID truncation bug

## Someday / Maybe
- DB cleanup: gfs_sync_item triggers (ENG-5272)
- **"emailing Effi" feature** — Guy's [requirements doc](https://docs.google.com/document/d/1RFGyLNLnIWppzHsNQi5EN-Gw0hWJnaEX8BdbT8LJMKw/edit?tab=t.0#heading=h.75bfx7nnm76u). **Movement 2026-05-14**: Guy sent an Effi-generated workspace-level email-requirements spec — see Inbox. Consider promoting.
- **Calendar-prep idea** — "if we integrate with a calendar, Effi could send prep notes before meetings" — [#product](https://askeffiworkspace.slack.com/archives/C09QZ570RAA/p1778068878579729) — captured 2026-05-06.

## Dropped
_Items you explicitly declined to track. Future scans skip matches. Re-raise only on materially different signal (e.g., Sentry issue resurfaces after long silence with much higher rate)._
- `sentry:PYTHON-FASTAPI-N7` — scheduled_report_runs CHECK violation; folded into ENG-5838 territory, not a separate item — dropped 2026-05-07
- `sentry:PYTHON-FASTAPI-NB` — sharepoint VAIS sync 404; not your surface — dropped 2026-05-07
- `class:sentry-storm/JSON-could-not-be-generated` — May 1-5 cluster (PYTHON-FASTAPI-MW, N0–N5) on `_delete_document_api_call` / `_finalize_disconnecting_connections` / `_cleanup_timed_out_deleting_items` — upstream-transient class, don't raise per-occurrence — dropped 2026-05-07
- `class:calendar-nudge/critical-loop-recurring` — already-accepted recurring meeting (Fri 18:30 CEST), don't surface as a heads-up each run — dropped 2026-05-07
