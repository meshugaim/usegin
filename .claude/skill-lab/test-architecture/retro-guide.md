# test-architecture — Retro Guide

This guide is invoked by the `skill-retro` skill (which reads the SPLIT layout: `purpose.md` + `retro-guide.md`). Use it to evaluate how well a session followed the `test-architecture` skill — for the slicer-equivalent role: did the skill produce a good test plan?

The question we're answering: **knowing what the implementer encountered, was the test plan worth its tokens?**

## Context Sources

- **Linear:** the parent spec issue and slice sub-issues. Read `plan show <spec-id> --tree` to see the slice map; `plan show <slice-id>` for individual slice descriptions.
- **The artefact:** `docs/specs/<feature>/test-plan.md` (or `docs/research/tdd-skills/<feature>/test-plan.md`). This is the load-bearing output. Read it directly — don't trust session memory.
- **Session transcript:** read what the agent decided and why (rationale field is the trace).
- **Downstream artefacts:** `impl-plan.md` (from `tdd-impl-plan`) — does it cleanly consume what we emitted? `events.jsonl` (from `tdd-execute`) — did execution surface gaps the plan should have caught?
- **The schema:** `.claude/skills/test-architecture/schema/test-plan.schema.json` — the plan should validate against this. Run a JSON-schema check; if it fails, that's a problem before you read further.

## Retro Steps

For each step, **what counts as a problem** is in italics.

1. **Required-slot check.** Walk the five required slots in SKILL.md against the actual plan.
   - Outermost test exists? AC coverage complete? Write-sites enumerated? Async-coordination flagged? Mock-can-lie notes present?
   - *Problem if:* any required slot is missing or its content is generic ("n/a", "nothing", a copy of the AC text). The skill is supposed to refuse-to-emit; if the plan exists with a missing slot, the refusal logic didn't fire.

2. **Layer-choice rationales.** Read every `rationale` field. Each must cite at least one of: behaviour / confidence / speed / isolation.
   - *Problem if:* rationales are vague ("seems right"), copy the AC verbatim, or pick `code-integration` without acknowledging the over-engineering risk (`01-test-inventory.md` lines 600–604). `code-integration` should be sparingly used; if a slice has 3+ rows, the picker probably defaulted to it.

3. **Outermost vs inner balance.** Count `outermost: true` rows.
   - *Problem if:* zero (refusal didn't fire — should never happen), or every row is outermost (the picker collapsed everything into e2e). Healthy ratio per `08-spec-flow-trace.md` observation 8 is roughly one outermost per user-visible behaviour, with 2–4 inner rows.

4. **AC↔test fanout.** Sample 3–4 ACs and check `ac_ids`.
   - *Problem if:* most ACs map to exactly one test (m:n violation per `08-spec-flow-trace.md` observation 2 — typical is 3–5 tests per AC). Or: any AC has zero test rows pointing at it (orphan AC; required slot violation).

5. **Mock-can-lie quality.** Read every `mock_can_lie_note`.
   - *Problem if:* the note is generic ("the mock could be wrong"), or describes a generic property of mocking rather than a specific contract drift this mock could hide. The ENG-4922 example is the bar: name the field that wouldn't get checked.

6. **Did execution surface gaps the plan should have caught?** Read `tdd-execute`'s `events.jsonl` for the slice. Were there test rows added at Green that weren't in the plan? Were there `failure_mode_class: race` bugs that surfaced without a corresponding test?
   - *Problem if:* >20% of executed tests weren't in the plan (per `08-spec-flow-trace.md` observation 6, ±20% is healthy edge-case discovery; >20% suggests the plan under-specified). Or: a chaos/race bug surfaced in production after the slice landed and the plan didn't have a sibling row for that class.

7. **Process discipline.** Was the reviewer pass single-iteration? Was the reviewer unseeded? Was the user shown the YAML or only a one-page summary?
   - *Problem if:* multiple reviewer passes (re-review trap, `feedback_single_iteration_review`), or the reviewer brief contained "key questions" (seeding violation, `feedback_liaison_review_seeding`), or the user was asked to review the full YAML (failure to mirror `spec`'s conversation-first model).

8. **Honesty about honor-system items.** Did the agent acknowledge the limits of mechanical enforcement (Mandate #7, #12 are honor-system) when reporting?
   - *Problem if:* the report claims "test architecture is bulletproof" or similar overconfidence. The plan's job is to *raise the floor*, not to prove tests are good. Mutation-pass at `tdd-execute` is the actual quality signal.

## Verdict Scale

Per `skill-retro` convention, classify the session as one of:

| Verdict | Meaning |
|---------|---------|
| **Worked well** | All required slots present and substantive. Layer rationales cite a dimension. m:n fanout healthy. Mock-can-lie notes specific. Execution discovered <20% net-new tests. Single-iteration reviewer pass with all findings applied. |
| **Partially** | Plan emitted and validates, but: some rationales generic, some required-slot content thin, or execution surfaced 20–40% net-new tests (under-specification). The skill produced value but missed coverage in a way the dry-run / next session should fix. |
| **Collapsed** | Required slot missing (refusal logic didn't fire), orphan ACs, no `outermost: true` row, or generic mock-can-lie notes throughout. Layer choices weren't justified. The skill ran but produced an artefact that downstream agents had to work around. |

## Linkage

This guide is invoked by `skill-retro` (which will be patched to read the SPLIT layout per memo §8 task 2). Until that patch lands, manual invocation: `skill-retro` with `args: skill=test-architecture lab=split`.
