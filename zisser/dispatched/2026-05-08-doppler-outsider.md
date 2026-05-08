---
date: 2026-05-08
charter_for: general-purpose sub-agent (FRESH-EYES)
caller: Zisser
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
output_path: zisser/dispatched/2026-05-08-doppler-outsider-out.md
read: ONLY the two phase-1 outputs + plain Doppler public docs
mode: read-only, no commits, no edits outside output file
---

# Charter — Outsider-Doppler — fresh-eyes connect-the-gap

## Purpose — read this first, this is THE point

You are an outsider. No team history. No personas, no principles, no
zettels, no skills, no slang. You walk in cold.

You will read exactly two files (the team's "what we said we wanted" doc
and the team's "what's actually there" doc) and tell us — in plain
English a stranger would understand — **where the gap is and what the
smallest, dumbest path from current to working actually looks like**.

The team has been spinning in latent-world: a lot of plans, a lot of
discussion, a lot of variants. The team's own request, verbatim:
"Guys, you are far away in the latent world. What we need to do is to
connect this there." That's your job. Be that voice.

## End state

A single markdown file at `zisser/dispatched/2026-05-08-doppler-outsider-out.md`
with these sections (and no others):

1. **The picture in plain words** — three short paragraphs. What is
   Doppler being used for here? What did the team decide it should look
   like? What does it actually look like today?
2. **The gap, named honestly** — bullet list. Each bullet: one concrete
   thing that's between "today" and "done". No jargon. No "Tier-2", no
   `z123`, no skill names.
3. **The smallest path** — ordered list, ≤10 steps. Each step is one
   action a human or agent can do. Boring is good. If a step needs a
   key/decision from a human, mark it **HUMAN-DECISION**.
4. **What I'd cut** — what in the team's plan is over-engineering for
   the current size of the team / users / risk profile. Be direct. If
   you don't think anything needs cutting, say so.
5. **What I'd not touch yet** — what looks tempting to fix but should
   wait.
6. **The single sentence** — one sentence: "Doppler is done when ___."
   That sentence is the acceptance test.

## What you may read

- `/workspaces/test-mvp/zisser/dispatched/2026-05-08-doppler-history-out.md`
  — the team's latent intent.
- `/workspaces/test-mvp/zisser/dispatched/2026-05-08-doppler-state-out.md`
  — the team's ground truth.
- Doppler's public documentation (https://docs.doppler.com) via WebFetch
  if you want to sanity-check naming, conventions, or feature
  availability.

## What you must NOT read

- Any other file in `zisser/`.
- Any file in `oria-crazy-world/`.
- Any file in `usegin/zettel/`, `usegin/personas/`, `.claude/skills/`,
  `.claude/agents/`, `~/.claude/projects/`.
- Application code (`nextjs-app/`, `python-services/`, `tools/`,
  `scripts/`, `.devcontainer/`, `.github/`).
- The live Doppler dashboard or any CLI.
- Any other `.md` file in the repo, including CLAUDE.md.

If a phase-1 output references a doc by path you have not read, do
**not** go read it. Treat the phase-1 output's summary as canonical;
that's the whole point of the two-phase shape.

## What you must NOT do

- Do not adopt team vocabulary if a plain word works. The team uses
  words like "latent", "click", "armageddon-key", "ceremony", "two-faced",
  "Bucket-5", "DevOps boundary". Translate them. If the underlying idea
  is solid, restate it in stranger-language. If the underlying idea is
  fuzzy, name the fuzziness.
- Do not reference team artifacts by their internal names (e.g. "z037",
  "ENG-5379", "Wes", "Gin"). Either explain inline or skip.
- Do not commit. Do not edit any file outside your output path.
- Do not propose new plans, new skills, new processes. Your output is
  the path, not new infrastructure.
- Do not pad. Be terse. The "click" rule applies even though we don't
  call it that — long thinking, short artifact.

## Posture

- Read both phase-1 outputs end-to-end before writing a word.
- Then write the output in one pass. Don't iterate; first draft is the
  draft.
- If the team's plan looks reasonable, say so plainly. The job isn't to
  invent a counter-plan; it's to confirm or contradict, with a clear
  reason.

## Stop condition

Output file exists with the six sections.
Return to caller: just the path + one sentence summary.
