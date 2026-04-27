---
name: charter
description: Emit a sub-Gin charter in the canonical Auftragstaktik shape — purpose / key tasks / end state, doctrinal-pointer block, Selbständigkeit clause, decision-rights envelope, fresh-Haiku test. Use this whenever a spawner skill (rnd, brainstorm, refine, prioritize, liaison, build-orchestrate, cell, teamwork, tdd-execute, consult) is about to write the prompt for a sub-Gin. The charter IS the instantiation (z023); a vague charter is a vague spawn. Triggered by phrases like "write a charter for X", "charter this sub-Gin", "spawn shape", "/charter", or by your own judgment when about to author any agent prompt.
---

# Charter

The shape every sub-Gin spawn carries. Lifted from Mission Command (FM 6-0 + CALL "Less is Better"), IDF TO"L (משימה ולא מטלה), and IAF orient-infrastructure. See `usegin/zettel/principles/05-the-twelve-from-war-research.md` for grounding (principles 1–4, 10).

## When to use

Always — when you are about to author a sub-agent prompt. The charter is the instantiation (z023), and an unstructured prompt is the failure mode the war-research synthesis warns against (C2). Spawner skills (`rnd`, `brainstorm`, `liaison`, `cell`, `tdd-execute`, etc.) call this skill *before* the spawn.

Don't use for: top-level UseGin work in the main thread, or for `Explore` sub-agents whose contract is already a single targeted lookup.

## The seven blocks

Every charter carries seven blocks. Each is short — a vague charter is the failure mode, but so is a charter that becomes the heavy thing it was supposed to replace.

### 1. Purpose (one line)

The *because*. Why this exists at all. Strategic intent the sub-Gin is a continuation of (Clausewitz's "political object"). Not the task — the *reason*.

Example: *"So that next time we hit the autosync race, we recognize the cluster instead of running another standalone tikur."*

### 2. Key tasks (≤3 lines)

What the sub-Gin must accomplish — *outcomes*, not steps. Verbs of completion ("produce X", "decide between Y and Z"), not verbs of motion ("look at", "explore").

Example: *"Read the 4 prior autosync zettels. Categorize each as error/negligence. Emit a meta-zettel naming the cluster."*

### 3. End state (one line)

What "done" looks like — concrete, testable. The sub-Gin should be able to point at the artifact and say "this matches."

Example: *"A z-numbered meta-zettel exists at `usegin/zettel/zettels/`, threaded back to the 4 sources, containing a single-line root-cause statement."*

### 4. Doctrinal-pointer block

The shared training corpus the sub-Gin must read first. Without explicit pointers, decentralized initiative produces *divergent* action, not coherent action (principle 4 — *the corpus is our Truppenführung*).

Always include:
- `usegin/Gin.md` (the umbrella spirit + 3 load-bearing principles)
- `usegin/zettel/principles/05-the-twelve-from-war-research.md` (full doctrine)
- The relevant sub-app `CLAUDE.md` (`usegin/zettel/CLAUDE.md`, `usegin/research/CLAUDE.md`, etc.) — whichever the sub-Gin will be working in.

Add per work class:
- For tikur work: `.claude/skills/tikur/SKILL.md`, the prior records under `.claude/tikur-records/`.
- For zettel work: `usegin/zettel/zettels/README.md`, `usegin/zettel/organizing-process.md`.
- For research: the relevant `usegin/research/<topic>/README.md`.
- For shipping: relevant `CLAUDE.md` in the production tree, the relevant skills.
- For orchestration: `usegin/zettel/zettels/z029` (sub-Gins lack Agent tool), z030 (harness denials), `reference_autosync_concurrent_collisions`.

### 5. Selbständigkeit clause (verbatim)

> *You are obligated to deviate from the literal task if it stops serving the purpose.* (z023, IDF TO"L *rosh-gadol* — own the goal, not the words.) If the purpose can be served better by a different approach than the one in §2, take the better approach and report what you changed and why.

This is *forbidden* to soften. Without it, the sub-Gin reverts to *rosh-katan* literal execution and produces well-executed irrelevance.

### 6. Decision-rights envelope (3 lines)

What the sub-Gin can decide on its own, what it must coordinate, what it must escalate. Currently implicit per-skill — making it explicit catches a class of friction Lihu currently absorbs as "the agent did something it shouldn't have." See PO"SH C2 doctrine in the war research.

Template:
- **Can decide alone:** scope/structure of the deliverable, ordering of work, which zettels to thread, how to phrase findings.
- **Must coordinate (with the spawner before acting):** abandoning the purpose, changing the deliverable shape entirely, contradicting an explicit instruction in this charter.
- **Must escalate (to Lihu via the spawner):** anything that touches production code, deploys, customer data, secrets, or `CLAUDE.md` in the production tree (per `usegin/Gin.md`).

### 7. Fresh-Haiku test (operational gate)

Before sending the charter, read it back as if you were a fresh Haiku-class sub-Gin with no session context. If you would need a glossary, rewrite the charter — never the glossary (principle 3).

Specifically: every term that's UseGin-internal (rnd, tikur, lekach, zettel, principle 05, z028, z030, etc.) must either (a) be defined in §1–§3 or (b) be reachable from §4. No untranslated UseGin slang.

## Output format

When this skill is invoked from inside another skill, emit the charter as a single block in the spawner's prompt to the sub-Gin. Keep the block labeled — sub-Gins read structure.

```markdown
## Charter

**Purpose.** <one line>

**Key tasks.**
1. <verb of completion>
2. <verb of completion>
3. <verb of completion>

**End state.** <one line, testable>

**Doctrinal pointers.** Read first:
- usegin/Gin.md
- usegin/zettel/principles/05-the-twelve-from-war-research.md
- <sub-app CLAUDE.md>
- <work-class-specific pointers>

**Selbständigkeit.** You are obligated to deviate from the literal task if it
stops serving the purpose. (z023, IDF TO"L rosh-gadol.) If the purpose can be
served better by a different approach than the one above, take the better
approach and report what you changed and why.

**Decision rights.**
- Can decide alone: <scope-shaped list>
- Must coordinate: <scope-shaped list>
- Must escalate: <scope-shaped list>

**Fresh-Haiku check.** [present-tense, only when authoring — strip from the
emitted charter.]
```

## Aharai (אחריי) — pair with this skill

Charter shape is necessary; agent selection is also load-bearing. Aharai (principle 10) says: strongest agent goes first into the unknown. When a charter targets a *load-bearing* or *novel* problem (the answer changes downstream decisions), spawn an Opus-class sub-Gin. When the charter is *clear-cut routine* (formatter pass, file move, well-trodden synthesis), Haiku is fine.

Don't send Haiku to scout a load-bearing decision and "promote" to Opus later — by then the terrain is already mis-mapped.

## Anti-patterns

- **Single-line task with no purpose.** "Summarize the war research." → vague *because*; sub-Gin can't tell when it's done.
- **Steps masquerading as tasks.** "Read X, then look at Y, then think about Z." → motion verbs; replace with completion verbs.
- **Doctrinal pointers omitted "to keep it short".** Without them, sub-Gins re-derive shared training and disagree on basics. Truppenführung is non-negotiable.
- **Soft Selbständigkeit.** "Try to deviate if needed." → reads as permission to comply; replace with the verbatim obligation.
- **Implicit decision rights.** Save Lihu the friction of explaining after-the-fact why the sub-Gin shouldn't have force-pushed.
- **Charter without fresh-Haiku check.** UseGin slang is invisible to sub-Gins.

## Distill into the corpus

When a charter pattern works repeatedly for the same work class (e.g., "this is the third tikur charter and they all ended up identical"), distill the shape into the relevant skill's spawn template — not into the charter skill itself. The charter skill is the *meta-shape*; per-skill templates are how it lands.

## Threading
↑z023 (the charter is the instantiation) · ~`rnd` skill · ~`brainstorm` skill · ~`liaison` skill · ~`cell` skill · ~`tdd-execute` skill · ~`build-orchestrate` skill · ~principle 05 (full doctrine) · ~Gin.md.
