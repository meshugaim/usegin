---
date: 2026-05-08
charter_for: general-purpose sub-agent
caller: Zisser
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
output_path: zisser/dispatched/2026-05-08-doppler-history-out.md
read: substrate (plans/dispatched/inbox/notes/zettels/sessions/Linear) — NOT code
mode: read-only, no commits, no edits outside output file
---

# Charter — History-Doppler — what we *said* Doppler should look like

## Purpose

Distill the team's accumulated **desired-state** for Doppler from every
conversation, plan, dispatch, inbox note, zettel, and Claude session over
the past ~2 weeks. Produce one clean picture: "here's what we decided
Doppler should look like." Do **NOT** read application code. Do **NOT**
look at the actual Doppler dashboard or live secrets. Your job is the
*latent intent*, not the reality.

## End state

A single markdown file at `zisser/dispatched/2026-05-08-doppler-history-out.md`
containing:

1. **The shape** — what Doppler should look like, as one diagram or table
   (project → configs → secret-classes → key-holder policy).
2. **Decisions made** — list, each with a one-line "why" + the source
   file(s) that document it.
3. **Decisions still open** — list, each with where it surfaced and why
   it stalled.
4. **Contradictions / drift** — places where two notes disagree; resolve
   by date if obvious, otherwise mark "open contradiction".
5. **The "click"** — one paragraph: if a stranger asked "what is Doppler
   for, in this team?", what's the answer.

## Where to read (in order)

1. `zisser/plans/` — especially `2026-05-05-doppler-three-group-reorg.md`,
   `2026-04-30-e2e-external-services-in-the-loop.md`, anything else
   matching `*doppler*`.
2. `zisser/dispatched/` — `2026-05-05-doppler-reorg-deep-research.md`,
   `2026-05-06-doppler-migration-team.md`, anything else matching
   `*doppler*`.
3. `zisser/inbox/` — `2026-05-05-fecli-doppler-bootstrap.md`, anything
   else.
4. `zisser/notes/` — `2026-05-06-doppler-migration-done.md`,
   `2026-05-06-doppler-consumer-map.md`, anything else.
5. `zisser/log/` — recent entries that mention Doppler.
6. `usegin/zettel/zettels/` — grep for doppler/secrets/devops/owner-key.
7. `~/.claude/projects/-workspaces-test-mvp/` — recent JSONL session
   transcripts. `rg -l -i doppler` to find sessions; read the relevant
   ones for what was decided in conversation, not just artifacts.
8. Linear via `plan list | grep -i doppler` and `plan search doppler`.

## What you must NOT do

- Do NOT open `nextjs-app/`, `python-services/`, `scripts/`, devcontainer
  configs, or any code/config that consumes Doppler. Latent-only.
- Do NOT run `doppler` CLI. Do NOT query the Doppler dashboard.
- Do NOT commit anything. Do NOT edit existing files.
- Do NOT propose fixes — just describe what was *intended*.
- Do NOT load any persona, principle, or skill beyond what general-purpose
  has by default. Skip `oria-crazy-world/`, `zisser/principles/`,
  `usegin/personas/`, `.claude/skills/`.

## Investigative posture

- All time, all resources. No rush; thoroughness over speed.
- When two docs conflict, list both with dates and call it.
- Quote sparingly — link by path:line instead of pasting paragraphs.
- Names: there are three humans (Oria, Lihu, Nitsan). When attributing a
  decision, name the human; when unclear, say "team" or quote the speaker
  the artifact attributes it to.

## Scope guardrails

- Do not include Slack content unless it directly bears on Doppler
  (e.g. `SLACK_*` secrets that need a Doppler home).
- Do not propose work — your output describes desired state and gaps in
  intent only. Implementation planning is a later phase.

## Stop condition

Output file exists at the path above with the five sections filled.
Return to caller: just the path + a one-line summary ("Doppler latent
state captured; N decisions, M open, K contradictions").
