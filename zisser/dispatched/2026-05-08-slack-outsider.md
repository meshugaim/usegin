---
date: 2026-05-08
charter_for: general-purpose sub-agent (FRESH-EYES)
caller: Zisser
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
output_path: zisser/dispatched/2026-05-08-slack-outsider-out.md
read: ONLY the two phase-1 outputs + plain Slack/Slack-OAuth public docs
mode: read-only, no commits, no edits outside output file
---

# Charter — Outsider-Slack — fresh-eyes connect-the-gap

## Purpose

You are an outsider. No team history, no personas, no principles, no
zettels, no skills, no slang. You walk in cold.

You will read exactly two files (the team's "what we said we wanted"
doc and the team's "what's actually there" doc) and tell us — in
plain English — **where the gap is and what the smallest, dumbest path
from current to working actually looks like**.

The team's request, verbatim: "Guys, you are far away in the latent
world. What we need to do is to connect this there." That's your job.

The product feature: a customer of an app called Effi clicks "Connect
Slack" inside Effi, OAuths with their Slack workspace, picks one or
more channels, and from then on Effi can answer questions grounded in
those channels' content.

## End state

A single markdown file at `zisser/dispatched/2026-05-08-slack-outsider-out.md`
with these sections (and no others):

1. **The picture in plain words** — three short paragraphs. (a) What is
   the customer-facing Slack feature trying to do? (b) What did the
   team decide it should look like? (c) What does it actually look
   like today?
2. **The gap, named honestly** — bullet list. Each bullet: one concrete
   thing between "today" and "a customer can really use this". No
   jargon, no `ENG-N`, no acronyms-without-explanation.
3. **The smallest path** — ordered list, ≤10 steps. Each step is one
   action a human or agent can do. If a step needs a key/decision
   from a human, mark it **HUMAN-DECISION**.
4. **What I'd cut** — what in the team's plan is over-engineering for a
   first-customer-can-use-it bar.
5. **What I'd not touch yet** — what looks tempting to fix but should
   wait.
6. **The single sentence** — one sentence: "Slack is done when ___."
   Acceptance test.
7. **One side-note on the team's own Slack workspace** — there's a
   second flow in play (the AskEffi team's own Slack workspace + a bot
   they call `useginslack` / `Slacker`). Treat it as separate; one
   short paragraph saying whether the team's plans are conflating the
   two flows or keeping them clean. Do **not** plan that flow — just
   call the entanglement (or its absence).

## What you may read

- `/workspaces/test-mvp/zisser/dispatched/2026-05-08-slack-history-out.md`
- `/workspaces/test-mvp/zisser/dispatched/2026-05-08-slack-state-out.md`
- Slack's public OAuth + Events API + Marketplace documentation
  (https://api.slack.com/docs) via WebFetch if you want to sanity-check.

## What you must NOT read

- Any other file in `zisser/`.
- Any file in `oria-crazy-world/`, `usegin/zettel/`, `usegin/personas/`,
  `.claude/skills/`, `.claude/agents/`, `~/.claude/projects/`.
- Application code anywhere.
- The live Slack apps, api.slack.com dashboard, `dx slack`, `effi`.
- Any other `.md` in the repo, including CLAUDE.md.

If a phase-1 output references a doc by path you haven't read, do
**not** go read it. Trust the phase-1 summary; that's the whole point.

## What you must NOT do

- Do not adopt team vocabulary. Translate to stranger-language: words
  like "Marketplace track", "Bucket-5", "C4 ingestion", "channel
  binding", "z112" — if you can't explain inline in plain English,
  skip.
- Do not reference team artifacts by internal names (`ENG-XXXX`, `Wes`,
  `Gin`, `Brown`).
- Do not commit. Do not edit any file outside your output path.
- Do not propose new plans, processes, or infrastructure.
- Do not pad. Terse first draft; ship.

## Posture

- Read both phase-1 outputs end-to-end before writing a word.
- Then write in one pass.
- If the team's plan looks reasonable, say so plainly. If it doesn't,
  say what's wrong in one line.

## Stop condition

Output file exists with the seven sections.
Return to caller: just the path + one sentence summary.
