# Oria's crazy space

A cage-within-the-cage. The directed-but-not-yet-built subspace where Oria's
recent experimental work is *supposed* to live. Opened 2026-04-28 by direction
from Lihu (resting, dictating to Zisser): "send one zserper task, three tasks
each of them. Analyze the personas of oria, lihu, and itsam based on all the
Claude sessions, the commits, mainly the discussions with Claude, the sessions
… and add those personas to GIMP, to oria's crazy world in GIn."

## Status

**Open-to-empty** (z003). The address exists; content lands as it earns.

## Why "crazy"

Lihu's term. Refers to the recent experimental stuff — `glasses/`, `cage/`,
`memento/`, `personas/creative/`, `moazash/`, the persona-extension subclasses
— directed but not yet caged into one subspace. This is that cage.

Not pejorative. "Crazy" here = exploratory, not yet stable, not yet useful in
the workflow library. Promote out (to `usegin/personas/<name>.md`,
`usegin/cage/<slug>/<slug>.md`, etc.) when something matures.

## What lives here

| Folder | What |
|---|---|
| `personas/` | Living team-member personas (Oria, Lihu, Nitsan) — distinct from `usegin/personas/` (named workflow personas like Mark, Poll) and from `usegin/cage/` (historical figures). These are *the people who use this codebase* as Gin-callable personas. |
| `personas/sources/` | Primary-source evidence (session quotes, commit attribution, zettel-trigger trails) anchoring each persona file. |

## File shape

Use the standard persona shape — `usegin/personas/README.md`. Two-faced
(z022): human side + Gin side. Frontmatter (`name / role / soul / biases /
voice / defaults / created`), then `Human side`, `Gin side`, `Biases (stable)`,
`How <name> works in a team`, `Stays out of`.

Difference from `usegin/cage/`: cage personas are *historical* (Einstein,
Buffett, the Rambam), source-bound by what they wrote. These are *living*,
source-bound by what they *say to Claude* — the real signal of how each one
thinks lives in their session transcripts and commits.

## Constraints

- **Primary sources earn the soul.** No invention. Quotes from
  `~/agent-records/<github-user>/` and from sessions found via the
  `session` CLI. Each non-trivial paragraph cites a source.
- **Failure modes count.** Frustration loops, blind spots, recurring
  corrections — that's part of the persona.
- **Laconic** (z032). ~150 lines per file. Proof chain in `sources/<slug>/`,
  not the persona body.
- **Append-mostly.** Never delete. Bump `version:` when you distill (z039).

## Cross-references

- `usegin/personas/README.md` — file shape spec
- `usegin/cage/README.md` — sister cage (historical figures)
- `usegin/personas/zisser.md` (and `zisser/zisser.md`) — Zisser is who
  commissioned this subspace
- `~/agent-records/{lihub,nitsan-avni,oria-masas}/` — primary-source
  session transcripts (per `reference_agent_records` memory — these
  persist via conversation-watcher, not ephemeral)
