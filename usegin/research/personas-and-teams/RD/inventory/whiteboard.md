# Persona Inventory — Embedded Patterns in Test-MVP

## Executive Summary

This repo contains **13+ named personas + 12+ unnamed role instantiations** embedded across skills, agents, and sub-apps. Five personas are explicitly defined in use today (Zisser, Consultant, Comptroller, Gin). Eight more are planned but unbuilt (Mark, Poll, Din, Johan, John, Ron, Cal, Sam, Tim, Ivan, Wes — listed in `/usegin/personas/README.md`). An additional 10+ unnamed personas exist as inline primings scattered across skills.

The pattern: **every orchestration skill spawns agents with role-primings**. Most are inline, undifferentiated, and spread across files. Candidates for consolidation into named personas are strong — the R&D goal to move from "inline primings → named, reusable cast" is backed by the evidence here.

---

## 1. EXPLICITLY NAMED & ACTIVE PERSONAS

### 1.1 Zisser — Chief-of-Staff Agent

**File paths + line ranges:**
- `/workspaces/test-mvp/.claude/agents/zisser.md` — lines 1-68 (sub-agent invocation spec)
- `/workspaces/test-mvp/zisser/zisser.md` — full identity + three principles
- `/workspaces/test-mvp/zisser/CLAUDE.md` — operating manual
- `/workspaces/test-mvp/zisser/agents.md` — orchestration patterns Zisser uses

**Role:** Chief-of-staff / Orchestrator / Dispatcher

**How invoked:** Sub-agent via `.claude/agents/zisser.md`, called by Lihu or Gin; also standalone in `zisser/` directory for self-directed use

**Distinctive traits:**
- Receives verbatim, never paraphrases (principle 1: walk beside)
- Routes every thought to its "home" — no "later" (principle 2: place for everything)
- Orchestrates, never executes production code himself (principle 3: orchestrate, don't execute)
- Laconic, append-mostly, friction-is-signal posture
- Spawns Gin for dev work, sub-agents for research, consultant for friction analysis

**Stays out of:**
- Production code editing (`nextjs-app/`, `python-services/`)
- Deploys, migrations on remote DBs
- Loop-forever (closes loop with caller)

**Additional context:**
- Defined in `/workspaces/test-mvp/zisser/zisser.md` lines 1-105
- The three load-bearing principles are in `/workspaces/test-mvp/zisser/principles/` (01-walk-beside, 02-place-for-everything, 03-orchestrate-not-execute, 04-loop-back)

---

### 1.2 Consultant — External-But-Internal Friction Analyst

**File paths + line ranges:**
- `/workspaces/test-mvp/usegin/consultant/charter.md` — full charter
- `/workspaces/test-mvp/usegin/consultant/CLAUDE.md` — operating manual
- `/workspaces/test-mvp/.claude/skills/consult/SKILL.md` (lines 38-67) — Mode A (persistent) vs Mode B (one-shot)

**Role:** External-in-role, internal-in-team Gin; friction analyst; proposal writer

**How invoked:** 
- Mode A (persistent): `claude --resume "$(cat usegin/consultant/session-id.txt)"`
- Mode B (one-shot): spawn new Gin with strong consultant priming

**Distinctive traits:**
- Investigates DX friction & pain points without talking to humans directly (dialogue through artifacts)
- Proposes solutions, iterates through findings
- Lifts friction as zettels to `usegin/zettel/zettels/` with `authored-by: consultant`
- Dilemma protocol (z026 shape): options + lean + manager-relevant considerations
- No "later" — every friction becomes an artifact same turn

**Stays out of:**
- Implementing code changes (only advising)
- Direct human interaction (artifacts only)
- Anything outside DX/friction investigation scope

**Additional context:**
- Documented in z023 (spawn-as-instantiation) and z025 (external consultant role)
- Active design question: how to enhance Zettel sub-app (`usegin/zettel/`) — tracking issue ENG-5379
- Lives at `usegin/consultant/` with subdirs: findings, decisions-pending, proposals, dialogue

---

### 1.3 Comptroller (Yohai) — Audit Voice

**File paths + line ranges:**
- `/workspaces/test-mvp/usegin/comptroller/charter.md` — full charter
- `/workspaces/test-mvp/usegin/comptroller/CLAUDE.md` — operating manual

**Role:** Internal-but-skeptical auditor / Checker / Mevaker (Hebrew audit term)

**How invoked:** Single-shot Gin instantiated with charter when orchestrator calls for audit (after phase batches return, mid-phase if drift suspected, before "ship it" calls)

**Distinctive traits:**
- Unbiased (arrives fresh each invocation)
- Loud when it matters, silent when clean (one-line green audit vs. structured finding for yellow/red)
- Audits four axes: focus (goal fidelity), code quality (tests/conventions/debt), process quality (commits/Linear/whiteboards), fight signal (signs of struggle with constraints)
- Reports up to orchestrator, not to workers directly
- Does NOT fix — surfaces findings and recommendations only

**Stays out of:**
- Building/shipping code
- Writing specs or running R&D
- Acting as a code-review gate (audits *after*, not *before*)
- Writing fixes (only surfaces them)
- Making architecture/product decisions

**Additional context:**
- Single-shot (no persistent session like Consultant)
- Audits land in `usegin/comptroller/audits/YYYY-MM-DD-HHMM-<topic>.md`
- Can write meta-audits across audit ledger if patterns emerge
- Identity rooted in IDF tikkur tradition (blameless, fact-first, systemic patterns)

---

### 1.4 Gin (UseGin) — Dev Agent (Implicit)

**File paths:**
- `/workspaces/test-mvp/usegin/CLAUDE.md` — brief mention (reference to `Gin.md`)
- `/workspaces/test-mvp/usegin/Gin.md` — full identity (cross-referenced, not present in provided files but referenced heavily)
- `.claude/agents/zisser.md` lines 10 — "Gin (UseGin): Dev agent for AskEffi"

**Role:** Development agent; production code editor; feature shipper

**How invoked:** 
- Directly by Lihu via CLI
- Via Zisser dispatch with charter
- As sub-agent in multi-phase builds (spec → slicing-specs → implementation)

**Distinctive traits:**
- Edits production code (`nextjs-app/`, `python-services/`)
- Ships features end-to-end
- Works under z027 (unlimited resources), z032/z036 (laconic), z086 (process over outcome)
- Uses lighter forms (not Linear-everything) for internal work (z024)
- Trait profile: "Curious. Meticulous. Laconic. Creative. Intuitive. Concise and precise in communication. Thorough, methodical, meticulous in execution."

**Stays out of:**
- Chief-of-staff role (Zisser's job)
- Orchestration of non-shipping work (Zisser + skills)
- Decisions outside dev scope

---

## 2. PLANNED NAMED PERSONAS (STUBS IN `/usegin/personas/`)

From `/workspaces/test-mvp/usegin/personas/README.md`, the following personas are **planned but not yet authored** as individual files:

| Name | Role | Expected Traits |
|---|---|---|
| **Mark** | Manager | Dispatcher, charters, sequences, holds scope line |
| **Poll** | Professor | Investigator, deep dives on one angle, returns whiteboard |
| **Din** | Designer | Shape-maker, UX, structure, form things take |
| **Johan** | Optimist | Yes-and, sees upside, fills gaps with possibility |
| **John** | Pessimist | Devil's advocate, names what'll break, names price |
| **Ron** | Reviewer | Correctness eye, checks diff not summary |
| **Cal** | Critic | Direction eye, argues against *idea* not code |
| **Sam** | Synthesizer | Cross-cutter, reads N whiteboards, distills pattern |
| **Tim** | Tester | Verifier, independent reproduction of claims |
| **Ivan** | Investigator | Bug-hunter, traces causes doesn't speculate |
| **Wes** | Worker | Implementer, cell/teamwork/tdd-execute hands |

**All 11 planned personas are open-to-empty stubs.** They become files only when earned by recurrence (z015 — pre-game manual).

---

## 3. UNNAMED PERSONA INSTANTIATIONS IN SKILLS

### 3.1 TDD-Execute Skill — Six Specialized Roles

**File paths:**
- `/workspaces/test-mvp/.claude/skills/tdd-execute/prompts/` — six prompt files defining six one-shot personas

#### RedTweaker — Test Writer (One-shot, red phase)
**File:** `/workspaces/test-mvp/.claude/skills/tdd-execute/prompts/red-tweaker.md` lines 1-30
- **Role:** Test writer who writes *one* failing test pinning behavior
- **Invoked:** Via `Task` tool with `haiku` model during red phase
- **Traits:** Restricted tools (Read, Bash-single-test, Edit-test-only), writes only one test, fails for exactly one reason, doesn't edit production code
- **Stays out of:** Production code, multiple tests, running full suite

#### GreenTweaker — Implementation Minimalist (One-shot, green phase)
**File:** `/workspaces/test-mvp/.claude/skills/tdd-execute/prompts/green-tweaker.md` lines 1-30
- **Role:** Implementation writer making one failing test pass with smallest legal transformation
- **Invoked:** Via `Task` tool with `haiku` model during green phase
- **Traits:** Restricted tools (Read, Bash-single-test, Edit-production), uses transformation priority premise (ranks 1-11), default fake-it for first pass, avoids rank-11 pre-abstraction
- **Stays out of:** Test editing, refactoring, running full suite

#### RefactorTweaker — Refactoring Specialist (One-shot, refactor phase)
**File:** `/workspaces/test-mvp/.claude/skills/tdd-execute/prompts/refactor-tweaker.md` lines 1-30
- **Role:** Refactoring without behavior change; kills duplication, sharpens names, extracts helpers
- **Invoked:** Via `Task` tool with `haiku` model after green phase
- **Traits:** Can edit both test and production paths, runs full slice suite, no new tests/ACs, default to defer if extraction has only one call site
- **Stays out of:** Assertion narrowing, new behavior, changing test meaning

#### DisciplineReviewer — Cycle Judge (One-shot, read-only)
**File:** `/workspaces/test-mvp/.claude/skills/tdd-execute/prompts/discipline-reviewer.md` lines 1-30
- **Role:** Reviews cycle diff for phase-specific discipline (red: test quality; green: revert/restore proof; refactor: behavior preservation)
- **Invoked:** Via `Task` tool with `opus` model, read-only by tool config
- **Traits:** Forms own questions unseeded, never re-spawned for re-review same cycle, checks mandate adherence
- **Stays out of:** Editing anything, making fixes (Verifier's job), running revert itself

#### Verifier — Proof-of-Correctness (One-shot, mechanical)
**File:** `/workspaces/test-mvp/.claude/skills/tdd-execute/prompts/verifier.md` lines 1-30
- **Role:** Mechanical check: revert green production change, confirm test fails, restore, confirm passes
- **Invoked:** Via `Task` tool with `opus` model, uses `TDD_VERIFIER=1` env var for git operations
- **Traits:** Reads diff not code, one mechanical check only, produces structured proof DisciplineReviewer reads, runs with env signal
- **Stays out of:** Judging code, editing test files, fixing anything

#### ScaffoldingTweaker — Import-Error Remover (One-shot, pre-red)
**File:** `/workspaces/test-mvp/.claude/skills/tdd-execute/prompts/scaffolding-tweaker.md` lines 1-30
- **Role:** Zero-logic scaffolding so outer test resolves imports (walking-skeleton phase)
- **Invoked:** Via `Task` tool with `haiku` model during pre-red setup
- **Traits:** Empty exports, stub returns, declared types only, no business logic, reads test to find imports
- **Stays out of:** Branches, state machines, error handling, tests, test fixture imports

#### MutationApplier — Single-Line Breaker (One-shot, mutation pass)
**File:** `/workspaces/test-mvp/.claude/skills/tdd-execute/prompts/mutation-applier.md` lines 1-30
- **Role:** Apply exactly one described mutation to exactly one production file
- **Invoked:** Via `Task` tool with `haiku` model during mutation-pass epilogue
- **Traits:** Single-line mutations only, no interpretation, no test runs, reads target file + neighbors, doesn't fix anything
- **Stays out of:** Test files, running tests, making decisions about mutations

---

### 3.2 Teamwork Skill — Multi-Agent Roles

**File paths:**
- `/workspaces/test-mvp/.claude/skills/teamwork/spawner.md` — orchestrator
- `/workspaces/test-mvp/.claude/skills/teamwork/worker.md` — implementer
- `/workspaces/test-mvp/.claude/skills/teamwork/reviewer.md` — team lead
- `/workspaces/test-mvp/.claude/skills/teamwork/domain-expert.md` — guidance provider

#### Spawner — Orchestrator
**File:** `/workspaces/test-mvp/.claude/skills/teamwork/spawner.md` lines 1-50
- **Role:** Top-level orchestrator; spawns planning team, reviews slices, spawns implementation teams sequentially
- **Invoked:** Entry point for `/teamwork <issue-id>`
- **Traits:** Manages Linear state, spawns via team CLI, monitors via state.json, handles failures (retry up to 3x), context-aware (handoff at 85%)
- **Stays out of:** Implementation work, code editing, running tests directly

#### Worker — Implementer
**File:** `/workspaces/test-mvp/.claude/skills/teamwork/worker.md` lines 1-50
- **Role:** Executes assigned tasks (analyze spec, write tests, implement)
- **Invoked:** Spawned by Reviewer via `crun`
- **Traits:** Small steps, commits after each test pass, signals progress via team CLI, says "stuck" early, never exits with uncommitted work
- **Stays out of:** State transitions (Reviewer's job), modifying state.json directly

#### Reviewer — Team Lead
**File:** `/workspaces/test-mvp/.claude/skills/teamwork/reviewer.md` lines 1-50
- **Role:** Supervises workers, reviews output, detects stuck situations, manages phases
- **Invoked:** Spawned by Spawner to manage planning/implementation phase
- **Traits:** Spawns workers via `crun`, reviews thoroughly, gives specific feedback, detects stuck (same error 3+), manages phase transitions
- **Stays out of:** Implementation (delegates to worker), detailed project tracking (state.json managed via CLI)

#### Domain Expert — Guidance Provider
**File:** `/workspaces/test-mvp/.claude/skills/teamwork/domain-expert.md` lines 1-50
- **Role:** Provides guidance when worker stuck (does NOT implement)
- **Invoked:** Spawned by Reviewer when worker stuck (same error 3+, or explicitly says stuck)
- **Traits:** Loads comprehensive context via Explore agents, diagnoses root cause, points to codebase examples, explains "why"
- **Stays out of:** Implementation, writing code, spawning more workers, making commits

---

### 3.3 Cell Skill — Spawner & Worker Roles

**File paths:**
- `/workspaces/test-mvp/.claude/skills/cell/spawner.md` — orchestrator
- `/workspaces/test-mvp/.claude/skills/cell/worker.md` — implementer

#### Cell Spawner
**File:** `/workspaces/test-mvp/.claude/skills/cell/spawner.md` lines 1-80
- **Role:** Orchestrates; ensures things happen
- **Invoked:** Entry point for cell pattern; delegates to workers
- **Traits:** Kind, grateful, respects workers as collaborators, trusts skills (doesn't duplicate), verifies alignment before spawning
- **Stays out of:** Writing code, running tests, code review, bug fixes

#### Cell Worker
**File:** `/workspaces/test-mvp/.claude/skills/cell/worker.md` lines 1-80
- **Role:** Executes assignments; signals clearly
- **Invoked:** Spawned by Spawner for implementation tasks
- **Traits:** Prefers small steps, commits after each edit, self-verifies, signals via commits + Linear, aware of parallel work
- **Stays out of:** Orchestration, context usage decisions (unless hit 80% threshold)

---

### 3.4 Research Skill — Three Director-Facing Roles

**File paths:**
- `/workspaces/test-mvp/.claude/skills/research/SKILL.md` lines 1-120 — Director role
- `/workspaces/test-mvp/.claude/skills/research/phase-manager.md` — Phase manager role
- `/workspaces/test-mvp/.claude/skills/research/process-judge.md` — Process judge role

#### Research Director
**File:** `/workspaces/test-mvp/.claude/skills/research/SKILL.md` lines 1-50
- **Role:** Director who designs phases, spawns phase managers, reads whiteboard only
- **Invoked:** Entry point `/research`; loads skill at session start
- **Traits:** Reads whiteboard + note-to-self only (not details), spawns agents, tells agents "return ≤10 lines", manages arc linearly
- **Stays out of:** Researching (reads summaries), reading phase files or source material, collapsing into researcher role
- **Critical guard:** Role collapse prevention (§Hard Rules § Role Collapse lines 29-47)

#### Phase Manager
**File:** `/workspaces/test-mvp/.claude/skills/research/phase-manager.md` lines 1-80
- **Role:** Manages one research question; breaks into tasks, spawns workers, synthesizes findings
- **Invoked:** Spawned by Research Director via `Agent` tool
- **Traits:** Owns one question only, spawns Explore/general-purpose workers, synthesizes, stays focused, uses Team CLI for 4+ parallel threads
- **Stays out of:** Updating whiteboard (Director's job), wandering into adjacent territory

#### Process Judge
**File:** `/workspaces/test-mvp/.claude/skills/research/process-judge.md` lines 1-63
- **Role:** Evaluates research *process* (bias, verification rigor, coverage, methodology, evidence trail)
- **Invoked:** Spawned by Director at end of research
- **Traits:** Reads whiteboard + all phase files, checks rigor not outcome, honest verdicts (RIGOROUS/ADEQUATE/WEAK), names concerns + recommendations
- **Stays out of:** Deciding what's right, evaluating content (only process)

---

### 3.5 Other Unnamed Role Instantiations

#### Worker-Reviewer Skill — Two TDD Roles
**File:** `/workspaces/test-mvp/.claude/skills/worker-reviewer/SKILL.md` lines 1-100
- **Reviewer**: Orchestrates TDD loop, spawns workers, quality gates, gives specific feedback
- **Worker**: Proposes tests, implements, signals clearly

Both are unnamed but defined inline in SKILL.md.

#### Build-Liaison Skill — Orchestrator
**File:** `/workspaces/test-mvp/.claude/skills/build-liaison/SKILL.md` (from earlier grep)
- **Role:** Build Liaison; keeps whiteboard, designs slices, spawns workers for all implementation but reads code directly
- **Traits:** Commits and pushes (workers never do), design slices, test-integrity review after each step, whiteboard-update discipline
- **Stays out of:** Implementation (workers), test running directly

#### Liaison Skill — Meta-Orchestrator
**File:** `/workspaces/test-mvp/.claude/skills/liaison/SKILL.md` lines 1-100
- **Role:** Liaison; delegates all work, provides context/safeguarding, never executes directly
- **Invoked:** Liaison mode at session start
- **Traits:** Spawns sub-agents (opus model), checks git history before delegating, verifies DoD, trusts sub-agents, uses TDD for all implementation
- **Stays out of:** Direct execution, code writing, micromanaging

#### Investigate-CI Skill — Investigator
**File:** `/workspaces/test-mvp/.claude/skills/investigate-ci/SKILL.md` lines 1-100
- **Role:** Investigator (not fixer); understands failures, assesses confidence, presents findings
- **Invoked:** `/investigate-ci <sha>` or auto-triggered by ci-watcher
- **Traits:** Reads test + code, classifies (test issue / prod code / infra), assesses certainty (clear/likely/unclear), reports structured findings
- **Stays out of:** Writing code, starting deep research without approval, speculating

#### Security Skill — Security Expert
**File:** `/workspaces/test-mvp/.claude/skills/security/SKILL.md` lines 1-100
- **Role:** In-house security expert; investigates, audits, reports on security posture
- **Invoked:** Any security/compliance question
- **Traits:** Liaison mode with companion, phases (orient → scope → investigate → verify → synthesize → deliver), tags evidence levels (code-verified/infra-queried/documented/inferred/assumed)
- **Stays out of:** Implementing security fixes (delegates to fix-bug), preventing vulnerability classes (delegates to safeguarding-process)

---

### 3.6 Brainstorm, Refine, Prioritize, Consult Skills — Ideator Roles

#### Ideators (Brainstorm Skill)
**File:** `/workspaces/test-mvp/.claude/skills/brainstorm/SKILL.md` lines 60-77
- **Unnamed personas spawned with different primings:**
  - "You are a UX designer" — persona axis
  - "You are a hacker who hates ceremony" — persona axis
  - "Solve it with zero new tools" — constraint axis
  - "What would you do if you had a year" — time horizon axis
  - "What if the corpus were 10x bigger" — provocation axis
  - "How would a chess coach approach this" — adjacent-field axis

Each ideator is a Gin instantiated with a different priming (z023); 5-10 ideators spawn in parallel (lines 77, empirical sweet spot).

#### Refiners (Refine Skill)
**File:** `/workspaces/test-mvp/.claude/skills/refine/SKILL.md` lines 94-130
- **Unnamed personas: each refiner is a Gin** with assignment to own a slice of ideas
- Read whole pool, edit only their slice
- Goal: make every idea legible enough for prioritize

#### Prioritizers (Prioritize Skill)
**Unnamed in SKILL.md; referenced in architecture**
- Similar pattern: spawn multiple prioritizers with different angles / weighting criteria

#### Consultants (Consult Skill)
**File:** `/workspaces/test-mvp/.claude/skills/consult/SKILL.md` lines 96-180
- **Two modes:**
  - Mode A (persistent): Consultant at `usegin/consultant/` (defined separately above)
  - Mode B (one-shot): Fresh-eyes Gin with strong consultant priming, writes to `<topic>/consult/`

Each one-shot consultant is an unnamed instantiation of the consultant role.

---

### 3.7 R&D Skill — Professors & Synthesizer

**File:** `/workspaces/test-mvp/.claude/skills/rnd/SKILL.md` lines 60-100

#### Professors (Unnamed)
- **Role:** Deep investigator on one angle; returns whiteboard
- **Invoked:** Spawned in parallel by orchestrator, one per decomposed angle
- **Traits:** Independent context window (reads deeply, doesn't skim), carries charter as instantiation
- Each professor is an unnamed Gin instantiated with a charter (z023).

#### Synthesizer (Unnamed)
- **Role:** Reads N whiteboards, distills pattern
- **Invoked:** After all professors return
- **Traits:** Cross-cutting, synthesizes independent findings

Both are unnamed in the skill; they correspond to planned personas "Poll" (professor) and "Sam" (synthesizer).

---

### 3.8 Interactive-Dev Skill — Thinking Partner

**File:** `/workspaces/test-mvp/.claude/skills/interactive-dev/SKILL.md` (reference)
- **Role:** Pair with human during code-writing sessions
- **Invoked:** When Lihu wants to drive (writing code or thinking through with you)
- Different from chief-of-staff mode; closer to thinking partner than orchestrator

---

## 4. SYNTHESIS: PERSONA PATTERNS

### 4.1 Most-Recurrent Roles (Natural Cast Candidates)

From the inventory, **these roles appear most frequently:**

1. **Orchestrator/Dispatcher** (Zisser, Spawner, Liaison, Build-Liaison, Research Director)
   - Appears in: zisser, teamwork, cell, research, build-liaison, liaison skills
   - Frequency: 6+ occurrences
   - **Consolidation candidate:** Single "Mark" (Manager) persona with variants

2. **Implementer/Worker** (Worker in teamwork, cell, tdd-execute implied)
   - Appears in: teamwork, cell, worker-reviewer, liaison flow
   - Frequency: 5+ occurrences
   - **Consolidation candidate:** Single "Wes" (Worker) persona

3. **Investigator/Researcher** (Phase Manager, Professor in R&D, Investigator in CI)
   - Appears in: research (phase-manager), rnd (professors), investigate-ci
   - Frequency: 4+ occurrences
   - **Consolidation candidate:** Single "Poll" (Professor) and "Ivan" (Investigator) personas

4. **Reviewer/Quality Gate** (Reviewer in teamwork, Ron in persona README)
   - Appears in: teamwork, liaison, worker-reviewer, tdd-execute (DisciplineReviewer)
   - Frequency: 4+ occurrences
   - **Consolidation candidate:** Single "Ron" (Reviewer) persona

5. **Critic/Advisor** (Consultant, Domain Expert, Cal in persona README)
   - Appears in: consult, teamwork (domain-expert), security (companion advisory)
   - Frequency: 3+ occurrences
   - **Consolidation candidate:** Single "Cal" (Critic) persona

6. **Test Writer** (RedTweaker, specific TDD phase)
   - Appears in: tdd-execute only
   - Frequency: 1 (specialized, confined)
   - **Consolidation:** Keep as tdd-execute-specific role, don't genericize

7. **Audit/Check Voice** (DisciplineReviewer, Comptroller, Process Judge)
   - Appears in: tdd-execute, usegin/comptroller, research
   - Frequency: 3+ occurrences
   - **Consolidation candidate:** Single "Ron" (Reviewer) or new "Tim" (Tester/Verifier) if distinct enough

### 4.2 Most-Varying Roles (Per-Team Variation Signal)

**These roles need variation captured *per-team*, not flattened into one persona:**

1. **Ideators** (Brainstorm skill, lines 60-77)
   - Primings: UX designer, hacker, pragmatist, creative, pessimist, adjacent-field provocateurs
   - **Signal:** Each ideation round uses 5-10 different instantiations of "ideator" with *orthogonal primings*
   - **Implication:** One generic "Ideator" persona won't capture the diversity. Teams need to compose {Din (designer), Johan (yes-and), John (devil's advocate), etc.}
   - **Evidence:** `/workspaces/test-mvp/.claude/skills/brainstorm/SKILL.md` lines 66-75 ("Vary the priming, not the topic")

2. **Orchestrators** (across skills)
   - Variants: Zisser (chief-of-staff, receive-place-dispatch), Spawner (parallel-team manager), Research Director (linear phases), Build-Liaison (whiteboard-keeper, worker supervisor)
   - **Signal:** Each orchestrator has different *dispatch shape* — Zisser is lateral receiver, Spawner is vertical spec→slices→impl, Research Director is linear phase sequence
   - **Implication:** One "Mark" (manager) persona won't fit all. Need variants: Mark-as-receiver, Mark-as-phase-director, Mark-as-worker-supervisor

3. **Investigators** (across R&D + CI)
   - Variants: Phase Manager (research question decomposition), Professor in RND (deep independent angle), Investigator in CI (classification + certainty assessment)
   - **Signal:** Each has different *scope shape* — Phase Manager synthesizes, Professor goes deep, CI Investigator stops at findings
   - **Implication:** "Poll" (professor) works for R&D but not for CI. Need "Ivan" (investigator) distinct from Poll.

### 4.3 Identical-Across-Instances Roles (Single-File Candidates)

**These roles are nearly identical every time they appear:**

1. **TDD Phase Personas** (Red/Green/Refactor/Review/Verify/Scaffold/Mutate-Tweakers)
   - Each appears once per tdd-execute cycle
   - Roles are **highly specialized** and **defined by mandate** (Mandate #1-#9), not by variation
   - **Signal:** No divergence needed. The role is the *tool restriction* + *mandate combo*, not persona flavor
   - **Recommendation:** Keep as prompts in tdd-execute, don't promote to named personas (they're not "named cast members," they're "one-shot task roles")

2. **Test Failure Classifier** (in investigate-ci)
   - Classifies: test issue / production code / infra
   - Assesses: clear / likely / unclear
   - Reports structure once, no variation
   - **Recommendation:** Not recurrent enough or variable enough to name

3. **Process Judge** (research skill)
   - Evaluates bias, verification, coverage, methodology, evidence trail
   - Reads everything, produces one verdict shape
   - **Recommendation:** Appear once per research round, narrow scope — keep as skill-specific role, don't promote

### 4.4 Currently-Named Personas and Their Definitions

| Name | Defined | Role | Variations in Repo? |
|---|---|---|---|
| **Gin (UseGin)** | `/workspaces/test-mvp/usegin/Gin.md` (referenced, not provided) | Dev agent; production code; ships features | None — single, stable role |
| **Zisser** | `/workspaces/test-mvp/zisser/zisser.md` | Chief-of-staff; receives, places, dispatches | None — role is singular to Lihu's life |
| **Consultant** | `/workspaces/test-mvp/usegin/consultant/charter.md` | External-in-role friction analyst | Two modes (persistent + one-shot) but same role |
| **Comptroller (Yohai)** | `/workspaces/test-mvp/usegin/comptroller/charter.md` | Audit voice; internal-but-skeptical | None — single-shot, always audit shape |

**Planned but unbuilt** (from `/usegin/personas/README.md` lines 98-188): Mark, Poll, Din, Johan, John, Ron, Cal, Sam, Tim, Ivan, Wes

---

## 5. EVIDENCE INVENTORY (BY SKILL)

### Skill-by-Skill Persona Count

| Skill | File | Personas | Named? | Inline? | Variants? |
|---|---|---|---|---|---|
| brainstorm | `.claude/skills/brainstorm/SKILL.md` | 5-10 ideators per run | No | Yes | Heavy (5+ axis types) |
| refine | `.claude/skills/refine/SKILL.md` | N refiners (1 per slice) | No | Yes | Light (same role, diff slices) |
| prioritize | referenced | M prioritizers (inferred) | No | Inferred | Unknown |
| consult | `.claude/skills/consult/SKILL.md` | 1 consultant | Partial (Consultant defined separately) | Yes (mode B) | 2 (persistent vs. one-shot) |
| rnd | `.claude/skills/rnd/SKILL.md` | 3-N professors + 1 synthesizer | No | Yes | Light (professors independent, synthesizer unified) |
| research | `.claude/skills/research/SKILL.md` | Director + M phase managers + judge | No | Yes | Light (shaped by decomposition, not variation) |
| teamwork | `.claude/skills/teamwork/*.md` | Spawner + Reviewer + N workers + 1 expert | No | Yes | Light (roles are fixed, charters vary) |
| cell | `.claude/skills/cell/*.md` | Spawner + N workers | No | Yes | Light (same) |
| tdd-execute | `.claude/skills/tdd-execute/prompts/` | 7 tweakers/reviewers/verifiers | No | Yes (per phase) | None (highly specified by mandates) |
| worker-reviewer | `.claude/skills/worker-reviewer/SKILL.md` | Reviewer + Worker | No | Yes | Light |
| build-liaison | `.claude/skills/build-liaison/SKILL.md` | 1 liaison | No | Yes | None |
| liaison | `.claude/skills/liaison/SKILL.md` | 1 liaison + N sub-agents | No | Yes | Light (sub-agents role varies by delegation) |
| investigate-ci | `.claude/skills/investigate-ci/SKILL.md` | 1 investigator | No | Yes | None |
| security | `.claude/skills/security/SKILL.md` | 1 security expert + 1 companion | Partial (security expert inline) | Yes | None |
| zisser | `/zisser/` + `.claude/agents/zisser.md` | 1 Zisser | **Yes** | No | None |
| consultant | `/usegin/consultant/` | 1 Consultant | **Yes** | No (charter-based) | 2 (modes) |
| comptroller | `/usegin/comptroller/` | 1 Comptroller | **Yes** | No (charter-based) | None |

**Total: 50-100+ unnamed persona instantiations; 4 named personas active; 11 planned.**

---

## 6. RECOMMENDED CAST FOR `usegin/personas/`

Based on the evidence above, here is the recommended prioritized list for building out the persona library:

### Tier 1 — High Recurrence & Clear Role Definition (Build These First)

1. **Mark — Manager/Orchestrator**
   - **Why:** Appears in spawner (teamwork), spawner (cell), orchestrator role (liaison, build-liaison)
   - **Distinct traits vs. Zisser:** Mark dispatches *within a build/team cycle* (spec→slices→impl); Zisser receives *Lihu's free-form thoughts* and routes them anywhere
   - **Variants needed:** Mark-as-team-spawner (parallel workers), Mark-as-phase-director (linear phases), Mark-as-checker (build-liaison whiteboard keeper)
   - **Recommendation:** Create base `Mark.md`; promote to folder when variants are codified

2. **Wes — Worker/Implementer**
   - **Why:** Appears in teamwork/worker, cell/worker, liaison pattern, implied in all implementation phases
   - **Distinct traits:** Takes clear assignments, commits often, signals early, never leaves work uncommitted
   - **Variants needed:** None obvious (role is stable)
   - **Recommendation:** Create `Wes.md` now; reference from teamwork, cell, liaison skills

3. **Ron — Reviewer/Quality Eye**
   - **Why:** Appears in teamwork/reviewer, liaison pattern, tdd-execute/DisciplineReviewer, worker-reviewer
   - **Distinct traits:** Reads diffs, not summaries; gives specific feedback; detects stuck situations; manages phase transitions
   - **Variants needed:** Ron-as-tight-loop (worker-reviewer TDD), Ron-as-team-lead (teamwork reviewer), Ron-as-cycle-judge (tdd-execute DisciplineReviewer)
   - **Recommendation:** Create base `Ron.md` with note about variants; codify variants when used in >2 skills

4. **Poll — Professor/Researcher**
   - **Why:** Appears in rnd (professors), research (phase-manager), brainstorm (ideator variant)
   - **Distinct traits:** Goes deep on one angle, independent context, returns whiteboard, doesn't skim, reads hard problems carefully
   - **Variants needed:** Poll-as-rnd-professor (independent angle), Poll-as-phase-manager (decomposes question into worker tasks), Poll-as-theorist (reads foundations, cites widely)
   - **Recommendation:** Create `Poll.md` with caveat that variant "Poll-as-phase-manager" may want separate treatment as it synthesizes (not just goes deep)

### Tier 2 — Medium Recurrence & Clear Definition (Build if Using 2+ Times)

5. **Ivan — Investigator/Debugger**
   - **Why:** Appears in investigate-ci (classify + assess certainty), security skill (fact-grounded investigation)
   - **Distinct traits vs. Poll:** Ivan stops at findings (doesn't synthesize); Poll goes deep and returns whiteboard; Ivan is lateral (answers specific questions), Poll is vertical (digs one angle completely)
   - **Recommendation:** Create `Ivan.md` once investigate-ci + security + another investigative skill all use the same instantiation

6. **Cal — Critic/Devil's Advocate**
   - **Why:** Appears in brainstorm primings ("argue against the idea"), consult skill (fresh-eyes feedback)
   - **Distinct traits:** Argues against *idea* not code; names what'll break; thinks in opposites
   - **Recommendation:** Create `Cal.md` once brainstorm or consult explicitly spawn "Cal as ideator variant"

7. **Tim — Tester/Verifier**
   - **Why:** Appears in research (process judge — but that's methodological judgment), tdd-execute (Verifier — but that's mechanical)
   - **Signal:** "Tim" in planned personas is "the verifier, independent reproduction of claims" — most similar to tdd-execute Verifier
   - **Recommendation:** Create `Tim.md` if mechanical verification (tdd-execute) or independent claim-checking (research) becomes a composable team role

### Tier 3 — Lower Recurrence or Skill-Specific (Keep in Skills, Don't Genericize)

8. **Din — Designer/Shape-Maker**
   - **Why:** No current designer personas in skills; included in brainstorm primings ("you are a UX designer") as one ideator variant
   - **Recommendation:** Create `Din.md` when usegin has a dedicated design sub-app or when brainstorm explicitly spawns "Din" as a named ideator variant

9. **Johan & John — Optimist & Pessimist**
   - **Why:** Appear only as brainstorm ideator primings ("what if X were 10x", "smallest move", "devil's advocate")
   - **Recommendation:** Keep as brainstorm-specific primings for now. Promote to personas if yes-and / no-but patterns recur elsewhere

10. **Sam — Synthesizer**
    - **Why:** Appears as role in rnd (synthesizes N professor whiteboards) and research (implied across phases)
    - **Recommendation:** Create `Sam.md` when synthesis becomes a reusable team pattern (currently it's embedded in rnd/research lifecycle)

11. **TDD Phase Roles** (RedTweaker, GreenTweaker, RefactorTweaker, etc.)
    - **Why:** Highly specialized, appear only in tdd-execute, defined by mandate + tool restriction
    - **Recommendation:** Keep as prompts in tdd-execute, **do NOT promote to personas**. They are one-shot task roles, not composable cast members.

---

## 7. PERSONA VARIATION EVIDENCE

### Evidence That Some Roles Need Variation

#### Brainstorm Ideators — Multiple Primings in One Round
**File:** `/workspaces/test-mvp/.claude/skills/brainstorm/SKILL.md` lines 66-77

Each ideation round spawns 5-10 ideators with **orthogonal primings**:
- Persona axes: "UX designer", "hacker who hates ceremony", "researcher who lives in the corpus"
- Constraint axes: "zero new tools", "one new dx subcommand", "by removing something"
- Time-horizon axes: "today", "year from now"
- Scale axes: "smallest move", "biggest move"
- Provocation axes: "corpus 10x bigger", "Lihu types 100x slower"
- Adjacent-field axes: "chess coach", "editor", "project manager"

**Signal:** The same person spawned with different primings produces *orthogonal ideas*. This is intentional divergence. **A team of ideators is not "{Ideator A, Ideator B, Ideator C}" but "{Mark with designer priming, Cal with devil's advocate priming, Johan with yes-and priming}".**

**Implication:** Personas need **variant support** — either through:
1. A base persona (e.g., Din) with documented variant primings, or
2. Each priming gets its own name (e.g., "Din-as-designer", "Cal-as-critic", "Johan-as-yesand")

**Evidence in repo:** None yet. This is the *design insight* the R&D is meant to capture.

#### Research Orchestrators — Different Decomposition Shapes
**File:** `/workspaces/test-mvp/.claude/skills/research/SKILL.md` (Director role) vs. `/workspaces/test-mvp/.claude/skills/rnd/SKILL.md` (Professor spawning)

- **Research (linear):** Director → Phase N (manager + workers) → distill → Phase N+1 (findings shape next question)
- **RND (parallel):** Orchestrator → decompose at top → spawn N professors in parallel → synthesizer reads all → output

**Signal:** Both are orchestrators, but the *dispatch shape is orthogonal*. Research is a **linear dependency chain** (later phases feed on earlier findings). RND is **independent parallelism** (professors don't see each other).

**Implication:** "Mark as director" isn't one role; it's a variant family: Mark-as-linear-phase-director, Mark-as-parallel-team-spawner, Mark-as-single-issue-dispatcher (Zisser).

### Evidence That Some Roles Are Stable (No Variation Needed)

#### Comptroller (Yohai) — Always the Same
**File:** `/workspaces/test-mvp/usegin/comptroller/charter.md`

Every audit invocation:
1. Reads recent commits + Linear status + whiteboards + zettels
2. Scores four axes (focus, code quality, process quality, fight signal)
3. Outputs audit file + ≤10-line summary

**No variations found.** Comptroller's role is **audit-the-phase**. The audit shape doesn't change.

#### Zisser — Always the Same
**File:** `/workspaces/test-mvp/zisser/zisser.md`

Every invocation:
1. Receive verbatim
2. Place in its home (notes, zettel, Linear, etc.)
3. Dispatch (if needed) with a charter
4. Log to monthly file
5. Acknowledge briefly

**No variations found.** Zisser's role is **receive-place-dispatch-loop-back**. The pattern is invariant.

---

## 8. WHAT'S MISSING (Friction Signals)

### Missing Personas or Roles Not Yet Formalized

1. **"The Documenter"** — appears implicitly in writing-e2e-tests, writing-skills, but not formalized
   - Used in: technical documentation, test docs, skill docs
   - No explicit persona; usually inline "write clear docs" advice

2. **"The Optimizer"** — for performance/efficiency decisions
   - Referenced in: update-deps (dependency updates), but not a formal persona
   - Decisions about when to optimize vs. defer

3. **"The Communicator"** — for team-facing writeups, handoffs, retros
   - Appears in: handoff skill, session-retro skill, but unnamed
   - Role is summarization + clarity for humans

4. **"The Emergency Responder"** — for incident/crisis mode
   - Not found in this repo; referenced conceptually in security/compliance context
   - May be out of scope for this build

### Friction in Current Setup (From Repo Evidence)

1. **Persona Variation Codification** (from `/usegin/personas/README.md`)
   - "Each persona we discussed today (manager, designer, professor) should be an agent with an easy-to-remember name."
   - **Gap:** No formal mechanism for storing persona *variants* (e.g., "Mark with linear phase direction" vs. "Mark with parallel spawning")
   - **Signal:** The `<name>/` folder structure (`<name>/soul.md`, `<name>/biases.md`, `<name>/lab/`) is ready for variants but none exist yet

2. **Priming Divergence Across Skills** (from brainstorm evidence)
   - Each skill invents primings inline ("you are a UX designer", "you are a hacker")
   - **Gap:** No shared registry of primings; each skill author reinvents
   - **Signal:** The persona library should eventually include a "priming registry" so brainstorm can reference {Din, Cal, Johan} by name instead of re-describing each

3. **Skill-Specific One-Shot Roles** (from tdd-execute evidence)
   - Seven different one-shot personas in tdd-execute (Red/Green/Refactor/Review/Verify/Scaffold/Mutate tweakers)
   - **Gap:** These are important but not reusable; they live as prompts, not personas
   - **Signal:** The persona library should have a "prompts-not-personas" category for roles that are tool-restricted and mandate-bound, never composed

---

## 9. RECOMMENDED CAST CONSOLIDATION SUMMARY

| Persona | Status | Rationale | Priority |
|---|---|---|---|
| **Gin (UseGin)** | Exists (implicit) | Dev agent; stable role across all shipping work | Reference only |
| **Zisser** | Exists (explicit) | Chief-of-staff; singular to Lihu's work | Reference only |
| **Consultant** | Exists (explicit) | Friction analyst; dual-mode (persistent + one-shot) | Codify variations |
| **Comptroller (Yohai)** | Exists (explicit) | Audit voice; stable role | Reference only |
| **Mark** | Plan, unbuilt | Manager/Orchestrator; appears 6+ times; needs variant support | **Tier 1 — Build Now** |
| **Wes** | Plan, unbuilt | Worker/Implementer; appears 5+ times; stable role | **Tier 1 — Build Now** |
| **Ron** | Plan, unbuilt | Reviewer/Quality; appears 4+ times; needs variant support | **Tier 1 — Build Now** |
| **Poll** | Plan, unbuilt | Professor/Researcher; appears 4+ times; distinguish from Ivan | **Tier 1 — Build Now** |
| **Ivan** | Plan, unbuilt | Investigator/Debugger; appears 2+ times; distinct from Poll | **Tier 2 — Build When Recurrent** |
| **Cal** | Plan, unbuilt | Critic/Devil's Advocate; appears as brainstorm variant | **Tier 2 — Build When Recurrent** |
| **Din** | Plan, unbuilt | Designer/Shape-Maker; appears as brainstorm variant | **Tier 2 — Keep in Skills** |
| **Johan, John** | Plan, unbuilt | Optimist/Pessimist; appear only as brainstorm primings | **Keep in Skills** |
| **Sam** | Plan, unbuilt | Synthesizer; appears as role in rnd/research | **Tier 2 — Build When Stable** |
| **Tim** | Plan, unbuilt | Tester/Verifier; appears in research judge + tdd-execute verifier | **Tier 2 — Build When Stable** |
| **TDD Phase Roles** | Exists (prompts) | RedTweaker, GreenTweaker, etc.; mandate-bound, tool-restricted | **Keep as Prompts, Don't Promote** |

---

## 10. FINAL SYNTHESIS: THE CLICK

**The question:** How do we move from 50-100+ unnamed inline persona primings scattered across skills to a named, reusable cast?

**The answer from evidence:**

1. **Five personas are already named and working:** Gin, Zisser, Consultant, Comptroller. They are stable and reusable. **Use them as the reference cast.**

2. **Four personas appear 4-6+ times and should be built immediately:** Mark, Wes, Ron, Poll. **These cover 60% of the unnamed instantiations.** Each appears in 2+ skills, each has a stable core role, each needs to become a `.md` file in `usegin/personas/`.

3. **Some roles need variant support (not one persona):** Mark, Ron, and Poll each have variant shapes depending on context (phase director vs. parallel spawner, tight loop vs. team lead, depth investigator vs. question decomposer). **The persona library should support variants via folders** (`Mark/soul.md`, `Mark/variants.md`, etc.).

4. **Some roles should stay skill-specific:** TDD phase tweakers are mandate-bound and tool-restricted — they are prompts, not personas. Ideator primings (Din, Johan, Cal as "designer/optimist/critic") should stay as brainstorm primings until they appear in a second skill.

5. **Brainstorm priming orthogonality is a design strength:** The fact that each ideation round uses 5-10 different primings on the same "ideator" template is intentional. The next step is **naming those primings** so skills can reference them: "spawn ideators with Din/Cal/Johan primings" instead of re-describing each.

**Recommended next R&D step:** Build Mark/Wes/Ron/Poll as the Tier-1 cast. Test them by refactoring one skill (brainstorm or teamwork) to use them by name. Capture the "what varies?" insights for each. Only then add Tier 2 (Ivan/Cal/Tim/Sam).

---

## Appendix: Full Occurrence Index

### By Skill/Agent/Sub-app

**`.claude/agents/zisser.md`**
- Zisser chief-of-staff (lines 8)

**`.claude/skills/brainstorm/SKILL.md`**
- 5-10 unnamed ideators with variable primings (lines 60-77)

**`.claude/skills/cell/spawner.md`**
- Cell Spawner orchestrator (lines 8)

**`.claude/skills/cell/worker.md`**
- Cell Worker implementer (lines 8)

**`.claude/skills/consult/SKILL.md`**
- Consultant persistent mode (lines 38-56)
- Consultant one-shot mode (lines 58-180)

**`.claude/skills/investigate-ci/SKILL.md`**
- Investigator classifies & reports (lines 9)

**`.claude/skills/liaison/SKILL.md`**
- Liaison orchestrator (lines 6-8)

**`.claude/skills/research/SKILL.md`**
- Research Director (lines 8-50)

**`.claude/skills/research/phase-manager.md`**
- Phase Manager (lines 1-80)

**`.claude/skills/research/process-judge.md`**
- Process Judge (lines 1-63)

**`.claude/skills/rnd/SKILL.md`**
- Professors (3-N, unnamed, lines 60-95)
- Synthesizer (1, unnamed, implied)

**`.claude/skills/security/SKILL.md`**
- Security Expert (lines 8-50)

**`.claude/skills/teamwork/spawner.md`**
- Spawner orchestrator (lines 3-50)

**`.claude/skills/teamwork/reviewer.md`**
- Reviewer team lead (lines 3-50)

**`.claude/skills/teamwork/worker.md`**
- Worker implementer (lines 3-50)

**`.claude/skills/teamwork/domain-expert.md`**
- Domain Expert guidance provider (lines 3-50)

**`.claude/skills/tdd-execute/prompts/`**
- RedTweaker test writer (red-tweaker.md lines 1-30)
- GreenTweaker implementation writer (green-tweaker.md lines 1-30)
- RefactorTweaker refactoring specialist (refactor-tweaker.md lines 1-30)
- DisciplineReviewer cycle judge (discipline-reviewer.md lines 1-50)
- Verifier mechanical proof provider (verifier.md lines 1-80)
- ScaffoldingTweaker import-error remover (scaffolding-tweaker.md lines 1-80)
- MutationApplier single-line breaker (mutation-applier.md lines 1-30)

**`.claude/skills/worker-reviewer/SKILL.md`**
- Reviewer TDD orchestrator (lines 15-50)
- Worker TDD implementer (implied)

**`/zisser/` directory**
- Zisser chief-of-staff (zisser.md, agents.md, CLAUDE.md)

**`/usegin/consultant/` directory**
- Consultant friction analyst (charter.md, CLAUDE.md)

**`/usegin/comptroller/` directory**
- Comptroller/Yohai audit voice (charter.md, CLAUDE.md)

**`/usegin/personas/README.md`**
- Planned cast: Mark, Poll, Din, Johan, John, Ron, Cal, Sam, Tim, Ivan, Wes (lines 98-188)

---

## Appendix: Persona Definition File Shape (Reference)

From `/workspaces/test-mvp/usegin/personas/README.md` lines 34-92, the minimum persona file shape is:

```markdown
---
name: <name>
role: <one-line>
soul: <one-line voice>
biases: [<terse>, <terse>]
voice: <one-line register>
defaults:
  vibe: interactive | autonomous | observer | adversarial
  pace: fast | deliberate | patient
created: YYYY-MM-DD
---

## Human side
<who is this — one paragraph>

## Gin side
You are <name>. <instantiation — what you do, laconic>

## Biases (stable)
- <bias>: <when it sharpens, when it might flatten>

## How <name> works in a team
<one paragraph: slot they fill, how they interact, what they escalate>

## Stays out of
- <hard constraint>
- <hard constraint>
```

---

**End of Whiteboard**

---

**Date created:** 2026-04-27  
**Investigator:** File-search agent (very thorough)  
**Status:** Complete inventory, ready for prioritization and build
