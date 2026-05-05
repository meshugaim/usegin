# Charter — Zettler V0 corpus read

Pour: Lihu, 2026-05-05 — *"create a V0 of the Zettel agent. Let's call him
Zettel or Zettler. Send him to tell us what we learned from all those
Zettels. See if the Zettelkasten app has a good infrastructure and a good
database. See if it has anything it needs. Try and think of V1."*

## Goal

Single end-to-end read pass over `usegin/zettel/` that surfaces (a) what
the team has learned, (b) infra hygiene, (c) gaps. Output is one report
file the human can read in ≤5 min.

## Read first

1. `usegin/zettel/zettler/zettler.md` — your soul (V0)
2. `usegin/zettel/README.md` — design + two-sided producing/consuming
3. `usegin/zettel/CLAUDE.md` — operating manual for the sub-app
4. `usegin/zettel/principles/` — five load-bearing principles
5. `usegin/zettel/zettels/README.md` — threading conventions
6. `usegin/zettel/organizing-process.md` — the manual loop
7. `usegin/zettel/gaps.md` — known unfit-yet items

## Build

Per `zettler.md` §V0 scope. One report:

```
usegin/zettel/zettler/findings/2026-05-05-v0-pass.md
```

Two-faced (z022). Lihu side at top:

- 3-bullet TL;DR (corpus shape, top theme, biggest gap)
- Table of 5-8 emergent clusters (name, n-zettels, hub-zettel, one-line click)
- Table of top 10-15 weight-bearing zettels (id, title, ≤30-word click)

Then Zettler side:

- Inventory by type / authored-by / month
- Friction-cluster status (z058-z073 + others)
- Infra audit (frontmatter consistency, threading hygiene, broken refs,
  CLI surface — does `dx zettel search` exist? per z065 it didn't)
- Gaps triangulated from `gaps.md` + `RD/*/whiteboard.md` + corpus blind
  spots
- Notes for Zisser (open questions, contested claims, follow-up dispatches
  worth chartering)

## Constraints

- **No writes to `zettels/`, `principles/`, or `dx zettel add`.** Read-only.
- **No `nextjs-app/` or `python-services/` touches.** Stay in `usegin/`.
- **Don't propose V1 in the report.** Surface findings; Zisser writes the
  V1 sketch separately based on this.
- ≤ ~3 hours of investigation, single agent, one report.
- Quote zettels by id + ≤30-word excerpt. Don't re-paste full bodies.
- Append-mostly per z039. Your report file is dated; supersede with a new
  file.

## Verification (self-check)

- All 115 (currently) `zettels/z*.md` files were touched at least once
  (Bash `wc` count of cited ids ≥ unique-id count; or explicit "skipped:
  z042, z044, z045, z046, z047, z051, z052, z054 — placeholder" line).
- Every cited cluster names ≥3 zettel ids.
- The infra audit answers: `dx zettel search` (exists? Y/N), broken
  threads (count), placeholder zettels (count), frontmatter schema
  drift (Y/N).
- Friction status table has columns: zettel-id, friction, status
  (open/fixed/superseded), evidence.

## Out of scope

- Writing to the corpus.
- Spawning sub-agents (do it inline; this IS a sub-agent dispatch).
- Production code.
- The non-sql-poc verdict re-evaluation (separate concern; cite if
  relevant but don't re-litigate).

## Dispatched

- when: 2026-05-05
- to: 1× general-purpose (Zettler shape, see `usegin/zettel/zettler/zettler.md`)
- run: foreground (Zisser is waiting on the report)
