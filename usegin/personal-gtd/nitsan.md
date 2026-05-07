# Personal GTD — nitsan

> Managed by the `personal-gtd` skill (`.claude/skills/personal-gtd/SKILL.md`).
> Don't hand-edit; steer it conversationally via `/personal-gtd`. Hand-edits between runs are honored but may be flagged if unparseable.

last_run: 2026-05-07T14:30:00Z
gmail_account_index: 2  # nitsan's Gmail is /u/2 in the multi-account URL — use this when minting mail.google.com links

## Inbox
_Items we haven't clarified yet — need discussion between you and Claude before they can be classified. OK to persist across runs._

- **"emailing Effi" requirements doc** — Guy shared a Google Doc with you+Oria+Lihu, "Took a pass at the requirements … let's push for simple". You haven't read or responded. — [gmail](https://mail.google.com/mail/u/2/#inbox/19e00a095d908218) → [gdoc](https://docs.google.com/document/d/1RFGyLNLnIWppzHsNQi5EN-Gw0hWJnaEX8BdbT8LJMKw/edit?tab=t.0#heading=h.75bfx7nnm76u) — captured 2026-05-07.
- **xlsx support — what to communicate** — Guy at 13:38 asked you+Lihu: "Let's do the easy on if easy. Anything I can communicate?". Lihu said he may have a solution. Ball is split: Lihu owns the fix, you might owe the user-facing line. — [gmail](https://mail.google.com/mail/u/2/#inbox/19e02a9cb520eee2) — captured 2026-05-07.
- **Cross-test isolation bug — `unified-forward.test.ts:173`** — you `--no-verify`'d to land 18449e6bc; [DM'd Oria](https://askeffiworkspace.slack.com/archives/D0B080WEJHE/p1778076457178719) flagging the AC-2 tampered-sig case (closure-scoped fix in d581d1dd8 not the regressor). No owner yet. Captured 2026-05-06.
- **Calendar invite: Critical loop / AskEffi** — weekly Fri 18:30–19:00 CEST recurring — [gmail](https://mail.google.com/mail/u/2/#inbox/19de5803c5df06b3) — captured 2026-05-01.
- **Stale Q from Apr 30 status thread** — your "Where's the commit data coming from?" never got answered; Guy deflected to "ask her". Probably moot now. — [gmail](https://mail.google.com/mail/u/2/#inbox/19de0d4a9ce2722c) — captured 2026-05-01.
- **Calendar-prep idea (your Slack post)** — "if we integrate with a calendar, Effi could send prep notes before meetings" — [#product](https://askeffiworkspace.slack.com/archives/C09QZ570RAA/p1778068878579729) — captured 2026-05-06. Possibly Someday/Maybe.

## Next Actions
_Filed tickets stay here until done-in-prod (DoD). Each carries `track:<depth>` and `comms:<cadence>` so future runs know what to surface and what to draft._

- **[ENG-5838](https://linear.app/askeffi/issue/ENG-5838)** — scheduled-reports Loose-ends fire silently fails post-ENG-5817 (3 occurrences). Next move: dispatch fresh-Gin to investigate. `track:through-production` `comms:Guy on-solve + on-deploy`
- **[ENG-5839](https://linear.app/askeffi/issue/ENG-5839)** — remove email frame wrapper from outbound report body. `track:through-production` `comms:Guy final-ack`

## Top focus
- **Scheduled Updates / Reports — ENG-5318.** Most recent 14d arcs (ranked by commit count, already done unless flagged): ENG-5750 anchored-fetch gate, ENG-5748 back-to-config, ENG-5791 test-fire status bug, ENG-5803 canon pipeline, ENG-5788 empty audience, ENG-5787 recipients v2, ENG-5817 wall-clock fix (the live failure above is downstream of this). Sub-tree drilldown lives in Linear.

## Someday / Maybe
- DB cleanup: gfs_sync_item triggers (ENG-5272)
