# test-architecture — Skill Lab (purpose)

## Intent

The `test-architecture` skill makes test layering a typed, reviewable artefact instead of a judgement an implementing agent makes silently while writing code. It exists because of the structural gap that ENG-1809 named: the liaison skill says "TDD" but every implementation agent (session `9e966133` is the canonical proof) writes tests alongside code, with no enforcement and no upstream artefact pinning what each test should pin. Above that, ENG-2030 (GFS Sync Unification) showed the cost when nobody owns the test architecture: 14 assertions silently weakened across a multi-phase refactor, "tests pass" accepted as the green signal. The skill closes the gap by producing a typed `test-plan.md` — outermost test named, every AC mapped, every write-site enumerated, every mock interrogated for what it could hide — before any test or production code is written.

Position in the trio: `slicing-specs` is upstream (produces slices + seams; behaviour-level ACs); `tdd-impl-plan` is downstream (orders the test rows into a Red→Green→Refactor sequence and decides TDD vs verification-only per step); `tdd-execute` is the executor. test-architecture owns the *what* and *where*: the shape of each assertion and the layer it lives at. It does not order, it does not run, it does not write test code.

## Success Signals

**Inputs were honored:**
- [ ] Spec was read end-to-end; ACs are behaviour-level (not test names)
- [ ] All slices and seams from `slicing-specs` are accounted for
- [ ] `01-test-inventory.md` decision tables and `05-doc-audit.md` taxonomy were re-read this session

**Coverage:**
- [ ] Every AC id appears in ≥1 test row's `ac_ids` (no orphan ACs)
- [ ] Every user-visible behaviour has exactly one `outermost: true` row
- [ ] m:n AC↔test mapping is preserved (per `08-spec-flow-trace.md` observation 2 — most ACs need 3–5 tests)

**Layer choices:**
- [ ] Each test row has a `rationale` that cites at least one of: behaviour / confidence / speed / isolation
- [ ] No layer aliases used — only the 10 canonical names
- [ ] `code-integration` rows are sparing (high over-engineering risk per `01-test-inventory.md` lines 600–604)

**Failure-mode coverage:**
- [ ] Every derived/mirror field has one `failure_mode_class: contract` row per write-site (ENG-5023)
- [ ] Every async-coordination AC (polling, optimistic UI, retry, race, concurrency) has a `failure_mode_class: race` row alongside happy path (ENG-2821 cluster)
- [ ] Every test has exactly one `failure_mode_class` (Mandate #8)

**Mock honesty:**
- [ ] Every test with `external_dependencies.kind: mocked` has a non-trivial `mock_can_lie_note` (ENG-4922 / ENG-4934 T1)
- [ ] Tests claiming `kind: fake-with-self-test` reference where the self-test lives

**Process:**
- [ ] Plan validates against `schema/test-plan.schema.json`
- [ ] One unseeded reviewer pass run; all findings applied (single iteration; no re-review)
- [ ] One-page summary delivered to the liaison alongside the YAML

## Known Limitations

- **Honor-system items.** Mandate #7 (behaviour vs implementation) and Mandate #12 (test resilience) cannot be mechanically enforced by this skill — they're judgement calls that surface during the unseeded reviewer pass and (for high-risk slices) the optional mutation-pass epilogue at `tdd-execute`. The skill's "Mock can lie" audit is the strongest mechanical proxy we have, and it's still imperfect.
- **Edge cases are discovered, not specified.** Per `08-spec-flow-trace.md` observation 6, edge case tests are typically discovered during Red/Green. The plan can name failure-mode classes and write-sites it knows about; it cannot enumerate the unknowns. Expect the actual test count to grow ±20% during execution.
- **Layer choice is informed by inventory, not absolute.** The taxonomy is the contract between this skill and `tdd-impl-plan`; the choice of layer per AC is still a judgement (informed by behaviour / confidence / speed / isolation). Two reasonable test-architects can produce different plans for the same spec; the reviewer pass catches obvious miscalls but not all of them.
- **No execution validation.** `tdd-impl-plan` does the walking-skeleton check (does the outer test even resolve imports?) — not us. A plan can name an `outermost: true` test against an endpoint that doesn't exist yet, and we'll happily emit it. That's by design; impl-plan's job to flag.
- **Cross-slice seam handling is open (memo §7 q7).** Default: integration test between two slices is an `outermost: true` test in the *consumer* slice's plan, with `external_dependencies` pointing to the producer's contract. Whether this composes when running two slices back-to-back will be confirmed in the dry-run.
- **Mutation-pass opt-in mechanism (memo §7 q3).** Currently per-test `rationale` recommends; `tdd-impl-plan` decides via `mutation_pass.required`. Whether this should auto-trigger for all `contract` / `race` rows or remain opt-in is a dry-run question.

## Ideas / Notes

- **Empirical anchors:**
  - **ENG-4922 / ENG-4924 / ENG-4934** — VAIS struct_data didn't get rewritten on access-level toggle; pre-existing test mocked the worker (`simulateSync()`) and read DB proxy state instead of querying VAIS. Drives the "mock can lie" audit and the `failure_mode_class: contract` requirement.
  - **ENG-5023** — `drive_files` ↔ `gfs_sync_items` mirror divergence across 11 audited write-sites, three failure modes. Drives required slot #3 (write-site enumeration).
  - **ENG-2821** chaos cluster — Fathom polling/race regressions. Drives required slot #4 (async-coordination flagging).
  - **ENG-5031** — disambiguation test couldn't exist at Red phase because the disambiguating signal was Green's invention. Test-architecture can name the test row and mark it; `tdd-impl-plan` decides Red-phase vs deferred via `# TODO(green, ENG-XXXX):` markers (memo §4b).
  - **ENG-4934** mutation pass — gold-standard test-quality validation. Cross-linked from `failure_mode_class: contract` and `race` rows so `tdd-impl-plan` can opt slices in.
  - **ENG-1809** — the founding TDD-honesty retro. The skill's existence is the structural answer to "no enforcement mechanism exists."
- **Single-iteration discipline.** Per `feedback_single_iteration_review`, run one reviewer pass, fix everything, ship. Re-reviewing test plans is the same trap as re-reviewing code — diminishing returns + reviewer drift. If the plan needs architectural rework after one pass, that's a different phase.
- **Don't seed reviewers.** Per `feedback_liaison_review_seeding`: brief is spec + slices + diff. No "what about X?" questions.
- **Test-architecture is conversation-first like `spec`.** When the slice is complex, walk the user through the proposed layer picks for ACs they care about before writing the YAML. Don't ask them to review the YAML.

## Changelog

| Date | Change | Motivation |
|------|--------|-----------|
| 2026-04-26 | Lab created | ENG-1809 / session `9e966133` enforcement gap; ENG-2030 14-assertion erosion; ENG-4922 / ENG-5023 / ENG-2821 cluster all point to a missing typed test-architecture artefact. |
