# Skill-Team Mapping: Orchestration & Execution

This map analyzes team shapes and persona requirements across 25 team-orchestration skills in the Gin codebase, identifying which skills are pure orchestration shapes (persona-agnostic), which have fixed teams, and which are meta-orchestrators.

## Comparison Table

| Skill | Team Shape (1 line) | Personas Embedded Inline | Sync/Parallel/Serial | Output Artifact | Where Named-Persona Substitution Would Slot |
|-------|---------------------|------------------------|---------------------|-----------------|---------------------------------------------|
| brainstorm | N primed ideators (5-10) parallel | Yes: persona-per-ideator (UX designer, hacker, researcher, etc.) | parallel | ideas.md flat pool (deduplicated) | Ideator charter: `You are <persona>` |
| refine | N refiners (3-6) sequential per slice theme | No explicit personas; theme-based slicing | parallel (per-slice) | ideas.md with Refined fields, merged-into tracking | Refiner slice assignment + charter context |
| prioritize | N independent prioritizers (3-5) | Yes: pragmatic PM, strategist, risk-conscious, evidence-driven | parallel | ideas.md with Rank + Rationale fields, aggregate.md | Prioritizer charter: weighting bias (e.g. "prefer Impact over Effort") |
| rnd | N professors per angle (3-10) parallel, synthesizer | Yes: domain-specific angles (doctrine, history, modern application) | parallel + synthesis | whiteboards per angle + cross-cutting SYNTHESIS.md | Professor charter: angle-specific lens (e.g. "Professor of <angle>") |
| research | Linear phases; director + phase managers | No: director is role, phase managers are typed (lightweight/heavy/experiment) | linear phases, parallel workers per phase | whiteboard.md (central artifact) + phase files | Phase manager charter: specific question, distilled context |
| cell | Spawner orchestrates; workers execute | No explicit personas; uniform workers differentiated via context | parallel workers | (code output only; no artifact pattern) | Worker charter: specific assignment + context |
| teamwork | Spawner (planned); planning team + impl teams per slice | No personas; team shape is role-based (worker + reviewer + expert) | sequential slices, parallel within slice | workspace state.json, progress.md, events.jsonl | Team member charter: role (worker/reviewer/expert) + assignment |
| liaison | Liaison orchestrates; sub-agents execute sequentially | No personas; role-based (liaison reads code, workers implement) | sequential by default (per-slice) | Linear issue chain (plan start/close) | Worker charter: slice DoD + context (no persona variation) |
| build-orchestrate | Director manages typed phases; spawns phase agents + reviewers | No personas; phase types (research, design, spec, implementation, QA) | linear phases, parallel agents per phase | whiteboard.md (central) + phase files (ephemeral) | Phase agent charter: phase type + question + distilled context |
| build-liaison | Liaison manages slices; spawns workers + reviewers per step | No personas; role-based (liaison reads/decides, workers implement) | sequential slices, parallel reviews | whiteboard.md + slice phase files | Worker charter: step (baseline/spec/implement/etc) + DoD + context |
| tdd-execute | Director orchestrates R-G-R cycles; spawns role-isolated tweakers | Yes: role-isolated (RedTweaker, GreenTweaker, DisciplineReviewer) | sequential cycles, stateless per-role | state.json + events.jsonl (audit trail) + per-cycle commits | Role assignment via state.phase; no persona substitution (roles are fixed) |
| worker-reviewer | Reviewer orchestrates; spawns workers for test plan → implementation | No personas; reviewer-worker pattern with phase state machine | sequential phases (plan → impl → review → commit) | state.json + submission.md + test-plan.md + source code | Worker charter: phase + current test index |
| mikado | Solo director; attempts goal, reverts on failure, recurses | No personas; method is solo+ repeatable | serial (attempt, revert, recurse) | graph file (docs/mikado/issue-id.md) + git commits | No agents spawned; director is solo (no persona) |
| companion | Long-running observer sub-agent; persistent across check-ins | No personas; role is "accountability watcher" | persistent (background), resumed for check-ins | feedback messages (async communication) | Companion charter: gold standard (skill reference + behavioral expectations) |
| spec | Silent research + interactive AC alignment + autonomous spec writing | No personas; agent mode (silent research, align, write) | linear phases (research silent, align interactive, write silent) | Linear issue + docs/specs/\<slug\>.spec.md | No agents spawned; single-agent skill |
| slicing-specs | Deep research + decompose + challenge + revise + present + create | No personas; agent mode (single agent, silent planning) | linear (research → decompose → challenge → revise → present) | Linear sub-issues (one per slice) + slice map (appended to parent) | No agents spawned; single-agent skill |
| test-architecture | Read inputs + pick layer per AC + name outermost + emit plan + review | No personas; agent mode (silent planning + unseeded review) | linear (planning silent, review unseeded single-pass) | docs/specs/\<feature\>/test-plan.md (schema validated) | No agents spawned; reviewer is unseeded generic (no persona) |
| tdd-impl-plan | Read test-plan + topologically order + annotate roles + detect gaps + emit plan | No personas; agent mode (single agent planning) | linear (planning sequential) | impl-plan.md (schema validated, consumed by tdd-execute) | No agents spawned; single-agent skill |
| session-retro | Parse session + identify friction + attribute to skills + create issues | No personas; agent mode (single agent analysis) | linear (parse → identify → attribute → create) | GitHub issues + Linear issues (dual target) | No agents spawned; single-agent skill |
| team-retro | Gather context + analyze (code quality + operations) + propose improvements | No personas; agent mode (analyst reading team workspace + Linear) | linear (gather → analyze → propose) | Linear comment on spec issue | No agents spawned; single-agent skill |
| skill-retro | Scan for skills + scope with user + evaluate + write findings + check for spec retro | No personas; agent mode (evaluator reading skill labs) | linear (scan → scope → evaluate → write) | .claude/skill-lab/\<skill\>/retros/YYYY-MM-DD.md | No agents spawned; single-agent skill |
| divergent-before-convergent | Collect ideas (divergent mode) → evaluate (convergent mode) | No personas; modes are reasoning stances (not agent roles) | interactive user-driven mode switching | AskUserQuestion prompts (no artifact) | No agents spawned; single-agent skill |
| interactive-dev | Human drives; Claude pairs as senior dev (investigation → implementation → verification) | No personas; role is "senior developer partner" | interactive (human always in loop) | code commits + Linear references | No agents spawned; single-agent skill (deep pairing) |
| ralph-loop | Solo director; persistent iterations toward completion promise | No personas; method is auto-repeating solo loop | serial (iterate until completion promise) | code commits + git history (state persists across iterations) | No agents spawned; director is solo (no persona substitution) |

---

## Synthesis & Patterns

### 1. Pure Orchestration Shapes (No Fixed Personas, Only Operating Modes)

These skills define team-orchestration patterns that remain agnostic to persona assignment — they specify *shape* (roles, phases, sequencing) but let the user or downstream assignment decide persona details:

- **research** — phase manager typing (lightweight/heavy/experiment) is role-based, not persona-based
- **build-orchestrate** — phase types (research/design/spec/impl/QA) are abstract roles
- **build-liaison** — liaison + worker roles are abstract; specificity comes from assignment context
- **liaison** — sub-agent roles (executor, reviewer) are abstract; bound by task, not persona
- **cell** — spawner + uniform workers; workers differentiated by assignment, not pre-baked persona
- **teamwork** — team shape is worker/reviewer/expert roles; personas not embedded

**Refactor target:** Keep the skill, drop inline persona prompts where they exist (e.g., remove "You are a pragmatic PM" from prioritize workers), and instead reference `usegin/teams/<name>.md` for persona binding. The orchestration structure survives; persona sourcing moves to named-team definitions.

**Example:** `liaison` could drop "sub-agents execute" and replace with "sub-agents execute (bind roles via team-context from usegin/teams/<context-name>.md)".

---

### 2. Fixed-Team Skills (Same Team Every Time; Candidate for Named-Team Binding)

These skills always spawn the same team shape—same roles, same persona variations, no choice:

- **brainstorm** — Always 5-10 primed ideators with persona variations (designer/hacker/researcher/etc.). This is *always* the shape. The personas vary but the cardinality and role are constant.
  - **Named-team candidate:** `usegin/teams/brainstorm-ideators.md` (cardinality 5-10, role-definition template + persona-slot placeholders)

- **prioritize** — Always 3-5 prioritizers with fixed priming axes (pragmatic PM, strategist, risk-conscious, evidence-driven). The weighting varies but the roles do not.
  - **Named-team candidate:** `usegin/teams/prioritize-team.md` (cardinality 3-5, role-definition + priming-axis templates)

- **rnd** — Always N professors decomposed into independent angles + synthesizer. Structure varies by question, but the fan-out + synthesis pattern is fixed.
  - **Named-team candidate:** `usegin/teams/rnd-professors.md` (pattern: decompose into angles, fan-out, synthesize; angle cardinality is context-driven)

- **tdd-execute** — Always role-isolated (RedTweaker/GreenTweaker/DisciplineReviewer). These roles are immutable—enforce by phase-gating via hook.
  - **Named-team candidate:** `usegin/teams/tdd-execute-trio.md` (role definitions: Haiku redTweaker, Haiku greenTweaker, Opus DisciplineReviewer; model/tool constraints per role)

- **spec** — Single agent, but the silent-research → interactive-align → autonomous-write pipeline is fixed. Personas do not vary.
  - **Named-team candidate:** `usegin/teams/spec-writer.md` (though single-agent, the phase sequence could be templated)

---

### 3. Meta-Orchestrators (Higher-Order Coordinators; Don't Decompose to Single Team)

These skills orchestrate *other* orchestrators or manage multi-phase work that spans multiple team compositions:

- **research** — director + phase managers. Each phase manager is itself a lightweight/heavy/experiment orchestrator. This is a two-level abstraction (director > manager > workers). It doesn't map to a single fixed team—instead, it's a pattern for composing variable-shape teams.
  - **Pattern:** "Director manages phases; each phase spawns its own team shape (lightweight = single Explore, heavy = TeamCreate with workers, experiment = iterative workers)."

- **build-orchestrate** — director + phase agents. Similar two-level pattern. Spec phase spawns spec-writer; impl phase spawns liaison + workers; QA phase spawns tester. Each phase recruits different team shapes.
  - **Pattern:** "Director manages typed phases. Implementation phase explicitly delegates to liaison (three-layer: director > liaison > workers). Each phase type has its own team topology."

- **teamwork** — spawner + planning team + implementation teams. Spawner is meta; planning team (planning-agent) is distinct from impl teams (worker + reviewer per slice). This is higher-order composition.
  - **Pattern:** "Spawner coordinates planning (one-time) + implementation (one team per slice). Planning is its own orchestration; impl teams are identical in shape but independent in execution."

**Do not attempt to bind these to single `usegin/teams/<name>.md`.** Instead, create pattern documentation (e.g., `usegin/orchestration-patterns/<name>.md`) that explains the multi-level composition and references the sub-team types they compose.

---

### 4. Recommended Migration Order (Which Skill to Bind First)

Priority is based on:
1. **Fixed-team skills first** (easiest to extract and reuse)
2. **Highest-leverage reuse** (teams used in multiple skills or multiple sessions)
3. **Low risk** (skill is mature, team definition is stable)

**Migration sequence:**

1. **brainstorm → `usegin/teams/brainstorm-ideators.md`** (cardinality 5-10, persona-slot template)
   - *Why first:* Brainstorm is mature, team shape never changes, used frequently. Extracting personas to team-context immediately unblocks `refine` and `prioritize` from hardcoding persona lists.
   - *Unblocks:* refine (ideator sourcing), prioritize (weighting-bias sourcing)

2. **prioritize → `usegin/teams/prioritize-team.md`** (cardinality 3-5, priming-axis template)
   - *Why second:* Depends on brainstorm context. Team is fixed. Heavy persona content.
   - *Unblocks:* Any downstream skill that needs to re-prioritize

3. **tdd-execute → `usegin/teams/tdd-execute-trio.md`** (RedTweaker/GreenTweaker/DisciplineReviewer role defs)
   - *Why third:* Mature skill, role definitions are immutable. Extracting them centralizes role-specific constraints (model, tools, isolation rules).
   - *Unblocks:* liaison (impl phase could reference trio instead of inline prompts)

4. **rnd → `usegin/teams/rnd-professors.md`** (decomposition + synthesis pattern)
   - *Why fourth:* Fixed pattern, but cardinality is context-driven (3-8 angles typical). Extracting the pattern helps library-ify R&D for reuse across projects.
   - *Unblocks:* Any feature R&D or domain R&D sessions

5. **liaison → refactor away inline persona prompts; reference team-context** (no new team file, just clean up existing skills)
   - *Why fifth:* Once brainstorm/prioritize/tdd-execute are bound, liaison can drop "You are a [role]" from worker charters and instead pull persona from upstream team definitions.
   - *Unblocks:* Multi-skill chaining (e.g., brainstorm → refine → prioritize → spec → liaison)

6. **spec, slicing-specs, test-architecture, tdd-impl-plan** — These are single-agent skills; no persona binding. **Leave as-is.**

7. **build-orchestrate, build-liaison, research, teamwork** — Multi-level orchestrators; create `usegin/orchestration-patterns/<name>.md` instead of team files. **Do not bind to single team.** Instead, document the composition pattern (director > phase managers / liaison > workers, etc.).

---

## Implementation Notes

### Creating a Named-Team File

Each `usegin/teams/<name>.md` should include:

1. **Cardinality** — How many agents (fixed, or context-dependent range)
2. **Roles** — What each agent does (executor, reviewer, specialist, etc.)
3. **Model preference** — Opus, Haiku, based on role
4. **Persona template** — If personas vary, provide the axis/dimension template (not hard-coded examples)
5. **Tool restrictions** — If role-specific (e.g., RedTweaker: Edit test-globs only)
6. **Isolation rules** — If needed (e.g., stateless one-shot for RedTweaker; persistent for companion)

### Creating an Orchestration-Pattern File

Each `usegin/orchestration-patterns/<name>.md` should include:

1. **Two/three-level structure diagram** (director > phase manager > workers, or similar)
2. **Phase/level types** — What roles emerge at each level
3. **How teams compose** — What triggers new team spawning, what's reused
4. **Reference to sub-team types** — Link to `usegin/teams/<sub-type>.md` for bound teams

---

## Open Questions

1. **Persona sourcing for multi-session systems:** If brainstorm ideators are extracted to `usegin/teams/brainstorm-ideators.md`, how do users customize personas per brainstorm session? (Answer: team-file becomes a template; session-level context injects specific personas.)

2. **Persistence vs. one-shot:** Some teams are persistent (companion, whiteboard directors), others are one-shot (ideators, tweakers). Should team files distinguish this? (Recommendation: yes—add `lifetime: one-shot | persistent` field.)

3. **Cross-skill team reuse:** If `tdd-execute` extracts the trio, could `liaison` call it directly for impl phases? (Answer: yes—liaison impl phase could spawn the trio instead of inline workers, but this requires careful contract definition.)

---

## Summary Table: Skill Type Breakdown

| Type | Count | Skills | Migration Target |
|------|-------|--------|------------------|
| Pure orchestration shape | 6 | research, build-orchestrate, build-liaison, liaison, cell, teamwork | Reference `usegin/teams/<name>` from skill; no new files |
| Fixed-team (candidate for binding) | 5 | brainstorm, prioritize, rnd, tdd-execute, spec | Create `usegin/teams/<name>.md` |
| Meta-orchestrators (pattern docs) | 4 | research, build-orchestrate, teamwork, build-liaison | Create `usegin/orchestration-patterns/<name>.md` |
| Single-agent (no binding needed) | 10 | refine, slicing-specs, test-architecture, tdd-impl-plan, session-retro, team-retro, skill-retro, divergent-before-convergent, interactive-dev, companion |  Leave as-is |

