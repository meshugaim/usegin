# Personal GTD — nitsan

> Managed by the `personal-gtd` skill (`.claude/skills/personal-gtd/SKILL.md`).
> Don't hand-edit; steer it conversationally via `/personal-gtd`. Hand-edits between runs are honored but may be flagged if unparseable.

last_run: 2026-05-07T15:35:00Z
gmail_account_index: 2  # nitsan's Gmail is /u/2 in the multi-account URL — use this when minting mail.google.com links

## Inbox
_Items we haven't clarified yet — need discussion between you and Claude before they can be classified. OK to persist across runs._

- **[PYTHON-FASTAPI-N7](https://askeffi.sentry.io/issues/?project=python-fastapi&query=PYTHON-FASTAPI-N7)** — fresh `scheduled_report_runs_status_check` CHECK violation on `/api/internal/scheduled-reports/fire-now` at 15:15Z (≈20min ago). Same shape as N6 which `ebba0efe9` fixed by allowing `cancelled_no_audience` — N7 is a *different* status still missing from the constraint. Likely same root area as ENG-5838 — fold in or file separately? — [gmail](https://mail.google.com/mail/u/2/#inbox/19e0301f5cb0cd55) — captured 2026-05-07
- **[PYTHON-FASTAPI-NB](https://askeffi.sentry.io/issues/?project=python-fastapi&query=PYTHON-FASTAPI-NB)** — `sharepoint-ab8189bb VAIS sync failed: 404 Data store projects/639...` at 13:29Z. Looks like Lihu's surface (sharepoint/VAIS) — route or own? — [gmail](https://mail.google.com/mail/u/2/#inbox/19e02a111d4600e9) — captured 2026-05-07
- **JSON-could-not-be-generated Sentry storm May 1-5** — 5+ occurrences across `_delete_document_api_call`, `_finalize_disconnecting_connections`, `_cleanup_timed_out_deleting_items` (PYTHON-FASTAPI-MW, N0–N5). Code 520 = upstream transient; pattern points at VAIS/canon delete cleanup. Still recurring or stabilized? — [gmail search](https://mail.google.com/mail/u/2/#search/JSON+could+not+be+generated) — captured 2026-05-07

## Next Actions
_Filed tickets stay here until done-in-prod (DoD). Each carries `track:<depth>` and `comms:<cadence>` so future runs know what to surface and what to draft._

- **[ENG-5838](https://linear.app/askeffi/issue/ENG-5838)** — scheduled-reports Loose-ends fire silently fails post-ENG-5817 (3 occurrences). Next move: dispatch fresh-Gin to investigate. `track:through-production` `comms:Guy on-solve + on-deploy`
- **[ENG-5839](https://linear.app/askeffi/issue/ENG-5839)** — remove email frame wrapper from outbound report body. `track:through-production` `comms:Guy final-ack`

## Top focus
- **Scheduled Updates / Reports — ENG-5318.** Most recent 14d arcs (ranked by commit count, already done unless flagged): ENG-5750 anchored-fetch gate, ENG-5748 back-to-config, ENG-5791 test-fire status bug, ENG-5803 canon pipeline, ENG-5788 empty audience, ENG-5787 recipients v2, ENG-5817 wall-clock fix (the live failure above is downstream of this). Sub-tree drilldown lives in Linear.

## Someday / Maybe
- DB cleanup: gfs_sync_item triggers (ENG-5272)
- **"emailing Effi" feature** — Guy's [requirements doc](https://docs.google.com/document/d/1RFGyLNLnIWppzHsNQi5EN-Gw0hWJnaEX8BdbT8LJMKw/edit?tab=t.0#heading=h.75bfx7nnm76u) — parked until scheduled reports is more stable, unless someone else picks up. Auto-send reply queued [gmail](https://mail.google.com/mail/u/2/#inbox/19e00a095d908218) — captured 2026-05-07.
- **Calendar-prep idea** — "if we integrate with a calendar, Effi could send prep notes before meetings" — [#product](https://askeffiworkspace.slack.com/archives/C09QZ570RAA/p1778068878579729) — captured 2026-05-06.
