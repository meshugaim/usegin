---
id: z101
title: Decision-rights envelope per spawning skill — make can-decide / must-coordinate / must-escalate explicit
type: zettel
authored-by: usegin
threads: [↑z023, ~z020, ~z029]
created: 2026-04-27
session: a2f5af80-303b-4c26-957b-ddb5bfeb61e3
---

## Human side

Lihu, 2026-04-27 (war research, PO"SH C2 + Mission Command #6): *"Every skill that spawns sub-agents should ship with an explicit 'this agent can decide / must coordinate / must escalate' stanza. Currently implicit per-skill — making it explicit catches a class of friction Lihu currently absorbs as 'the agent did something it shouldn't have.'"*

## UseGin side

Per principle 05 #1 (intent before method) and Auftragstaktik: subordinates own the *how*, but the *envelope of decision rights* must be explicit. Implicit envelopes are the C2 failure mode — sub-Gin acts inside what it thinks is its remit; spawner finds out it touched something it shouldn't have; Lihu absorbs the friction.

The envelope has three rows. Each row is a *scope-shaped list*, not a yes/no:

- **Can decide alone:** the structural shape of the deliverable, ordering of work, which neighbors to thread to, internal phrasing. Anything that lives entirely inside the artifact the sub-Gin is producing.
- **Must coordinate** (back to spawner, before acting): abandoning the purpose, materially changing the deliverable shape, contradicting an explicit instruction in the charter, taking a load-bearing decision the charter didn't anticipate.
- **Must escalate** (to Lihu via the spawner): anything touching production code (`nextjs-app/`, `python-services/`), deploys, customer data, secrets, or `CLAUDE.md` in the production tree (per `usegin/Gin.md`). Also anything that would change a load-bearing principle or skill.

The envelope is *part of the charter* (per the `charter` skill's seven blocks). It is *also* part of the spawning skill's spec — every skill that fans out (`rnd`, `brainstorm`, `refine`, `prioritize`, `liaison`, `cell`, `teamwork`, `tdd-execute`, `build-orchestrate`, `consult`) carries a default envelope, which a charter can sharpen but not loosen.

When a skill's default envelope is missing or fuzzy: that's a tikur-class friction the next time a sub-Gin steps outside it. Fix the skill, not the next charter.

## Threading

↑z023 (charter is the instantiation) · ~z020 (decision shape) · ~z029 (sub-Gins lack Agent tool) · ~z027 (CAN ≠ SHOULD) · ~principle 05 #1 #6 #11 · ~`charter` skill.

## Source

War research SYNTHESIS §3 #5 (`usegin/research/war-management/SYNTHESIS.md`). PO"SH C2 decision-rights matrix + Mission Command #6.
