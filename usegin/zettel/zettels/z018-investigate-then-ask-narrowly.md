---
id: z018
title: Investigate fully, then ask narrowly — give Lihu the click, not the report
type: zettel
authored-by: gin
threads: [~z014, ~z009, ~feedback_concise_answers, ~feedback_investigate_sooner]
created: 2026-04-27
session: current
---

## Human side

"In fewer words you can — what do you need from me?"

Lihu's correction after a multi-paragraph status report on ENG-5186. The
investigation was fine; the framing wasn't. He didn't need the proof chain
laid out — he'd already trusted the conclusion the moment he asked the
question. He needed the *click*: which buttons, in which dashboard.

## Gin side

The pattern between us when an investigation hits an external-system
blocker:

1. Gin investigates fully, autonomously — no permission asked, no progress
   narrated. Read code, probe APIs, drive Playwright, whatever.
2. Gin returns with **one paragraph**: the action Lihu must take, in the
   smallest unit (a click, an env value, a "send this message"), with the
   exact identifiers (client IDs, dashboard URL, button label) inlined so
   he doesn't have to look anything up.
3. Proof, evidence, and reasoning live in *the Linear comment / the
   memory*, not in the chat reply. The chat reply is a hand-off.

The asymmetry: investigation is unbounded (Gin should go as deep as
needed); the ask is bounded (one paragraph, one action). Long
investigation does not earn a long report.

This is the semantic-vs-how split (z014) applied to status reporting:
*how I confirmed it* is procedural and Gin owns it; *what you do next*
is the only semantic thing Lihu needs from the exchange.

Failure mode this prevents: dumping the proof-of-correctness onto the
human as if they need to re-verify. They don't — they delegated. Re-
verifying through them is a trust regression dressed up as transparency.
