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

### 3. Propose Sections

Present section outline. Get approval or adjust.

**Acceptance Criteria and Verification Expectations are always the final two sections.** They come last because they synthesize everything discussed in earlier sections. By the time you reach them, the requirements and constraints are clear, making it easier to write precise, testable criteria.

The outline should always end with:
- ... (feature-specific sections)
- Acceptance Criteria
- Verification Expectations

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

## Required Sections

Every spec must include these sections. The order and grouping of other sections is flexible, but these are non-negotiable.

### Acceptance Criteria

Define what "done" means for the feature as a whole. These are the conditions that must be true before the feature is considered complete.

Write them as informal, testable statements. Each criterion should be verifiable — if you can't tell whether it's true or false by looking at the app, it's too vague.

**Good criteria:**
- "User sees an error toast when save fails with a network error"
- "Deleted projects no longer appear in the project list or search results"
- "Chat works with 0 files, 1 file, and 100+ files attached to the project"

**Bad criteria:**
- "The feature works correctly" (not testable)
- "Performance is good" (not measurable without a threshold)
- "Error handling is robust" (what errors? what handling?)

**Tips:**
- Cover happy path, error cases, and edge cases
- Include cross-cutting concerns: permissions, empty states, limits
- If a criterion feels too big, it probably maps to multiple vertical slices — that's fine at the spec level, the slicing skill will decompose it later

### Verification Expectations

Define *how* each acceptance criterion should be verified, and at roughly what level. This section is written for two audiences: the implementing agent (who writes the tests) and the verification agent (who checks the work at the end).

Don't prescribe test implementation — the implementer decides mocks, fixtures, and test structure. Do specify *what* needs automated tests vs. visual verification, and at what level of the test pyramid.

| Level | When to specify | Example |
|-------|----------------|---------|
| **Unit** | Pure logic, transformations, validation rules | "Slug generation handles unicode, spaces, and collisions" |
| **Integration (DB)** | Data access, RLS policies, service layer | "Only workspace members can see the project" |
| **Integration (Browser)** | UI flows, routing, auth states | "Form shows validation errors inline without page reload" |
| **Integration (LLM)** | Agent behavior, streaming, SDK contracts | "Chat endpoint streams SSE events with correct format" |
| **E2E** | Critical user journeys, cross-service flows | "User creates project, uploads file, and chats — full flow" |
| **Visual/Manual** | Styling, layout, animations | "Card layout matches Figma on mobile and desktop" |

Reference `docs/testing/README.md` for the full test type matrix when choosing levels.

**Format each expectation as:**

> **What:** [behavior to verify]
> **Level:** [unit / integration-db / integration-browser / integration-llm / e2e / visual]
> **Notes:** [context for implementer — known edge cases, related existing tests, etc.]

The "Notes" field is optional — use it when there's something non-obvious the implementer should know.

**Criteria that span multiple slices:** Some acceptance criteria can only be fully verified after multiple slices land. Mark these as "end-to-end verification — after all slices" so the verification agent knows to check them at the end, not per-slice.

## Spec Style

| Do                | Don't           |
| ----------------- | --------------- |
| Concise           | Fluff           |
| Informal          | Corporate speak |
| Focused           | Bloat           |
| Tables over prose | Walls of text   |

## Downstream: How the Spec Gets Used

This spec feeds into a pipeline. Writing it well makes everything downstream better.

| Stage | What happens | What it reads from the spec |
|-------|-------------|-----------------------------|
| **Slicing** | Spec is decomposed into vertical slices, each a Linear sub-issue | Acceptance criteria → per-slice criteria |
| **Implementing** | Each slice is built with TDD | Per-slice criteria → what tests to write and at what level |
| **Verification** | A verification agent systematically checks the finished work | Acceptance criteria + verification expectations → structured QA pass |

The acceptance criteria are the contract between these stages. Write them with all three consumers in mind:

**For the slicer:** Criteria should be decomposable. Each criterion should map to one or a few slices. If a criterion is too tangled to slice, it needs to be broken down further in the spec itself.

**For the implementer:** Verification expectations should give enough signal to choose the right test type and level, without dictating implementation. "Only workspace members can see the project" tells the implementer to write an RLS integration test without prescribing the fixture setup.

**For the verification agent:** Acceptance criteria should be directly checkable by an agent with browser access but no implementation context. Write them as observable behaviors: "User sees X when Y happens." Avoid criteria that require reading code or database state to verify — if the verification agent can't confirm it through the UI or API, it belongs in the verification expectations as an automated test, not as something to manually check.
