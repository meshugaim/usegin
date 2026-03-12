# spec-pipeline — Skill Lab

## Intent

The spec pipeline is `writing-specs` → `slicing-specs` → `implementing-specs` (via `auto-implement`) → `verify-spec`. Each stage has its own lab evaluating its own process. This lab evaluates the **interfaces between stages** — the information flow, the handoff quality, and whether the pipeline as a whole produces good outcomes efficiently.

Individual labs ask: "did this stage follow its process?" This lab asks: "did the pipeline work as a system?"

It exists because local optimizations can hurt the whole. Adding detail to a spec might help the implementer but overwhelm the slicer. Tightening slice descriptions might help the implementer but make slicing take twice as long. Changing verification expectations might catch more bugs but create false failures. The pipeline retro is where these trade-offs get surfaced.

Success means: information flows forward through the pipeline without loss, problems are caught as early as possible, no stage compensates for another's failures, and the total effort is proportional to the feature's complexity.

## When to Trigger

- After a spec has been through the full pipeline (written → sliced → implemented → verified)
- After individual skill retros on the same spec reveal patterns that span stages
- Periodically, to compare pipeline performance across multiple specs

This retro reads the individual stage retros as input — it integrates, it doesn't duplicate. Run individual skill retros first, then the pipeline retro.

---

## What It Evaluates

### The Four Interfaces

```
writing-specs ──①── slicing-specs ──②── implementing-specs ──③── verify-spec
                                                                       │
                                                                       ④
                                                                       │
                                                               implementing-specs
                                                               (bug fixes)
```

**① Spec → Slicing**
- Does the spec have enough for the slicer to decompose well? (AC, verification expectations, architecture decisions, referenced files)
- Does the spec leave the right things unspecified? (implementation details the slicer shouldn't need)
- Were spec ambiguities caught during slicing, or did they leak through to implementation?

**② Slicing → Implementation**
- Do slices serve the implementer? (right-sized, well-ordered, accurate seam notes)
- Are slice-level AC testable and precise, or vague copies of spec-level AC?
- Does the slice context (key files, patterns to follow) save the implementer orientation time?

**③ Implementation → Verification**
- Does the implementation leave enough for the verifier? (tests at expected levels, Linear state current, AC traceable)
- Are verification expectations from the spec still accurate after implementation? (or did the implementation reveal that the expected test level was wrong?)
- Can the verifier map failures back to specific AC and slices?

**④ Verification → Fix loop**
- Do bug reports enable efficient fixes? (reproduction steps, evidence, AC traceback)
- Does re-verification (failed-only mode) work smoothly?
- How many cycles does the loop take to converge?

### Cross-Cutting Concerns

Beyond the four interfaces, the pipeline retro also evaluates:

**Information loss** — Does critical context degrade as it flows through stages? A spec decision that's clear in the spec but missing from slice descriptions and unknown to the implementer is an information loss.

**Early detection** — Were problems caught at the earliest possible stage? A spec ambiguity should be caught during slicing (②), not during verification (③). An impossible test expectation should be caught during implementation, not during verification.

**Effort distribution** — Is time spent proportionally across stages? If slicing takes 10 minutes but implementation takes 20 sessions, the slicing may be too shallow. If verification takes longer than implementation, the spec's verification expectations may be impractical.

**Compensation patterns** — Is one stage doing another stage's job? If the implementer is rewriting slice descriptions, slicing failed. If the verifier is designing test strategies, the spec's verification expectations failed. If the slicer is making architecture decisions, the spec failed.

---

## Success Signals

### Information Flow

- [ ] Spec decisions survived intact through slicing and implementation — no relitigating
- [ ] Slice-level AC are traceable back to spec-level AC — nothing lost in decomposition
- [ ] Implementation is traceable to slices — each slice's AC was addressed
- [ ] Verification maps cleanly to spec AC — the verifier could check the contract

### Early Detection

- [ ] Spec ambiguities were caught during slicing, not implementation or verification
- [ ] Sizing problems were caught during slicing, not mid-implementation (context blowout)
- [ ] Test level mismatches were caught during implementation, not verification
- [ ] No "surprise" failures in verification that should have been caught earlier

### Effort Distribution

- [ ] Writing the spec took proportional effort (not too thin, not over-specified)
- [ ] Slicing produced slices in reasonable time without excessive back-and-forth
- [ ] Implementation sessions per slice were reasonable (~1:1)
- [ ] Verification ran smoothly without extensive debugging or environment setup

### No Compensation

- [ ] Slicer didn't have to make architecture decisions the spec should have made
- [ ] Implementer didn't have to rewrite slice descriptions or re-decompose work
- [ ] Implementer didn't have to invent verification strategies the spec should have specified
- [ ] Verifier didn't have to design test plans — just executed the spec's verification expectations

---

## Retro Guide

**Context sources:** Individual skill retro entries for this spec, the Linear issue tree, and optionally the spec document and key session transcripts.

```bash
plan show <spec-issue-id> --tree             # Full pipeline state
ls .claude/skill-lab/writing-specs/retros/   # Writing retros for this spec
ls .claude/skill-lab/slicing-specs/retros/   # Slicing retros
ls .claude/skill-lab/implementing-specs/retros/  # Implementation retros
ls .claude/skill-lab/verify-spec/retros/     # Verification retros
ls .claude/skill-lab/auto-implement/retros/  # Auto-implement chain retros
```

### Evaluation Steps

1. **Gather stage retros** — Read the individual skill retro entries for this spec. If any stage hasn't been retroed, note it — the pipeline retro works best with all stages evaluated. You can still proceed with partial coverage, but flag the gaps.

2. **Walk the interfaces** — For each of the four interfaces (①②③④), check: did information flow cleanly? Read the "Suggestions" sections of individual retros — suggestions often point at upstream or downstream stages. A writing-specs implementer retro that says "the spec didn't tell me X" is an ① signal. A verify-spec retro that says "tests were at the wrong level" is a ③ signal.

3. **Check for information loss** — Pick 2-3 spec decisions (architecture choices, scope boundaries, constraints). Trace each through the pipeline: is it in the spec? Is it in the slice descriptions? Did the implementer know about it? Did the verifier check for it? Where it drops out, that's the leak.

4. **Check for early detection** — Look at problems found during implementation and verification. For each: could it have been caught earlier? A verification failure traceable to a spec ambiguity means ① leaked. An implementation reorder means ② misjudged dependencies.

5. **Check for compensation** — Look for signs of one stage doing another's work. The implementer writing extensive test strategies → spec's verification expectations were insufficient. The slicer making scope decisions → spec left too many open questions. The verifier interpreting what AC "really means" → spec's AC were vague.

6. **Check effort distribution** — How many sessions did each stage take? Where was the bottleneck? Compare to the feature's complexity — a simple feature that takes 15 sessions to implement and 3 verification cycles has a pipeline problem, not a complexity problem.

7. **Synthesize** — The most valuable output of a pipeline retro is identifying which stage to improve for the highest leverage. Not "fix everything" but "if we could improve one stage's output, which would help the most downstream?"

### Output Format

Pipeline retro entries go in `retros/` and use this format:

```markdown
### YYYY-MM-DD — <spec-id> — <spec title>

**Pipeline verdict:** [smooth | friction at interfaces | broken handoffs]
**Stages retroed:** [list which stage retros informed this]

**Interface assessment:**
- ① Spec → Slicing: [clean / friction / broken] — [one sentence]
- ② Slicing → Implementation: [clean / friction / broken] — [one sentence]
- ③ Implementation → Verification: [clean / friction / broken] — [one sentence]
- ④ Verification → Fix loop: [clean / friction / N/A] — [one sentence]

**Information losses:** [what got lost where, or "none detected"]
**Late detections:** [problems caught later than they should have been, or "none"]
**Compensation patterns:** [stages doing other stages' work, or "none"]

**Highest-leverage improvement:**
[Which stage's output, if improved, would help the pipeline most? Be specific.]

**Suggestions:**
- [concrete cross-stage improvement ideas]
```

**Verdict scale:**
- **smooth** — information flowed cleanly, problems caught early, proportional effort
- **friction at interfaces** — pipeline worked but some interfaces lost information or caught problems late
- **broken handoffs** — one or more stages had to compensate for another's failures, or critical information was lost

---

## Known Limitations

- **Requires individual retros as input.** The pipeline retro integrates stage retros — it doesn't replace them. Running a pipeline retro without individual retros means guessing at stage-level problems.
- **Effort distribution is hard to measure precisely.** Session counts and durations are proxies. A 3-session implementation might be efficient or might be three wasted sessions. Individual retros provide the context.
- **Causation is hard.** "The implementer had to rewrite slice descriptions" could mean slicing was bad, or the implementer had different preferences, or the spec changed mid-flight. Use the individual retros to disambiguate.
- **Not every spec goes through all stages.** Small features might skip slicing. Bug fixes skip the whole pipeline. This retro applies to specs that went through at least writing → implementing → verifying.

## Ideas / Notes

- No pipeline retros have been run yet. The Linear integration spec (ENG-2004) is the first candidate — it has a writing-specs implementer retro and will eventually have slicing, implementing, and verification retros.
- Consider whether the pipeline retro should also evaluate the spec's lifecycle in Linear — issue states, timing, how long each stage took wall-clock. This would require checking issue history, not just current state.
- The ④ (verification → fix) loop is the least understood interface. It hasn't been exercised yet. When it is, its evaluation criteria may need refinement.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-03-12 | Lab created | Every individual pipeline stage had a lab referencing "pipeline retro" as a concept. Making it concrete so cross-stage insights have a place to live and a process to follow. |
