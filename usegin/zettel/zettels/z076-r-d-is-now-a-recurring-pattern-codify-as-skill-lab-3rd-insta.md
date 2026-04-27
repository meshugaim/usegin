---
id: z076
title: R&D is now a recurring pattern — codify as  skill + lab (3rd instance)
type: zettel
authored-by: usegin
threads: [~z023, ~z027, ~z029]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---

## Human side

Lihu, 2026-04-27: *"It's the 3rd time we do it. Create an `rnd` skill and a lab for that skill."*

Three observed instances of the pattern this week:
- Zettelkasten R&D (ENG-5379, 8 professors → cross-cutting synthesis)
- This turn's 8-agent queue (slice-2 designer, auto-pop, distillation, etc.)
- War-management R&D (this same turn, 6 professors)

Same shape every time: pre-decompose into N independent angles, write a charter per agent (z023 — charter is the instantiation), spawn first-tier agents in parallel (z029 — sub-Gin agents can't fan out further), each writes a whiteboard, cross-cutting synthesis at the end. Charters mention zettel-capture skill so professors know to log friction as they work.

## UseGin side

Skill at `.claude/skills/rnd/SKILL.md`. Lab at `.claude/skill-lab/rnd.md` in the standard purpose-shape (Intent / Success Signals / Known Limitations / Retro Guide / Retros / Ideas / Changelog) used by skill-lab/{build-orchestrate, liaison, tdd-execute, ralph-loop, ...}.

Skill captures the lifecycle:
1. Decompose the question into 3-N independent angles (don't have a single manager fan out — z029 evidence).
2. Write a charter per agent: read-first list, mandate, scope/out-of-scope, deliverable shape, friction-capture pointer (zettel-capture skill).
3. Spawn all in parallel as background agents.
4. Commit each agent's output as it lands (don't batch — autosync collision risk per `reference_autosync_concurrent_collisions`).
5. Cross-cutting synthesis at the end (separate spawn or main-thread, depending on token budget).
6. Bring dilemmas to Lihu in z026 shape.

Spawning the rnd-skill-author this turn to write skill+lab from this template.
