# writing-specs — Skill Lab

## Intent

The spec-writing skill ensures specs are implementation contracts, not just design documents. It exists because agents (and humans) naturally write thorough design documents but skip the "done when" and "verify by" sections — an audit of 21 specs (March 2026) found 62% missing acceptance criteria and 57% missing test plans, while structure was strong in 67%.

The skill governs the full spec lifecycle: understand the problem, ask questions, write section-by-section with user feedback, and produce a numbered AC + test plan table as the contract for downstream consumers (slicers, implementers, verifiers).

Success means: a spec that orients an implementer, holds up as a contract during implementation, and stays out of the way when the implementer needs to make design decisions.

## Two Retro Perspectives

This lab has two distinct evaluation perspectives, triggered at different times:

| Perspective | When to trigger | What it evaluates | Retros go in |
|---|---|---|---|
| **Writer** | After a spec is written | Did the skill produce a good spec? (process + output quality) | `retros/writer/` |
| **Implementer** | After implementation is complete | Did the spec serve the implementer well? (hindsight evaluation) | `retros/implementer/` |

The writer perspective is a standard skill retro — did the process produce quality output?

The implementer perspective is different — it's not an implementation retro. It's a spec retro from the implementer's vantage point: "now that I've built this, what do I think of the spec I built it from?"

**Routing for `skill-retro`:**
- If the session **wrote a spec** → use the **Writer** perspective, write to `retros/writer/`
- If the session **implemented from a spec** → `skill-retro` Step 6 offers the spec retro as a follow-up. Use the **Implementer** perspective, write to `retros/implementer/`
- Never mix perspectives in one retro entry

---

## Writer Perspective

### Success Signals

**Understanding & framing:**
- [ ] Problem statement is concrete — names the gap, not just the feature
- [ ] Context was gathered before writing (codebase exploration, docs, existing patterns)
- [ ] Feature toggle question was asked early

**Spec body quality:**
- [ ] Sections use tables over prose where appropriate
- [ ] Scope is unambiguous — In/Out or Non-goals with reasons for exclusions
- [ ] Architecture decisions include rationale, not just the choice
- [ ] Reference files included for implementer orientation
- [ ] Open questions resolved or tracked as separate spikes — no "TBD" in the body
- [ ] Research findings referenced by path, not inlined
- [ ] Code snippets marked as illustrative (if present at all)

**AC + test plan:**
- [ ] AC table exists with `# | Criterion | Level` format
- [ ] Criteria cover happy path, error cases, and edge cases
- [ ] If feature touches multiple code paths, each path has its own criterion
- [ ] Every criterion has a test level assigned

**Process:**
- [ ] Section-by-section flow followed with user feedback between sections
- [ ] Self-check was run before finalizing
- [ ] Slicing question was asked after completion

### Retro Guide

1. **Check problem framing** — Does the spec open with a clear problem? Could someone unfamiliar with the project understand *why* this feature exists from the first section alone?
2. **Check structure** — Tables vs prose ratio. Are sections scannable? Is the spec concise or bloated with inlined research?
3. **Check scope** — Is there explicit In/Out or Non-goals? Any features half-in, half-out? Any "future" items mixed into current-scope tables?
4. **Check decisions** — Search for "TBD", "to be decided", "open question". Are architecture decisions backed by rationale? Are alternatives acknowledged?
5. **Check references** — Does the spec point implementers at specific files and existing patterns? Or does it describe in the abstract?
6. **Check AC + test plan** — Does the table exist? Numbered? Every row has a level? Coverage across happy/error/edge? Map criteria against spec sections — any described behavior missing from the table?
7. **Check workflow** — Was feedback solicited per section? Was self-check run? Was slicing question asked?

---

## Implementer Perspective

*Evaluating the spec's quality — with the benefit of having implemented it.*

### Success Signals

**Did the spec orient me well?**
- [ ] Problem, scope, and constraints were clear enough to start without re-researching
- [ ] Reference files were accurate and pointed me at the right code
- [ ] Architecture decisions were sound — I didn't need to relitigate them

**Did the spec hold up as a contract?**
- [ ] I didn't need to invent criteria beyond what the AC + test plan provided
- [ ] No scope questions arose that the spec should have answered upfront
- [ ] No blocking decisions were left for me to figure out
- [ ] No bugs trace back to behavior the spec left unspecified

**Did the spec stay out of my way?**
- [ ] Spec didn't prescribe implementation details I had to work around
- [ ] Test levels pointed me in the right direction without boxing me in
- [ ] Spec left room to discover the right approach through the codebase

### Retro Guide

*The question is: knowing what I know now, how good was the spec?*

1. **What did I have to figure out that the spec should have told me?** — Scope gaps, missing context, undocumented constraints. These are the things that slowed me down or led me astray.
2. **What did the spec get wrong?** — Architecture decisions that didn't survive contact with the code. Assumptions that turned out to be false. Scope that expanded or contracted.
3. **What criteria did I add?** — Any AC or test cases I invented that weren't in the spec. These are gaps the spec author missed.
4. **What bugs came from spec gaps?** — Bugs filed during implementation that trace to unspecified behavior (error responses, integration contracts, edge cases).
5. **What did the spec prescribe that I had to ignore?** — File paths that were wrong, code snippets that didn't apply, suggested approaches that didn't work. Over-prescription that constrained rather than helped.
6. **What did the spec get right?** — What made implementation easier. Patterns worth repeating in future specs.

---

## Known Limitations

- **The skill is interactive.** It requires a human in the loop for feedback. Autonomous spec-writing (e.g., by a liaison agent) bypasses the feedback prompts and the self-check.
- **Test level is guidance, not prescription.** The implementer may choose a different level with good reason. The spec's level is a starting signal, not a mandate.
- **The self-check is voluntary.** Nothing enforces that the spec author actually runs through it before finalizing.
- **Implementer retro requires memory.** The implementer needs to remember (or be able to reconstruct) what friction they hit. Running the retro immediately after implementation is best — waiting makes it lossy.
- **Writer and implementer may be different agents/sessions.** The writer retro happens in the writing session. The implementer retro happens in a different session, possibly weeks later. The lab file connects them, but the retro agent needs to read the spec to evaluate it.

## Ideas / Notes

- The March 2026 audit of 21 specs is the baseline. Future retros can measure whether the updated skill (merged AC + test plan table, self-check, slicing question) actually improves spec quality.
- Best specs from the audit: ENG-2004 (Linear integration), gfs-content-size-gate.spec.md, gfs-admin-reconciliation-actions.spec.md, ENG-2217 (Risk Assessment). These can serve as reference examples.
- The implementing-time retro is novel — most skill labs only have writer/process retros. If this perspective proves valuable, consider adding it to other skills (slicing-specs, implementing-specs).

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-03-09 | Lab created with writer + implementer perspectives | Audit of 21 specs revealed systemic gaps (62% missing AC, 57% missing test plans). Lab enables tracking whether the updated skill fixes these. |
