# Personal GTD — nitsan

> Managed by the `personal-gtd` skill (`.claude/skills/personal-gtd/SKILL.md`).
> Don't hand-edit; steer it conversationally via `/personal-gtd`. Hand-edits between runs are honored but may be flagged if unparseable.

last_run: 2026-05-15T12:00:00Z
gmail_account_index: 2  # nitsan's Gmail is /u/2 in the multi-account URL — use this when minting mail.google.com links

## Inbox
_Items we haven't clarified yet — need discussion between you and Claude before they can be classified. OK to persist across runs._

### 🚨 Time-sensitive
- **Stale Google-OAuth verification draft in your Gmail Drafts** — [slack DM from Lihu 2026-05-15 07:19Z](https://askeffiworkspace.slack.com/archives/D09NNHXAKT3/p1778822397538899) · draft `19e29e6b23954dbc` ([open + discard](https://mail.google.com/mail/u/2/#drafts/19e29e6b23954dbc)). Lihu's own reply already sent; the Gmail connector can't delete drafts, so this is a one-click for you. — captured 2026-05-15

### 📬 New since last scan (Gmail)
- **Guy: "Effi's priorities"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e2a4d78074393c) — "My work as a product manager is done. Effi prioritized below… P3 can actually be delivered with scheduled updates." Unread, 2026-05-15 06:23Z.
- **Guy: "Workspace level email requirements"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e249d28290e8d5) — Effi-generated workspace-level email spec. **Direct movement on the parked "emailing Effi" Someday item.** Unread, 2026-05-14 03:52Z.
- **Guy: "Slack (+other) redesign" + 02:33 follow-up** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e27d13817b0f25) — Guy iterated on a Slack/source-channel mock; your only reply: "cool"; he came back 7h later with a port to the email surface.
- **Guy: "Wikis / user inputs"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e28ce814c5d19b) — forward-looking, priority TBD: 4 input scopes (user / project / workspace / role).
- **Guy: "Using Claude CoWork with Effi"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e2875cf9508526) — feedback from CoWork dogfooding; demo dashboard worked, real-project query timed Effi out.
- **Lihu fwd: "Slack Support Data and FedRAMP"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e2602ee3c8395e) — "let me know if you need my help to start the Slack verification process". Unread.
- **Elsante thread: sync-times feedback + your 5-slide deck** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e22a7edaf2a530) — [loom](https://www.loom.com/share/9385133810d64f6ab1984c6f2c293dbf) (pwd 1234); Guy will simplify to "Internal/External/Both + manual"; you sent a 5-slide deck. Open thread.
- **Guy fwd: "Fathom — Update to API List Meetings Endpoint"** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e189b30685b1ab) — "not sure if it affects us". Unread, 2026-05-11.
- **Open Guy thread: xlsx support** — [gmail](https://mail.google.com/mail/u/2/#inbox/19dfff045815bfb0) — Guy: "anything I can communicate?" — unanswered for a week. Now load-bearing post-CL.
- **Open Decision-Brief thread you started** — [gmail](https://mail.google.com/mail/u/2/#inbox/19e091aa34fafb7d) — "should reports become project canon?"; Guy replied with Effi-context-tuning thoughts. Open.

### 🔍 New since last scan (Elsante transcript — items NOT covered in Gmail follow-up)
- **Cross-project / portfolio "show me all the showstoppers"** — Elsante: "Is there a way where I can pull all that information out, from each of the projects, give me a summary for all of the projects we have, what are the showstoppers, for example?" — no current capability. — from Elsante transcript 2026-05-13.
- **Otter integration** — Elsante: "So we'd so love to have an integration for Otter. Today we're doing that manually — download then upload." Top-2 priority after email rules. — from Elsante transcript 2026-05-13.
- **Sync-failure email alerting** — Elsante found a stuck Excel sync only by happenstance log-in; Guy: "Yes, we should do that, I agree." — from Elsante transcript 2026-05-13.
- **Calendar attendees → Effi context** — Elsante: "great if we were able to add the Hudson Technologies Effi email as part of the invited list of attendees… Effi knows there's an imminent meeting Friday and XYZ people are invited." Customer-pull on the previously-parked "calendar-prep" Someday item. — from Elsante transcript 2026-05-13.

### 🧠 Mind-sweep (from your 2026-05-15 scratchpad)
- Slack: self-invite — scope question; need it to still work w/o it
- Slack: VAIS pipeline (channel-as-doc decided in team meeting 2026-05-14)
- Slack: marketplace listing (ENG-5417 backlog; ToS clock to 2026-03 per Lihu's banner)
- Access-level ↔ recipients-canon-classification correlation (external recipients → save report as external) — overlaps Guy's three-axis discussion in team meeting [00:38-40]
- Elsante helpers — adding internal/external/workspace members
- Experiment w/ Excel — "what does it mean we support Excel?" (cross-refs Guy's xlsx thread + Slack-files-MUST + Elsante template variability)
- Claude upgrade — model/SDK bump across nextjs + python-services
- Open Claude Code issues status
- "Claude design — what's that?"

## Next Actions
_Filed tickets stay here until done-in-prod (DoD). Each carries `track:<depth>` and `comms:<cadence>` so future runs know what to surface and what to draft._

_CL-today commitments all landed: disconnect ws ✓, files:read scope on prod app ✓, slackIntegration flag removed in fb058a918 ✓_

- **Re-create staging Slack app** + rotate `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` in Doppler → Railway (per Lihu's SOON banner) + set redirect URLs (canonical staging + `https://local-dev.askeffi.ai/api/slack/callback` if applicable). Decided 2026-05-15 to re-create rather than admin-transfer. `track:through-staging` `comms:silent` (internal hygiene)

### Closure proposals (Claude → you — approve, decline, or steer)
- **ENG-5838** (Loose-ends silent fire) — Linear `Done`. Tracking was `through-production` + `comms:Guy on-solve + on-deploy`. Confirm: shipped to prod? Guy notified?
- **ENG-5839** (remove email frame wrapper) — Linear `Done`. Tracking was `through-production` + `comms:Guy final-ack`. Confirm: shipped to prod? Guy acked?

### Proposed (Claude → you — promote, dismiss, or steer)
- **Reply to Guy's xlsx question** — week-old thread; Lihu offered "I may have a solution"; Guy explicitly asked "anything I can communicate?". Slack-files-MUST from team meeting makes this load-bearing. Draft a one-liner: "Excel support is in flight as part of Slack-file ingest — coming this week."
- **File "Slack files ingest"** as a Linear feature — committed in team meeting (treat like email attachments; semantic search + get_file). Co-spans Elsante's Excel-template variability AND xlsx thread AND Slack-files-MUST.
- **File "VAIS pipeline for Slack — channel-as-document"** as a Linear feature — decided in team meeting [00:11:16]. Initial chunking approach.
- **File "Sync-failure email alerts"** as a Linear feature — Elsante asked, Guy agreed. Small surface.
- **File "Calendar attendees → Effi context"** as a Linear spec — Elsante asked + your own Someday item; customer-pull means it's no longer just nice-to-have.
- **File "Cross-project portfolio reports"** as a Linear feature — Elsante's portfolio-view ask; new shape distinct from per-project reports.
- **File "workspace-email feature — spec'd"** as a Linear issue (parented under ENG-5318 or new spec) — Guy's "Workspace level email requirements" email already contains an Effi-generated spec; trigger to un-park "emailing Effi".
- **File "Slack design polish — from Guy's redesign mock"** as a Linear issue — Guy's 5/14 + 5/15 02:33 emails carry concrete UX iteration; file before it loses context.

## Waiting For
_(empty)_

## Projects

### ⭐ Top focus — open question
The 2026-05-15 mind-sweep + team-meeting + Andrew-CL onboarding is heavily Slack-shaped (scopes, self-invite, staging redo, VAIS, files ingest, marketplace, deploy). Scheduled-reports (ENG-5318) is still in-progress but most of the last 2 days is Slack-UX work. Default proposal: **shift top focus → Slack integration** until Andrew is stable + Elsante's portfolio/email-rules story has a spec. Scheduled-reports stays a side-track for must-fix bugs only.

Other in-progress Linear (no recent movement attributed to you here):
- ENG-6010 — design-audit sweep
- ENG-5938 — dependency sweep
- ENG-5318 — scheduled reports (parent of recent fixes)
- ENG-5272 — gfs_sync_item triggers
- ENG-5019 — chat streaming richer events
- ENG-5010 — tool ID truncation bug

## Someday / Maybe
- DB cleanup: gfs_sync_item triggers (ENG-5272)
- **"emailing Effi" feature** — Guy's [requirements doc](https://docs.google.com/document/d/1RFGyLNLnIWppzHsNQi5EN-Gw0hWJnaEX8BdbT8LJMKw/edit?tab=t.0#heading=h.75bfx7nnm76u). **Movement 2026-05-14**: Guy sent an Effi-generated workspace-level email-requirements spec — see Inbox + Proposed. Ready to promote.
- **Calendar-prep idea** — "Effi sends prep notes before meetings" — [#product](https://askeffiworkspace.slack.com/archives/C09QZ570RAA/p1778068878579729). **Movement 2026-05-13**: Elsante asked for the same shape (Effi-knows-the-meeting-is-coming) — customer-pulled. Ready to promote.

## Dropped
_Items you explicitly declined to track. Future scans skip matches. Re-raise only on materially different signal (e.g., Sentry issue resurfaces after long silence with much higher rate)._
- `sentry:PYTHON-FASTAPI-N7` — scheduled_report_runs CHECK violation; folded into ENG-5838 territory — dropped 2026-05-07
- `sentry:PYTHON-FASTAPI-NB` — sharepoint VAIS sync 404; not your surface — dropped 2026-05-07
- `class:sentry-storm/JSON-could-not-be-generated` — May 1-5 cluster (PYTHON-FASTAPI-MW, N0–N5) on `_delete_document_api_call` / `_finalize_disconnecting_connections` / `_cleanup_timed_out_deleting_items` — upstream-transient class — dropped 2026-05-07
- `class:calendar-nudge/critical-loop-recurring` — already-accepted recurring meeting (Fri 18:30 CEST) — dropped 2026-05-07
