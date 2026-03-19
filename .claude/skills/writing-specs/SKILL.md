---
name: writing-specs
description: This skill writes spec documents interactively. Triggered by "let's write a spec", "spec for XXX", "document this feature", or "create a spec".
---

# Writing Specs

Build specs collaboratively through understanding, questioning, and section-by-section refinement.

**Core principle:** Understand first, write second.

## Purpose of a Spec

Specs provide requirements and guidelines for a new agent that will need to implement, but might lack full context.

| Include | Exclude |
|---------|---------|
| Requirements and constraints | Prompts |
| Clear guidelines | Implementation details |
| Acceptance criteria | Test implementation specifics |
| Verification expectations | Mock strategies, fixture details |
| References to important files for context | |
| Links to relevant docs/resources | |

**On code snippets:** Avoid if possible. If included for clarity, mark as *illustrative* — implementation may differ. The implementing agent should discover the actual approach through referenced files, not copy-paste from the spec.

**On specifics:** When listing specific changes (files, sections, values), acknowledge that the implementer should verify and explore. We might have missed something, or things may have changed. Frame specifics as "known issues" or "starting points" rather than exhaustive checklists.

## Interaction Style

Be critical, creative, and helpful when asking questions and providing feedback. The goal is to create the best possible spec together.

Skip supportive remarks. Focus on substance: challenge assumptions, identify gaps, suggest alternatives.

## Workflow

### 1. Understand

User brain-dumps ideas. You gather context:
- Related code in the repo
- Relevant docs (context7, web search)
- Open source repos for reference (add to `.gitignore`)

Don't write yet. Just understand.

### 2. Ask Questions

Use `AskUserQuestion` to clarify until aligned on what needs spec'd.

Include in your questions:

- **Does this feature need a feature toggle?** Breaking changes, incomplete work that will be deployed incrementally, or gradual rollouts all need one. Catching this early affects slicing (toggle skeleton becomes an infrastructure slice) and verification (toggle must be enabled before testing). See the `feature-toggles` skill for when toggles apply.

- **For integrations: does the scoping model match how users actually organize their data?** When a spec introduces a scoping/filtering concept (which projects/folders/channels/teams the feature can see), validate the concept against a real account — not just the API documentation. Ask: "Do users actually use [the entity we plan to scope by]?" If the integration has a spike slice, include scoping validation in it. *Lesson learned: ENG-2004 (Linear integration) designed project-based scoping, but 0 of 2,120 real issues were assigned to Linear projects — all were organized by teams. The entire scoping model had to be reworked post-implementation.*

### 3. Propose Sections

Present section outline. Get approval or adjust.

**Acceptance Criteria is always the final section.** It comes last because it synthesizes everything discussed in earlier sections. By the time you reach it, the requirements and constraints are clear, making it easier to write precise, testable criteria.

The outline should always end with:
- ... (feature-specific sections)
- Acceptance Criteria

### 4. Write Section by Section

Write to a Linear issue description. Create an issue if needed (see `plan align` for workflow context, `plan docs show iterative-descriptions` for mechanics).

For each section:

| Step | Action |
|------|--------|
| 1 | Write/edit section in temp file |
| 2 | Push to Linear with `plan update` |
| 3 | PAUSE - get feedback (see below) |
| 4 | Apply changes if needed, `plan update` again |
| 5 | Move to next section when approved |

**Feedback via `AskUserQuestion` - three questions:**

| Question | Options |
|----------|---------|
| Feedback on this section? | "None/looks good", "Needs changes" |
| Other thoughts? (updates to previous sections, new ideas...) | "No", "Yes - I'll describe" |
| Next section? | List from outline + "Done" |

If other thoughts require changes to previous sections: edit them, `plan update`, then continue.

### 5. After the Spec is Complete

After all sections are approved and pushed to Linear, use `AskUserQuestion` to ask:

> **Should we recommend that the implementer slice this into vertical slices before implementing?**
> For features with 3+ acceptance criteria or that touch multiple layers (DB + API + UI), slicing helps. For small, focused features, the implementer can go straight to implementation.

If yes, append a note to the Linear issue description:

```
## Implementation Note

This spec is recommended to be sliced into vertical slices before implementing.
Use the `slicing-specs` skill (`/slice`) to decompose into ordered sub-issues.
```

## Required Sections

Every spec must include these sections. The order and grouping of other sections is flexible, but these are non-negotiable.

### Acceptance Criteria

Define what "done" means and how to verify it. Each criterion is a testable statement paired with a test level — this tells the implementer *what* to test and roughly *where*, without prescribing *how*.

Don't prescribe test implementation — the implementer decides mocks, fixtures, and test structure. Just specify the behavior and the level.

**Format as a numbered table:**

| # | Criterion | Level |
|---|-----------|-------|
| 1 | User sees error toast when save fails with a network error | integration-browser |
| 2 | Only workspace members can see the project | integration-db |
| 3 | Chat works with 0 files, 1 file, and 100+ files | integration-llm |
| 4 | Card layout matches Figma on mobile and desktop | visual |

**Available levels:**

| Level | When to use |
|-------|-------------|
| **unit** | Pure logic, transformations, validation rules |
| **integration-db** | Data access, RLS policies, service layer |
| **integration-browser** | UI flows, routing, auth states |
| **integration-llm** | Agent behavior, streaming, SDK contracts |
| **e2e** | Critical user journeys, cross-service flows |
| **visual** | Styling, layout, animations (manual/screenshot check) |

Reference `docs/testing/README.md` for the full test type matrix.

**Writing good criteria:**
- Cover happy path, error cases, and edge cases
- Include cross-cutting concerns: permissions, empty states, limits
- Each criterion should be verifiable — if you can't tell whether it's true or false, it's too vague
- If a criterion feels too big, it probably maps to multiple vertical slices — that's fine at the spec level
- Criteria that span multiple slices: mark as "after all slices" so the verification agent checks them at the end

**Bad criteria:**
- "The feature works correctly" (not testable)
- "Performance is good" (not measurable without a threshold)
- "Error handling is robust" (what errors? what handling?)

## Recommended Patterns

These are not required sections, but specs that include them consistently produce better downstream results.

**Reference files per section.** Each section can include a small table of file paths relevant to that section. Eliminates "where does this go?" for implementers.

**Scope clarity.** If the spec touches a concept, it's either in scope or explicitly out. No middle ground. Use a short In/Out table or a "Non-goals" list with reasons for each exclusion.

**"What Doesn't Change."** When a feature modifies existing behavior, state the invariants the implementation must preserve. This prevents regression anxiety and makes the blast radius visible.

**Decisions & Alternatives.** When open questions are resolved during spec writing, record them as a table: decision, alternatives considered, rationale. This captures not just *what* was decided but *what was rejected and why* — preventing re-litigating settled decisions and giving future readers the reasoning behind the path chosen. Especially valuable for specs where multiple approaches were explored (e.g., auth strategies, data model choices, architecture boundaries).

**Keep research out of the spec body.** Reference experiment files by path instead of inlining findings. The spec is for decisions and requirements, not a journal of investigation.

## Spec Style

| Do                | Don't           |
| ----------------- | --------------- |
| Concise           | Fluff           |
| Informal          | Corporate speak |
| Focused           | Bloat           |
| Tables over prose | Walls of text   |

## Self-Check Before Finalizing

Before marking the spec complete, verify these — they are the most common gaps found in an audit of 21 specs:

| Check | Question |
|-------|----------|
| AC completeness | Does every in-scope behavior have a numbered criterion? |
| Error coverage | Do ACs cover what happens when things fail, not just when they succeed? |
| All code paths | If the feature touches multiple paths (upload, sync, email), does each path have an AC? |
| Test levels | Does every AC have a level assigned? |
| Scope clarity | Is every feature clearly in or out? No ambiguous "future" items in the main body? |
| Decisions resolved | Are there zero "TBD" items? Each either resolved or tracked as a separate spike? |
| Scoping validated | If the spec introduces a scoping/filtering model, was it validated against a real account? |
| Linear in sync | If the spec was revised after initial writing, is the Linear issue description updated to match the on-disk version? Stale Linear descriptions create confusion — slices reference AC numbers that don't exist in the parent. |

## Downstream: How the Spec Gets Used

This spec feeds into a pipeline. Writing it well makes everything downstream better.

| Stage | What happens | What it reads from the spec |
|-------|-------------|-----------------------------|
| **Slicing** | Spec is decomposed into vertical slices, each a Linear sub-issue | Acceptance criteria → per-slice criteria + test levels |
| **Implementing** | Each slice is built with TDD | Per-slice criteria → what tests to write and at what level |
| **Verification** | A verification agent systematically checks the finished work | Acceptance criteria → structured QA pass |

The acceptance criteria table is the contract between these stages. Write each criterion with all three consumers in mind:

**For the slicer:** Criteria should be decomposable. Each criterion should map to one or a few slices. If a criterion is too tangled to slice, break it down further in the spec.

**For the implementer:** The test level gives enough signal to choose the right test type without dictating implementation. "Only workspace members can see the project" at `integration-db` tells the implementer to write an RLS test without prescribing fixtures.

**For the verification agent:** Criteria should be directly checkable as observable behaviors: "User sees X when Y happens." If it can only be verified by reading code, it belongs as an automated test (indicated by the level column), not as something to manually check.
