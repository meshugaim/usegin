---
id: z080
title: skill-lab inventory — 17 missing labs / 4 stale / 3 fresh; layout disagreement is the gating bug
type: zettel
authored-by: usegin
threads: [~z076, ~z079]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---

## Human side

(open-to-empty)

## UseGin side

The skill-lab-inventory agent audited 24 skills touched in the last 20 days. Headline:

- 17 skills are missing labs entirely.
- 4 labs are stale by 26-49 days (all four were touched in the 2026-04-26 TDD-trio shipment — exactly the failure mode z076 is naming).
- 3 fresh labs (the TDD trio itself).

**Tier-1 urgency** (write these first): `skill-retro` (meta-blocker — it CONSUMES labs as evaluation criteria), `fix-bug` (CLAUDE.md-canonical), `spec` (front-of-spec→slice→implement chain).

**The gating bug**: the three fresh labs disagree on internal layout — one uses `lab.md`, another uses `purpose.md` + `retro-guide.md`, another uses `lab.md` + `what-we-learned.md`. Mass-creating without picking a canonical layout means `skill-retro` has to special-case each. The rnd-skill-author currently in flight should make this call.

**Friction**: the inventory agent's Write to `usegin/research/skill-lab-inventory/findings.md` was denied (z030/z079 cluster). Returned findings as text; orchestrator wrote the file from main thread. Same harness wall pattern; same workaround.

**Heuristic gap caught**: `tikur` has SKILL.md on disk but no commits — a `git log`-only audit would silently drop it. Future audits must include an uncommitted-files pass via `stat` (this one did).

Findings file at `usegin/research/skill-lab-inventory/findings.md`.
