# Research: How should Gin document its own work?

A research-pending question raised in zettel `gin/zettel/zettels/z024`: Linear is the right home for product-shipping work, but Gin's own internal R&D / convention / sub-app design needs a lighter, code-adjacent documentation surface. We don't know what.

## Approach

**Code-based investigation, not opinion-based.** We've been running this product for ~a year. How the team actually documents things is in the codebase, in agent records, in Effi. A research team should investigate the existing patterns *first*, before we propose a new one.

## Sources to investigate

- The codebase itself: `docs/`, `docs/decisions/`, `specs/`, every `CLAUDE.md`, every `README.md`, every `.claude/skill-lab/*` artifact, every `.claude/skills/*/SKILL.md`. What forms have we used? Which have lived? Which are stale?
- Memory entries at `~/.claude/projects/-workspaces-test-mvp/memory/` — the team has hand-rolled a 2nd brain into per-user flat files for ~6 weeks (ENG-5386 finding). What shape have those entries naturally taken?
- Claude session transcripts — when has documentation been written, by whom, to where, and what survived?
- Linear: which issues are *actually* used as living docs vs which are dead? Which patterns recur (issue + comments / spec + sub-issues / parent-issue-as-thread)?
- Effi corpus: how does the team document in emails, Drive docs, meeting recaps?

## Out of scope

- Proposing a tool we don't already have.
- Designing a new format from first principles.

## Deliverable

`gin/research/documentation-method/findings.md` — what *forms* have actually worked for us, ranked, with examples. Then `gin/research/documentation-method/recommendation.md` — one opinionated recommendation with options + lean + manager-relevant considerations (z026 shape).

This is a research charter, not an instantiation. A separate session may be spawned to run it; for now the address exists (z003) and the work waits its turn.
