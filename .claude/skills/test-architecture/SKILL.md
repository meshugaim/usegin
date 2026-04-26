---
name: test-architecture
description: "Design the test plan for a sliced spec — pick layers, name the outermost acceptance test, enumerate write-sites and async-coordination triggers, and emit a typed test-plan.md that downstream tdd-impl-plan and tdd-execute can consume. Use when you say 'design the tests', 'test architecture for X', 'what tests do we need for this slice', 'before I write any tests', '/test-architecture', or right after slicing-specs finishes a non-trivial spec (>3 slices, or any slice with cross-service seams)."
triggers:
  - "design the tests"
  - "test architecture for"
  - "what tests do we need for this slice"
  - "before I write any tests"
  - "/test-architecture"
---

# test-architecture

Design the test plan **before any test is written**. Decide which behaviour lives at which layer, name the outermost acceptance test, and emit `test-plan.md` — the typed artefact that `tdd-impl-plan` consumes.

**Pipeline:** `spec` -> `slicing-specs` -> **`test-architecture`** (you are here) -> `tdd-impl-plan` -> `tdd-execute`

## TL;DR

- One `test-plan.md` per slice. YAML frontmatter, one row per test.
- Every plan **must** name an `outermost: true` test. Refuse to emit otherwise (Mandate #2, ENG-4922).
- Every AC must appear in some test's `ac_ids`. Orphan AC = error.
- For mirrored / derived fields, enumerate every writer and tag each `failure_mode_class: contract` (ENG-5023).
- For every `mocked` external dependency, write a "what could this mock hide?" note (ENG-4922 / ENG-4934 T1).
- The skill does **not** write test code, order tests, or pick mocks — those belong downstream.

## Pipeline Position

Consumes: `spec` (AC at behaviour level, per `08-spec-flow-trace.md` observation 1) and `slicing-specs` output (slices + seams). Produces: `test-plan.md` keyed by stable `T<N>` ids that `tdd-impl-plan` reorders into a Red->Green->Refactor sequence and `tdd-execute` walks one cycle at a time.

```
spec + slices  ->  test-architecture  ->  tdd-impl-plan  ->  tdd-execute  ->  covered feature
                       |                         |                |
                       v                         v                v
                 test-plan.md             impl-plan.md      per-cycle commits
```

## Workflow

Six steps. The first five are silent research + drafting; the last is a single-iteration unseeded review pass (per `feedback_single_iteration_review`, `feedback_liaison_review_seeding`).

| # | Step | What you do | What you cite |
|---|------|-------------|---------------|
| 1 | Read inputs | Read spec, slices, seams. Re-read `01-test-inventory.md` decision tables (lines 927-960) and `05-doc-audit.md` canonical taxonomy. | spec id; inventory section refs |
| 2 | Pick layer per AC | For each AC, choose layer using the **Layer picker** table below. Cite which dimension (behaviour / confidence / speed / isolation) drove the choice. | inventory line refs; ENG-IDs |
| 3 | Name outermost | For each user-visible behaviour, mark exactly one test `outermost: true` — the one that traverses the user-observable surface (Mandate #2). | spec AC id |
| 4 | Enumerate writers + races | For derived/mirror fields, list every write-site -> one `failure_mode_class: contract` row each (ENG-5023). For ACs whose text mentions polling, optimistic UI, retry, race, concurrency: add a `failure_mode_class: race` sibling row (ENG-2821 chaos cluster). | ENG-5023, ENG-2821 |
| 5 | Emit `test-plan.md` + summary | Write the YAML and a one-page summary for the liaison. Validate against `schema/test-plan.schema.json`. | — |
| 6 | Unseeded reviewer pass | Spawn one reviewer with diff + spec + slices only. No "key questions." Apply **all** findings (per `feedback_liaison_fix_everything`). Single iteration. **F-FRICTION-5 small-plan relief:** the reviewer pass may be skipped for plans with **≤4 tests AND single layer** (cite `feedback_single_iteration_review` two-tier discipline). On skip, set frontmatter `reviewed: skipped` and `reviewed_reason: "small-plan-relief — N tests, layer X"`. Larger or multi-layer plans always get the reviewer pass. | feedback memos |

Mandate #4 (red must be observed) is enforced at `tdd-execute`. Your job here: write the `assertion_shape` precisely enough that the RedTweaker's observed `failureMessage` can be compared against intent. The plan commits to *what failure should look like*; execute observes the actual failure.

## Input

```yaml
spec:
  linear_id: ENG-XXXX
  ac:
    - id: AC1
      text: "<one-line behaviour, user/system terms — not a test name>"
      level_hint: unit | python-unit | nextjs-db | nextjs-browser | python-db |
                  python-llm | code-integration | e2e | external | sql-rls
slices:
  - id: ENG-XXXX-1
    ac_ids: [AC1, AC3]
    seams:
      - field: <name>
        producer: ENG-XXXX-N
        consumer: ENG-XXXX-M
        shape: <type/schema>
prior_art:
  - <linear_id_or_path>
```

If the spec ACs read like test names ("the parser must reject empty tags"), bounce back to `spec` — ACs are behaviour-level (`08-spec-flow-trace.md` observation 1).

## Output: `test-plan.md`

Path: `docs/specs/<feature>/test-plan.md` (sibling of the spec) or `docs/research/tdd-skills/<feature>/test-plan.md` for research features. Schema is enforced by `schema/test-plan.schema.json` — referenced by `tdd-impl-plan` when it consumes the artefact, and (eventually) by a shared validator in `tools/tdd-shared/`.

```yaml
spec: ENG-XXXX
slice: ENG-XXXX-N                  # slice id (pattern ^ENG-\d+(-\d+)?$).
                                   # Mirrors the slice from slicing-specs; consumed
                                   # by tdd-impl-plan and tdd-execute. Per F-COUPLE-4.
generated_at: <iso>
generated_by: test-architecture@<rev>
reviewed: ok                       # "ok" (default) | "skipped"
reviewed_reason: ""                # required if reviewed: skipped (per F-FRICTION-5)

tests:
  - id: T1
    layer: e2e                  # canonical name from "Layer picker" — no aliases
    assertion_shape: |
      "When user toggles access from internal->external, a subsequent VAIS query
       for the file's struct_data returns access_level='external'."
    rationale: |
      "Criterion is about external store state — must read VAIS, not DB proxy.
       (ENG-4922; feedback_verifier_query_external_state.)"
    ac_ids: [AC4, AC11]         # m:n per 08-spec-flow-trace observation 2
    external_dependencies:
      - service: VAIS
        kind: real | fake-with-self-test | mocked
        contract_check: |
          "struct_data round-trip; fake must self-test per ENG-4934 T1."
    outermost: true              # exactly one per user-visible behaviour
    failure_mode_class: happy | error | race | chaos | contract
    mock_can_lie_note: |         # required iff any external_dependencies.kind == mocked
      "If the mock returns 200 without writing struct_data, this test passes
       and the bug ships (ENG-4922 simulateSync pattern)."
```

See `examples/example-test-plan.md` for a complete worked plan.

## Required slots

The skill **refuses to emit** if any of these is violated. These are hard rules, not stylistic preferences.

| # | Slot | Rule | Source |
|---|------|------|--------|
| 1 | Outermost test exists | Every user-visible behaviour has exactly one row with `outermost: true`. | Mandate #2, Mandate #11 |
| 2 | AC coverage | Every AC id appears in >=1 test's `ac_ids`. Orphan AC = error. | memo 4a |
| 3 | Write-site enumeration | For each derived/mirror field invariant, every writer has a `failure_mode_class: contract` row. | ENG-5023 |
| 4 | Async-coordination flagging | Every AC mentioning polling / optimistic UI / retry / race / concurrency has a `failure_mode_class: race` row alongside the happy path. | ENG-2821 chaos cluster |
| 5 | Mock-can-lie audit | Every test with any `external_dependencies.kind == mocked` has a `mock_can_lie_note`. | ENG-4922 / ENG-4934 T1 |

## Single-layer features (F-FRICTION-1)

For slices that satisfy **all** of the following:

- every test row shares the same `layer`,
- no `external_dependencies` block on any row, AND
- no mirror invariants / derived-field write-sites,

apply this relief path:

1. **Outermost selection.** Mark the highest-`failure_mode_class` row as `outermost: true`, using the priority `contract > race > error > happy`. (Rationale: the test that pins the most demanding behaviour is the most useful endpoint to drive the slice green.) For pure single-class slices (e.g. four `happy` rows for a small pure function), pick the row whose `assertion_shape` exercises the broadest input — typically the case that forces the most branches.
2. **Slot suppression.** Required Slots #3 (write-site enumeration), #4 (async-coordination flagging), and #5 (mock-can-lie audit) are vacuously satisfied. Emit explicit `n/a` notes in the per-slot audit table at the bottom of the test-plan (`'n/a — single-layer pure function'` is the canonical phrasing). Do NOT silently omit; reviewers and downstream readers should see the explicit suppression.
3. **Reviewer scope.** Reviewer pass is still required (subject to F-FRICTION-5 small-plan relief below); the brief should include the simplified-feature flag so the reviewer doesn't surface noise findings from the suppressed slots.

This is the trio's smallest sane footprint. The framing of "two layers per AC is normal" in the Layer picker §139 is correct for sliced multi-layer specs; this section names the exception path explicitly so reviewers don't bounce single-layer plans back to spec.

## Layer picker

The 10-name canonical taxonomy is from `05-doc-audit.md` "Proposed Canonical Taxonomy". Use these names verbatim — `tdd-impl-plan` and `tdd-execute` parse them strictly.

| Layer | Pick when | Don't pick for | Speed |
|-------|-----------|----------------|-------|
| `unit` | Pure TS/JS function or React component in isolation; deterministic logic. | Anything that needs RLS, real browser, or cross-service contract. | <5ms |
| `python-unit` | Pure Python function, Pydantic validation, state-machine logic. | DB, LLM, cross-service. | <10ms |
| `nextjs-db` | Next.js service-layer function + RLS check; CRUD with role isolation. | Pure logic (use `unit`); UI rendering (use `nextjs-browser`); cross-service flow (use `e2e`). | 200-500ms |
| `nextjs-browser` | Page routing, form interactions, auth UI, mocked Supabase. | Real DB behaviour (use `nextjs-db` or `e2e`); real auth tokens (use `e2e`). | 2-5s |
| `python-db` | Python service + Supabase write; trigger/constraint enforcement. | LLM behaviour (use `python-llm`); UI (use `e2e`). | 300-800ms |
| `python-llm` | Real Claude/Gemini SDK contract; streaming, tool calling, errors. | DB behaviour (use `python-db`); end-to-end flow (use `e2e`). | 2-5s |
| `code-integration` | Multi-step component flow with optimistic UI, race timing — heavy mocks. **High over-engineering risk** (`01-test-inventory.md` lines 600-604). | Anything that can be unit-tested; anything that needs real DB. Prefer `e2e` if real data matters. | 500ms-2s |
| `e2e` | Full user workflow across Next.js + Python + Supabase + real auth; outermost acceptance tests. | Pure logic; isolated service checks; anything you'd want to run on every push (slow). | 3-15s |
| `external` | Real third-party API contract (Sentry, Gemini, Unified.to). Nightly schedule. | Application logic; anything that should be deterministic in CI. | 1-5min |
| `sql-rls` | Schema constraints, RLS policies, triggers — pgTAP. | Service-level behaviour (use `nextjs-db` / `python-db`). | <100ms |

**Decision dimensions** (cite at least one in `rationale`):

- *behaviour* — the AC describes what layer's surface? (UI = browser; SDK = python-llm; DB write = nextjs-db / python-db.)
- *confidence* — how much do you need? (Pure logic -> unit; full stack -> e2e.)
- *speed* — what's the budget per push? (Push budget -> unit / sql-rls; nightly OK -> external.)
- *isolation* — how much real infrastructure can the test tolerate? (Pure -> unit; real stack -> e2e.)

Two layers per AC is normal (`08-spec-flow-trace.md` observation 8). One unit row for pure logic + one e2e row for the user-visible surface is a common shape.

## Failure-mode classes

Every test row has exactly one `failure_mode_class`. Definitions adapted from `06-linear-test-history.md` 4.1:

| Class | What it pins | Example |
|-------|--------------|---------|
| `happy` | The core behaviour works on the typical path. | "Owner uploads CSV; row count matches input." |
| `error` | A specific failure surfaces correctly to the user. | "Malformed CSV -> user sees `Could not parse row 3`, no partial write." |
| `race` | Concurrency / polling / retry / optimistic UI converges to the right state. | "Two simultaneous toggles result in the last-writer-wins state, not interleaved." |
| `chaos` | External dependency degrades (slow, flaky, partial outage); system stays correct. | "Sync worker resumes after VAIS 503 without losing struct_data updates." |
| `contract` | A derived/mirror invariant holds at every write-site. | "After every code path that mutates `drive_files.status`, `gfs_sync_items.status` matches" (ENG-5023). |

If you can't pick exactly one, the test asserts more than one thing — split it (Mandate #8: one failure per test).

## "Mock can lie" audit

Per ENG-4922 (`simulateSync()` lied about VAIS state) and ENG-4934 T1 (fake VAIS that didn't write struct_data passed every test). For every test with `external_dependencies.kind: mocked`, write a `mock_can_lie_note` answering: **"What contract drift between this mock and production would this test fail to surface?"**

Examples:

| Mock | Could lie about | `mock_can_lie_note` |
|------|-----------------|---------------------|
| `simulateSync()` (DB-proxy fake) | VAIS document state; only flips `gfs_sync_status`. | "Mock asserts only DB transition. If production fails to write `struct_data` (ENG-4922), this test passes. Pair with `external` or `fake-with-self-test`." |
| Mock Anthropic SDK returning canned tokens | Tool-call schema drift, streaming-event ordering, rate-limit shape. | "If real SDK changes event shape, mock keeps passing. Run `python-llm` row weekly against real SDK." |
| Mock Supabase HTTP layer | RLS denies; trigger fires; FK cascades. | "Mock can't enforce RLS. If a new policy denies an op, mock still returns 200. Pair with `nextjs-db` (real RLS) or `sql-rls` (policy assertion)." |

If your `mock_can_lie_note` reads "n/a" or "nothing", the mock probably *is* lying and you haven't found it yet — make the contract more specific, or upgrade `kind` to `fake-with-self-test` (per ENG-4934 T1: the fake itself has a self-test that fails when its production-shaped contract regresses).

## Mutation-pass cross-link

For test rows tagged `failure_mode_class: contract` or `race`, recommend `mutation_pass.required: true` to `tdd-impl-plan` (memo 4b). The recommendation lives in the per-test `rationale` field — `tdd-impl-plan` reads it and decides. ENG-4934 is the model: take the test suite as given, deliberately break the production code 9+ ways, prove each break is caught by >=1 test. This is Mandate #12 (good tests, not just working tests) made operational.

## What this skill does NOT do

- **Does not write any test code.** That's `tdd-execute`.
- **Does not order tests for execution.** Topological order, walking-skeleton detection, format-before-tdd commits — all live in `tdd-impl-plan`.
- **Does not pick mock libraries, fixture builders, or test-framework idioms** beyond the layer name. Per-layer guidance lives in `docs/testing/writing-tests.md` (after the ENG-5367 patches land).
- **Does not validate that proposed assertions are achievable.** `tdd-impl-plan` does that during ordering (walking-skeleton check).
- **Does not pick which tests are "TDD vs verification-only."** `tdd-impl-plan` does that.
- **Does not run any tests.** No execution, no live runs, no DB calls.

## Coexistence

| Skill | Relationship | Notes |
|-------|--------------|-------|
| `slicing-specs` | **Upstream** — produces input. Run test-architecture next when slicing produces >3 slices or any slice has cross-service seams (memo 4a trigger rule). |
| `tdd-impl-plan` | **Downstream consumer** — reads `test-plan.md` and emits `impl-plan.md`. The schema in this skill is the contract between them. |
| `tdd-execute` | **Downstream consumer (transitive)** — references `test-plan.md` rows by `id`. The `outermost: true` row is the one its Director must end Green on (Mandate #11). |
| `tdd-ci` | **Called by** — Red phase markers (`test.failing` / `xfail`) policy lives in `tdd-ci`. test-architecture only names the test; `tdd-execute` applies the marker. |
| `spec` | **Upstream contract** — ACs must be behaviour-level. If a spec's ACs read like test names, bounce back. |
| `worker-reviewer` | **Coexists** — for small modules. test-architecture is the planning skill; `worker-reviewer` is execution for atomic single-module work. The trio (this + impl-plan + execute) is for sliced features with cross-layer seams. |

## Mandate alignment

Each Mandate from memo 3 that touches test design is reflected here:

| Mandate | Where reflected |
|---------|-----------------|
| #2 (outer first) | Required slot #1; `outermost: true` field; Layer picker note (e2e is where outermost acceptance tests live). |
| #4 (red must be observed) | `assertion_shape` field commits to what failure should look like; `tdd-execute` observes actual `failureMessage` and compares. |
| #7 (tests assert behaviour) | "Mock can lie" audit; `assertion_shape` is one sentence of behaviour, never an impl detail; Layer picker flags `code-integration` as over-engineering risk. |
| #8 (one failure per test) | `failure_mode_class` is single-valued; "if you can't pick exactly one, split it." |
| #11 (outermost tagged) | Required slot #1; refuse-to-emit if missing. |
| #12 (good tests) | `mutation_pass` cross-link for `contract` / `race` rows; ENG-4934 model. |

## Style

- Tables over prose. The plan file is parsed by `tdd-impl-plan`; the SKILL.md is read by you.
- Cite ENG-IDs (and feedback memo names) when grounding a claim. "Because ENG-4922" beats "because of bugs in production."
- One sentence per `assertion_shape`. If you need two, split the test.
- No emoji, no hedging. The plan is a contract.
