---
name: tdd-impl-plan
description: "Plan the TDD execution sequence for a slice — order tests outer-first, label each step's role (outer-red / inner-red / inner-green / inner-refactor / outer-green / verification-only / scaffolding / contract-check / mutation-pass), detect formatter dirt and walking-skeleton gaps, and emit a typed impl-plan.md that tdd-execute walks one cycle at a time. Use when you say 'plan the TDD steps', 'what's the order', 'sequence the test plan', '/tdd-impl-plan', or right after test-architecture finishes."
triggers:
  - "plan the TDD steps"
  - "what's the order"
  - "sequence the test plan"
  - "/tdd-impl-plan"
---

# tdd-impl-plan

Sequence the test-plan into ordered, role-tagged steps so `tdd-execute` can walk one cycle at a time. Emits `impl-plan.md` — the typed artefact that names which tests are TDD'd, which are verification-only, where format commits land, where walking-skeleton steps land, and which steps get a mutation-pass epilogue.

**Pipeline:** `spec` → `slicing-specs` → `test-architecture` → **`tdd-impl-plan`** (you are here) → `tdd-execute`

## TL;DR

- One `impl-plan.md` per slice. YAML frontmatter, ordered `steps[]`.
- **Refuse to plan** if input `test-plan.md` lacks any `outermost: true` test (Mandate #2).
- Format dirt (ruff / prettier) lands as **standalone style commits *before* the first Red** (`feedback_format_before_tdd`).
- Outer-red is step 1, outer-green is the last step; inner cycles in between are ordered by `failure_mode_class` (happy → error → race → contract).
- Default per step: `tdd: true`. Allowed exceptions: pure config, pure CSS, no-logic migrations, intentional spikes.
- High-risk slices (mirror invariants, concurrency, external contracts) get an opt-in `mutation_pass` epilogue (ENG-4934 model).
- Tests that need a Green-phase invention (ENG-5031) emit a deferred-Red marker — never silently dropped.
- Sequential by default. Parallel cycles are an exception path requiring contract-first artefact + integration checkpoint (ENG-2002).

## Pipeline Position

Consumes: `test-plan.md` (from `test-architecture`) + the spec issue (for AC text). Produces: `impl-plan.md` keyed by the same `T<N>` ids that `tdd-execute` uses to drive the Director loop. Code context (seam files, recent changes) is gathered by an `Explore` sub-agent — never inline (`feedback_prefer_subagents_for_explore`).

---

## Workflow

| # | Step | Output |
|---|------|--------|
| 1 | Read `test-plan.md`. Verify `outermost: true` exists; refuse otherwise. | (gate) |
| 2 | Topologically order: outer-red first; inner cycles by `failure_mode_class` (happy → error → race → contract → chaos); outer-green last. | tentative `steps[]` |
| 3 | Annotate each step with a role tag (see Step Roles table). | role-tagged `steps[]` |
| 4 | Label `tdd: true` (default) or `tdd: false` with reason. Only flip to false for pure config / pure CSS / no-logic migrations / intentional spikes. | TDD column |
| 5 | Detect **formatter dirt**. For each touched file, dry-run the formatter (`ruff format --check`, `prettier --check`). Emit one `pre_red.formatter_commits[]` entry per dirty area. | pre_red block |
| 6 | Detect **walking-skeleton gap**. Static check: does the outer test resolve its imports / endpoints / types against the current codebase? If no, prepend `walking_skeleton.steps[]`. | walking_skeleton block |
| 7 | Identify **deferred-Red** steps (test asserts a behaviour that doesn't exist until Green invents it; ENG-5031). Tag with `deferred_red: true` + `# TODO(green, ENG-XXXX):` marker text. Do not silently drop. | deferred_red flags |
| 8 | High-risk slice? Set `mutation_pass.required: true` with a 3-7 mutation list (per ENG-4934). High-risk = mirror invariants, concurrency, external contracts. | mutation_pass block |
| 9 | Single-iteration unseeded review (`feedback_liaison_review_seeding` + `feedback_single_iteration_review`). Apply every finding (`feedback_liaison_fix_everything`). | reviewed plan |
| 10 | Emit `impl-plan.md` next to the `test-plan.md`. | artefact |

---

## Input

`test-plan.md` from `test-architecture` (validated against `.claude/skills/test-architecture/schema/test-plan.schema.json`) + spec linear id for AC text. Code-context exploration delegated to an `Explore` sub-agent.

---

## Output: `impl-plan.md`

```yaml
---
test_plan: <relative path>            # pointer to test-architecture output
spec: ENG-XXXX
slice: ENG-XXXX-N                     # slice id (pattern ^ENG-\d+(-\d+)?$).
                                      # tdd-execute uses this to derive its workspace
                                      # path: .tdd-execute/<slice>/. Per F-COUPLE-4.
generated_at: <iso>
generated_by: tdd-impl-plan@<rev>

# Pre-Red phase: format-before-tdd (per feedback_format_before_tdd)
pre_red:
  formatter_commits:
    - cmd: "uv run ruff format python-services/agent_api/<area>"
      rationale: "<files> are dirty under ruff; commit style-only first."
    - cmd: "bun run format nextjs-app/lib/<area>"

# Walking skeleton (only if outer test cannot run end-to-end against HEAD)
walking_skeleton:
  required: true | false
  steps:
    - description: "<thinnest end-to-end thread for the outer loop>"
      target_test_id: T0

# Ordered execution
steps:
  - n: 1
    target_test_id: T1                # from test-plan.md
    layer: e2e
    role: outer-red                   # see Step Roles table
    tdd_or_verification:
      tdd: true                       # true → Red→Green→Refactor; false → write directly
      reason: ""                      # required if tdd:false
    transformation_hint:              # optional — biases GreenTweaker toward TPP rank
      tpp_rank: 4                     # 1..11; see TPP table
    predicted_seam_touchpoints:
      - file: "<path>"
        kind: read | write | new
    blocker_dependencies: []          # ids of prior steps
    deferred_red: false               # true → ENG-5031 deferred-Red pattern (see below)
    notes: |
      "Outer red. Stays red while inner cycles 2-N land. Goes green after step N."

  - n: 2
    target_test_id: T2
    role: inner-red
    blocker_dependencies: [1]
    notes: |
      "First missing collaborator named by T1's failure: ShortIdResolver."

  # … last step's role: outer-green, asserting the outermost test flips.

# Optional epilogue
mutation_pass:
  required: <bool>                    # true for high-risk slices (ENG-4934)
  scope: |
    "List of intentional production breakages to verify each is caught
     by ≥1 test."
  mutations:
    - id: M1
      target_file: "<path>"
      mutation: "<description>"
      expected_to_be_caught_by: [T3, T7]
---
```

The schema is enforced by `.claude/skills/tdd-impl-plan/schema/impl-plan.schema.json`. `tdd-execute` validates against it before walking the steps.

---

## GOOS Double-Loop

A slice has **one outer loop** (the user-visible acceptance test) and **N inner loops** (the unit/integration cycles that drive it green). The outer red stays red while inner cycles land; the last inner step flips the outer test to green.

```
outer-red (step 1)              ← writes the outermost failing test
  inner-red (step 2)            ← first missing collaborator
  inner-green (step 3)
  inner-refactor (step 4)       ← optional but mandatory-decision
  inner-red (step 5)
  inner-green (step 6)
  inner-refactor (step 7)
  ...
outer-green (step N)            ← outermost test goes green
```

**Topology rules:**
1. Step 1 is always `outer-red`. (Mandate #2: outer first.)
2. Step N (last) is always `outer-green` and must reference the same `target_test_id` as step 1. Step N's job is to confirm the outer test now passes; it usually adds zero new code.
3. No nested reds. Each inner cycle must complete (red → green → refactor-or-deferred) before the next inner red. (Mandate #3.)
4. `outer-red.blocker_dependencies` = `[]`. `outer-green.blocker_dependencies` = `[2..N-1]` (everything between).
5. Inner-cycle ordering inside the loop follows `failure_mode_class`: happy paths first, then error, then race/contract. Don't put a chaos test as the first inner red.

Reference: `03-tdd-theory.md` GOOS section.

---

## Transformation Priority Premise (TPP)

Annotate each `inner-green` step with `transformation_hint.tpp_rank` so `GreenTweaker` knows which transformation to reach for. Pick the **highest-priority** transformation that fits.

| Rank | Transformation | When it fits |
|------|----------------|--------------|
| 1 | `{} → nil` | First non-trivial use |
| 2 | `nil → constant` | Hard-coded return for a fake-it green |
| 3 | `constant → constant+` | Two related constants → constant becomes a complex value |
| 4 | `constant → scalar` | Replace constant with a variable |
| 5 | `statement → statements` | Add an unconditional second statement |
| 6 | `unconditional → if` | First branch needed |
| 7 | `scalar → array` | Need a collection |
| 8 | `array → container` | Hash/Set/Map needed |
| 9 | `statement → recursion` | Recursive structure required |
| 10 | `if → while` | First loop |
| 11 | `expression → function` | Extract reusable abstraction |

Source: Robert C. Martin, *The Transformation Priority Premise*. The hint is advisory — GreenTweaker may pick lower if higher genuinely doesn't fit, but should justify in the cycle's events.jsonl entry.

**Use case:** rank 2 ("fake-it") is the most common first move. If three tests pin the same constant, triangulate to rank 4 (variable). Avoid jumping straight to rank 11 (functions) — that's where over-engineering hides.

---

## Format-before-Red

Per `feedback_format_before_tdd`: when `pre_red.formatter_commits` is non-empty, those commits land **before** step 1's Red. They have no semantic effect; their job is to keep TDD diffs clean.

**Detection logic** (run at planning time):
- For each predicted-touch file in `predicted_seam_touchpoints`, dry-run the formatter:
  - `.ts` / `.tsx` → `bun run format -- --check <file>` (or `prettier --check`)
  - `.py` → `uv run ruff format --check <file>` AND `uv run ruff check <file>`
- Group dirty files by area (one commit per area, max 3 commits).
- Skip if formatters report clean.
- **Skip dry-run for files with `kind: new` (F-FRICTION-2)** — formatters cannot check what doesn't exist yet. Surface those files in the *first* TDD commit's diff under formatter-clean conventions (the tweaker that creates them is responsible for emitting clean output). No `pre_red` entry is emitted for new files.

**Commit messages:** `style(<area>): ruff format` / `style(<area>): prettier`. No mixed style+semantic commits.

---

## Walking-skeleton Detection

Per GOOS §6: if the outer test cannot even *attempt* to run against HEAD (its imports don't resolve, its endpoint doesn't exist, the page route 404s), the loop has no spine. Insert thin scaffolding steps before the outer-red.

**Static check** (no live test runs at planning time):
- For an `e2e` outer test: does the page route exist? Is the API endpoint declared (even as a stub)?
- For a `nextjs-db` outer test: does the service module exist? Is the table declared?
- For a `python-llm` outer test: does the agent / tool / config exist?

If "no", prepend a `walking_skeleton.steps[]` entry whose role is `scaffolding` and whose only purpose is to make the outer test *reachable* (not green). Outer-red still goes red — but for the right reason (assertion failure, not import error). Mandate #4 (Red must be observed for the right reason).

**Single-export shortcut (F-FRICTION-3).** For new modules where the outer test is `unit` or `python-unit`, walking-skeleton may be a single zero-logic export of the module's main symbol (e.g. `export function fizzbuzz(n: number): string { throw new Error("not implemented"); }`). Log it as a 1-line scaffolding step in `walking_skeleton.steps[]` but do NOT require a separate commit — the scaffolding tweaker creates the file and the first inner-green commit absorbs the line. This avoids a one-line "skeleton" commit that adds ceremony without semantic content for tiny features.

---

## Step Roles

| Role | Purpose | Allowed `tdd` |
|------|---------|---------------|
| `outer-red` | Write the failing outermost test. Step 1. | `true` only |
| `inner-red` | Write a failing unit/integration test that names the next missing collaborator. | `true` only |
| `inner-green` | Smallest legal transformation (TPP) to make the inner red pass. | `true` only |
| `inner-refactor` | Improve structure with the test green. Mandatory decision (do or defer with reason). | `true` only |
| `outer-green` | Confirm the outer test flips. Last step. Usually zero new code. | `true` only |
| `verification-only` | Add an assertion-only test for behaviour already implemented (e.g. regression pin). | `false` allowed |
| `scaffolding` | Walking-skeleton step — make outer test reachable. No production logic. | `false` allowed |
| `contract-check` (**hint only — never emitted as a step role**) | Marks a test-plan row whose `failure_mode_class: contract` enumerates write-sites of a mirrored field (per ENG-5023). The planner MUST expand each `contract-check`-shaped test-plan row into N `(inner-red, inner-green)` step pairs at planning time — one pair per write-site. `tdd-execute` never sees `role: contract-check` (per F-CC-1; see "Contract-check expansion" below). | n/a (planning-only) |
| `mutation-pass` | Run mutation epilogue: deliberately break production, confirm caught by ≥1 test. | n/a (epilogue) |

---

## Contract-check expansion (F-CC-1)

A test-plan row marked `failure_mode_class: contract` (e.g. ENG-5023 mirror invariants) covers **N writers** of a derived field. `tdd-execute` is single-target per step — one `target_test_id` and one `red_line` per cycle. To preserve that contract, **expand each contract-shaped row into N `(inner-red, inner-green)` step pairs at planning time**, one pair per write-site:

1. Enumerate every write-site that produces the mirrored field. Use the `predicted_seam_touchpoints` of the slice's existing inner-green steps to discover them; reviewers cross-check against ENG-5023's write-site enumeration discipline.
2. For each write-site, emit one `inner-red` step + one `inner-green` step with:
   - `target_test_id` = the contract test row's id (all expanded steps share the same id; their distinct `predicted_seam_touchpoints` distinguish the writers).
   - `notes` naming the specific writer being pinned.
3. Order the expansion as a contiguous block. The optional `inner-refactor` step at the end is decision-or-defer per Mandate #6.

Single-write-site contract rows collapse to one `(red, green)` pair. The example impl-plan (`examples/example-impl-plan.md`) shows the single-writer collapse for `csv_uploads.row_count`.

`tdd-execute` rejects any plan that retains `role: contract-check` at the setup gate (per F-CC-1). Always emit the expansion.

## TDD-vs-verification Rules

`tdd: true` is the default. Allowed exceptions for `tdd: false`:
- **Pure config:** e.g. `tsconfig.json` paths, `next.config.js` flags. Behaviour-shaping config (e.g. RLS migration) is NOT pure — that's TDD'd.
- **Pure CSS:** layout-only changes that aren't tested. (Functional CSS — focus rings, hover states with logic — gets visual or component tests.)
- **No-logic migrations:** column rename, index add, where production code routes nothing through the changed surface yet.
- **Intentional spikes:** time-boxed exploration with `# WIP - not for merge` markers; must be reverted before slice closes.

Anything else: `tdd: true`. The reason field is required when `tdd: false`. Reviewers interrogate the reason — "we're in a hurry" is not a reason.

---

## Mutation Pass (opt-in epilogue)

Per ENG-4934: for high-risk slices, after the slice's outer-green lands, run an explicit mutation pass to confirm the test set actually catches the genus of bugs you care about.

**Set `mutation_pass.required: true` when:**
- The slice touches **mirror invariants** (derived/duplicated state across writers; per ENG-5023).
- The slice has **concurrency** semantics (polling, optimistic UI, retry, race; per ENG-2821 chaos cluster).
- The slice depends on an **external contract** (third-party SDK, RPC, vendor format) where mocks could lie (per ENG-4922).

**Mutation list shape** (each row):
- `mutation`: a one-line breakage to apply to production code.
- `target_file` + `target_function` (or `target_line`).
- `expected_to_be_caught_by`: list of `T<N>` ids that should fail when the mutation is applied.

`tdd-execute` runs the mutation pass after `outer-green` lands: applies each mutation in a throwaway working tree, runs the test suite, confirms the predicted tests fail, reverts. Any mutation NOT caught is a real test gap — surface as a follow-up issue.

Default: `mutation_pass.required: false`. Opt in only when warranted; the pass costs ~1 day on a feature-sized slice (ENG-4934).

---

## Deferred Red (ENG-5031 pattern)

Some tests assert a behaviour that doesn't *exist* until a Green-phase invention names it (e.g. "T3 asserts the disambiguator returns `'short'` — but no `disambiguator` exists until step 5 Greens it"). Don't silently drop these tests.

**Pattern:**
1. Tag the step `deferred_red: true`.
2. Insert a `# TODO(green, ENG-XXXX):` marker comment in the test file at planning time. The marker references the Linear issue created for the deferral.
3. The step's `target_test_id` still appears in the plan, but its Red happens *after* the Green that invents the surface. Order: predecessor inner-green → deferred inner-red (stripped of TODO) → its own inner-green.
4. Always keep a follow-up Linear issue stub. Never silently delete a test from the plan.

---

## What this skill does NOT do

- **Does not write tests or production code.** (`tdd-execute` does that.)
- **Does not run live tests.** Walking-skeleton check is static (does the outer test resolve imports / endpoints).
- **Does not change layer assignments.** (`test-architecture`'s call.)
- **Does not pick mock libraries, fixture builders, or test idioms** beyond layer constraints.
- **Does not parallelize.** Sequential by default. Parallel cycles are an exception path requiring contract-first artefact + integration checkpoint (per ENG-2002 retro). User must explicitly opt in.
- **Does not estimate calendar time.** Only emits cycle budgets (line ceiling per Green, retry caps per Red — defaults: 50 lines, 3 retries).

---

## Coexistence

| Skill | Relationship |
|-------|--------------|
| `test-architecture` | **upstream** — produces `test-plan.md` |
| `tdd-execute` | **downstream** — walks the `impl-plan.md` |
| `slicing-specs` | upstream of test-architecture; this skill assumes slices already exist |
| `tdd-ci` | called for xfail / `test.failing` syntax decisions |
| `feature-toggles` | if the slice introduces a toggle, it gets its own scaffolding step |
| `worker-reviewer` | overlap for tiny single-module work; for cross-layer/seamed slices use this skill instead |

---

## Mandate alignment

| Mandate | Where in this skill |
|---------|---------------------|
| #2 outer first | Topology rule 1; refuse-to-plan gate |
| #3 one cycle at a time | Topology rules 3, 4 |
| #5 smallest transformation | TPP table + `transformation_hint` |
| #6 refactor mandatory | `inner-refactor` role + Step Roles table |
| #10 commit at every green | Plan structure (one logical step per Green); enforced by `tdd-execute` |
| #12 good tests | Mutation pass epilogue |

---

## Style

Concise. Tables over prose. Cite ENG-ids and `feedback_*` memory files where claims need grounding. No filler. No emoji.
