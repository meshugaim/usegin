# Skill-Lab Inventory — Audit

**Scope**: skills in `.claude/skills/` created or modified on/after **2026-04-07** (last 20 days, anchor 2026-04-27).
**Lab convention**: skill folder `foo` → `.claude/skill-lab/foo/` (with `lab.md` / `purpose.md`) **or** `.claude/skill-lab/foo.md`.
**Source**: `git log` for committed skills; filesystem `stat` for uncommitted (`tikur`).
**Read references**: `build-orchestrate/lab.md`, `liaison/lab.md`, `tdd-execute/purpose.md`. Standard sections: Intent / Success Signals / Known Limitations / Retros / Ideas / Changelog.

> Internal layout is inconsistent across existing labs: `lab.md` vs `purpose.md` + `retro-guide.md` vs `lab.md` + `what-we-learned.md`. **Pick one canonical shape before mass-creating** — see `Recommendations / Process note`.

## Summary table

| Skill | Created | Last modified | Lab? | Lab last modified | Class |
|---|---|---|---|---|---|
| app-sanity-test | 2026-02-14 | 2026-04-23 | yes (dir) | 2026-03-05 | (c) stale 49d |
| dogfooding-effi | 2026-04-24 | 2026-04-24 | no | — | (b) missing |
| effi-session-audit | 2026-04-17 | 2026-04-17 | no | — | (b) missing |
| fix-bug | 2026-03-25 | 2026-04-26 | no | — | (b) missing |
| handoff | 2026-02-10 | 2026-04-13 | no | — | (b) missing |
| his-self-rating | 2026-04-27 | 2026-04-27 | no | — | (b) missing |
| implementing-specs | 2025-11-27 | 2026-04-26 | yes (dir) | 2026-03-17 | (c) stale 40d |
| interactive-dev | 2026-04-08 | 2026-04-09 | no | — | (b) missing |
| liaison | 2026-02-03 | 2026-04-26 | yes (dir) | 2026-03-31 | (c) stale 26d |
| manual-testing-by-agent | 2026-01-07 | 2026-04-16 | no | — | (b) missing |
| save-to-effi | 2026-04-24 | 2026-04-24 | no | — | (b) missing |
| security | 2026-03-28 | 2026-04-20 | no | — | (b) missing |
| serve-static | 2026-04-17 | 2026-04-17 | no | — | (b) missing |
| skill-retro | 2026-02-25 | 2026-04-26 | no | — | (b) missing |
| slicing-specs | 2026-03-05 | 2026-04-26 | yes (dir) | 2026-03-19 | (c) stale 38d |
| spec | 2026-03-28 | 2026-04-26 | no | — | (b) missing |
| tdd-execute | 2026-04-26 | 2026-04-26 | yes (dir) | 2026-04-26 | (a) fresh |
| tdd-impl-plan | 2026-04-26 | 2026-04-26 | yes (dir) | 2026-04-26 | (a) fresh |
| test-architecture | 2026-04-26 | 2026-04-26 | yes (dir) | 2026-04-26 | (a) fresh |
| tikur | uncommitted | uncommitted (fs:2026-04-27) | no | — | (b) missing |
| update-deps | 2026-04-16 | 2026-04-24 | no | — | (b) missing |
| usage-projection | 2026-04-22 | 2026-04-22 | no | — | (b) missing |
| use-gin | 2026-04-27 | 2026-04-27 | no | — | (b) missing |
| zettel-capture | 2026-04-27 | 2026-04-27 | no | — | (b) missing |

**Counts**: 24 in scope. 3 fresh-lab. **17 missing-lab**. 4 stale-lab.

## Missing-lab list (17) — proposed purpose

1. **dogfooding-effi** — Make the team's own Effi project canon (Drive, Gmail, Linear, meeting notes) the first stop when an agent needs grounded context about *our* decisions/status, not codebase facts.
2. **effi-session-audit** — Investigate real production user sessions to diagnose Effi's behavior (intent capture, looping, confabulation, frustration, tool routing) instead of reasoning from the code alone.
3. **fix-bug** — Force the full quality workflow (liaison + companion + TDD + independent review) onto every "X is broken" report so regressions land with reproducible tests, not ad-hoc patches.
4. **handoff** — Persist enough session context across `/handoff` boundaries that a resumed agent reconstitutes scope, decisions, and next-step without re-asking the human.
5. **his-self-rating** — Capture mid-session friction/intent/code/spec gaps as how-is-session readings *proactively*, not just on `/end`.
6. **interactive-dev** — Make pair-programming with a human first-class: deep pre-investigation, real self-verification (browser/API/DB, not "tests pass"), TDD, companion-watched, alignment-first.
7. **manual-testing-by-agent** — Drive playwright-cli from an agent for end-to-end UI verification when scripted tests aren't the right tool (exploratory, single-flow, design-iteration).
8. **save-to-effi** — Promote durable session knowledge (decisions, design notes, write-ups) into the team's Effi canon so future Effi queries can ground on it.
9. **security** — Operate as the in-house security expert across audits (DPA/SOC2/CASA), questionnaires, subprocessor list, RLS/encryption questions, rather than ad-hoc replies.
10. **serve-static** — Bridge "I generated an HTML file locally" to "human sees it in their actual browser", with environment-aware exposure (Gitpod vs Codespaces vs local).
11. **skill-retro** — Score how well skills were *followed* in a session against each lab's Success Signals, and write findings back so labs evolve from real evidence.
12. **spec** — Replace document-first spec writing with conversation-first alignment, then autonomous spec authoring, to minimize human reading time on the front end.
13. **tikur** — Run blameless, fact-first, systemic-root-cause post-mortems (IAF tarbut-ha-tikkur) on recurrence-prone failures, with a mandatory committed fix as exit criterion.
14. **update-deps** — Coordinate dependency upgrades across the bun + uv monorepo as one auditable operation rather than per-package one-offs.
15. **usage-projection** — Project whether `/usage` consumption is on track to exhaust the weekly/monthly limit before reset, so the human can adjust pace early.
16. **use-gin** — Be the first lookup for "can Gin/I do X?" capability questions, surfacing the `tools/` and `.claude/` layer before falling through to upstream Claude Code defaults.
17. **zettel-capture** — Capture zettels mid-session *autonomously* on trigger signals (decisions, friction, lessons) so the shared 2nd brain stays continuously updated.

## Stale-lab list (4) — labs >7 days behind their skill

| Skill | Skill last mod | Lab last mod | Drift |
|---|---|---|---|
| app-sanity-test | 2026-04-23 | 2026-03-05 | 49d |
| implementing-specs | 2026-04-26 | 2026-03-17 | 40d |
| slicing-specs | 2026-04-26 | 2026-03-19 | 38d |
| liaison | 2026-04-26 | 2026-03-31 | 26d |

All four were touched in the **2026-04-26 TDD-trio shipment** — the skills were updated but their labs were not. This is exactly the failure mode `z076` is naming.

## Recommendations — write order

No usage-frequency telemetry available, so ranking blends: (1) skills referenced from CLAUDE.md / `.claude/rules/` (active rotation), (2) labs whose absence breaks the `skill-retro` loop (skill-retro *reads* lab files for criteria — every missing lab is a retro blind spot), (3) recency.

**Tier 1 — load-bearing**
1. **skill-retro** — meta-blocker: it *consumes* labs. Every other missing lab degrades it. Write its lab first so it defines the contract.
2. **fix-bug** — referenced from CLAUDE.md as canonical bug-fix entrypoint; high-frequency, high-cost when skipped.
3. **spec** — entrypoint for new feature work; pair with refreshing `slicing-specs` + `implementing-specs` to close the spec→slice→implement chain.

**Tier 2 — refresh stale (TDD-trio drift)**
4. liaison · 5. implementing-specs · 6. slicing-specs · 7. app-sanity-test

**Tier 3 — write when next used (alphabetical)**
8. dogfooding-effi · 9. effi-session-audit · 10. handoff · 11. his-self-rating · 12. interactive-dev · 13. manual-testing-by-agent · 14. save-to-effi · 15. security · 16. serve-static · 17. tikur (commit the SKILL.md too) · 18. update-deps · 19. usage-projection · 20. use-gin · 21. zettel-capture

**Process note**: the three fresh labs disagree on internal layout (`lab.md` vs `purpose.md`+`retro-guide.md` vs `lab.md`+`what-we-learned.md`). Before mass-creating, pick one canonical layout — else `skill-retro` has to special-case each. The rnd-skill-author currently in flight should make this call.

## Friction note

`tikur` has SKILL.md on disk but no commits, so a `git log`-only audit would silently drop it — future audits should include an uncommitted-files pass (this one did, via `stat`).
