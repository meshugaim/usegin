---
name: slicing-specs
description: Decompose a spec into ordered vertical slices as Linear sub-issues. Triggered by "slice this spec", "break into slices", "decompose spec", "create slices for", or "vertical slices for".
---

# Slicing Specs

Decompose a spec into ordered, implementable vertical slices — each a Linear sub-issue under the spec's parent issue.

**Upstream:** `writing-specs` (the spec must have acceptance criteria and verification expectations).
**Downstream:** `implementing-specs` (implementers pick up individual slice issues).

## What This Skill Produces

For a spec living in a Linear parent issue, this skill creates:

1. **Ordered sub-issues** — one per slice, each with its own acceptance criteria and verification expectations
2. **A slice map** — appended to the parent issue description, showing the proposed execution order and how slices connect
3. **Seam notes** — where slices share types, API contracts, or DB schema

## Workflow

### 1. Read the Spec

```bash
plan show <spec-issue-id>   # Full spec with acceptance criteria + verification expectations
```

Read the entire spec. Identify:
- All acceptance criteria
- All verification expectations
- Referenced files, modules, and patterns
- Constraints and open questions

If the spec is missing acceptance criteria or verification expectations, **stop**. Tell the user the spec needs those sections first (point them to `writing-specs`).

### 2. Explore the Codebase

Follow references from the spec — understand the current state of the code:
- Where the change lives (which services, which layers)
- What patterns exist for similar features
- What infrastructure already exists (test harnesses, shared types, DB tables)
- What's missing that will need to be built first (see "Infrastructure Slices" below)

### 3. Decompose

Map each acceptance criterion to one or more slices. Work through this mentally:

| Question | Why |
|----------|-----|
| Which criteria are independent? | Independent criteria → separate slices |
| Which criteria depend on shared infrastructure? | Shared infra → first slice |
| Which criteria span the full stack? | Each vertical slice should touch all layers it needs |
| Which are riskiest or least understood? | These go first in the order |
| Which criteria can only be verified after others land? | These inform ordering and "after all slices" markers |

**A good slice:**

| Quality | Test |
|---------|------|
| **End-to-end** | Touches all layers needed (DB → API → UI), not just one |
| **Independently shippable** | Works on its own, even if the feature is incomplete |
| **Demonstrable** | You can show it working |
| **Right-sized** | One migration max. Describable in one sentence. Implementable in a single agent session without context pressure |
| **Traceable** | Maps back to specific acceptance criteria from the spec |

**Decomposition approach:** Start from user-facing behavior and work backward. "User can see X" is a better slice than "Add database table for X."

### 4. Order the Slices

Sequence the slices with these priorities (highest first):

1. **Infrastructure first** — test harnesses, shared types, DB schema that other slices need
2. **Riskiest next** — the slice most likely to change the plan if it goes wrong
3. **Dependencies respected** — if slice B needs slice A's output, A comes first
4. **Coherence** — slices that share seams (types, API contracts) are adjacent so the seam is fresh in context

### 5. Write Slice Descriptions

For each slice, draft a sub-issue description containing:

**Title:** `scope: what it does` — short, scannable, imperative. The label carries the type (feature/chore/bug).

**Description:**

```
## What

One sentence: what this slice delivers from the user's perspective.

## Acceptance Criteria

- Criterion 1 (tightened from spec-level criterion)
- Criterion 2
- ...

## Verification

- **What:** [behavior]
  **Level:** [unit / integration-db / integration-browser / integration-llm / e2e / visual]
  **Notes:** [optional context]

## Seams

How this slice connects to adjacent slices:
- Depends on: [slice N — what it provides]
- Provides to: [slice M — what this slice produces that M needs]

## Context

- Parent spec: [ENG-XXX — read for full feature context and constraints]
- Key files: [paths the implementer should read first]
- Patterns to follow: [existing similar implementations]
- Risks: [anything non-obvious]
```

The slice should be self-contained enough to implement without reading the parent spec. But the parent spec provides the "why" and the bigger picture — implementers should read it during orient for better decisions, especially around seams and cross-slice concerns.

**On tightening criteria:** The spec's acceptance criteria are informal and feature-level. Per-slice criteria should be precise and directly testable. "Chat works with 0 files, 1 file, and 100+ files" at the spec level might become "Chat endpoint returns empty context message when project has 0 files" for a specific slice.

**On verification expectations:** Inherit the level from the spec's verification expectations, but add slice-specific detail. If the spec says "integration-db" for a criterion, the slice should note which service function and what role-based scenarios to cover.

### 6. Present to User

Present all slices at once as a summary. Use `AskUserQuestion` for feedback:

| Question | Options |
|----------|---------|
| How does this slicing look? | "Looks good", "Needs changes — I'll describe" |
| Anything to add, remove, or reorder? | "No", "Yes — I'll describe" |

If changes are needed, adjust and re-present. Don't create sub-issues until the user approves.

### 7. Create Sub-Issues

Once approved, create all slices as Linear sub-issues:

```bash
# For each slice:
plan create "scope: what it does" --parent <spec-issue-id> --label feature
```

Then update each issue's description with the full slice description:

```bash
plan update <slice-issue-id> --description "..."
```

Use `plan docs show iterative-descriptions` for the mechanics of writing descriptions to Linear.

### 8. Update Parent Issue

Append a slice map to the parent spec issue:

```
## Slice Map

| # | Issue | Summary | Status |
|---|-------|---------|--------|
| 1 | ENG-XXX | Infrastructure: test harness + shared types | Pending |
| 2 | ENG-YYY | User can create a widget | Pending |
| 3 | ENG-ZZZ | Widget respects permissions | Pending |
| 4 | ENG-AAA | Widget handles edge cases (empty, limits) | Pending |

**Ordering rationale:** [1-2 sentences on why this order]

**Cross-slice verification:** [criteria that can only be checked after all slices land]
```

```bash
plan update <spec-issue-id> --description "..."
```

## Infrastructure Slices

Sometimes the first slice isn't a feature — it's setting up what other slices need:

- A new test harness or fixture pattern
- Shared types or API contracts
- A DB migration that multiple slices build on
- A feature toggle skeleton

This is a valid slice. Give it its own sub-issue. Don't bury infrastructure setup inside a feature slice — it obscures scope and makes the feature slice too big.

**TDD skip label:** Infrastructure slices that don't contain testable implementation logic (e.g., pure migrations, config files, type definitions) should be labeled `tdd:skip`. This tells the auto-implement pre-commit TDD gate to allow commits without test files. Add the label when creating the sub-issue:

```bash
plan create "infra: add shared types for widget" --parent <spec-id> --label chore --label tdd:skip
```

## Edge Cases

**Spec has only 1-2 acceptance criteria:** The feature might be small enough that slicing is unnecessary. Tell the user — they may want to skip straight to `implementing-specs`.

**Criteria that can't be sliced vertically:** Some criteria are inherently horizontal (e.g., "all API endpoints return consistent error shapes"). These become a single slice that cuts across, or a set of per-endpoint slices. Use judgment — if it's a refactor across many files, it's one slice. If each endpoint is independent work, it's many.

**Spec has open questions:** If the spec contains unresolved questions that affect how you'd slice, surface them to the user before proposing slices. Don't guess.

## What This Skill Does NOT Do

- **Write code** — that's `implementing-specs`
- **Write the spec** — that's `writing-specs`
- **Verify the finished work** — that's the verification agent
- **Decide test implementation** — the implementer chooses mocks, fixtures, and test structure
