---
name: verify-spec
description: Verify a completed spec's implementation against its acceptance criteria. Triggered by "verify this spec", "verify spec", "check the implementation", "verify acceptance criteria", "QA this spec", or "run verification".
---

# Verify Spec

Systematically verify a completed spec's implementation against its acceptance criteria — through automated test checks and targeted manual testing via sub-agents.

**Pipeline:** `writing-specs` → `slicing-specs` → `implementing-specs` → **`verify-spec`** (you are here)

**Prerequisites:** All slices are done (closed in Linear), tests are passing, code is pushed.

## Workflow Overview

```
orient → environment & auth → classify criteria → automated checks → manual verification → report & file bugs
```

## 1. Orient

### Read the Spec

```bash
plan show <spec-issue-id> --tree   # Spec + sub-issues (slices) + status
```

Read the full spec. Focus on:

- **Acceptance criteria** — the contract you're verifying against
- **Verification expectations** — how each criterion should be verified and at what level
- **Slice map** — confirm all slices are marked Done

If slices are still open, **stop**. Tell the user — verification requires a complete implementation.

### Re-Verification Mode

Two modes:

| Mode | When | What it checks |
|------|------|----------------|
| **All** (default) | First verification, or full re-check | Every acceptance criterion |
| **Failed-only** | After bugs from a previous run are fixed | Only criteria that previously failed |

For failed-only: read the bug issues filed under the spec from the previous verification run. Extract which acceptance criteria they map to. Verify only those.

Use `AskUserQuestion` to confirm which mode:

| Question | Options |
|----------|---------|
| Verification mode? | "All criteria (default)", "Failed-only (re-verify previous bugs)" |

### Build the Verification Checklist

List every acceptance criterion with an ID for tracking:

```
AC-1: User sees error toast when save fails with network error
AC-2: Deleted projects no longer appear in project list or search
AC-3: Chat works with 0 files, 1 file, and 100+ files
...
```

This checklist is your scorecard throughout the process.

## 2. Environment & Auth

Follow the same environment and auth setup as the `app-sanity-test` skill:

1. **Ask environment** — local, staging, or production (via `AskUserQuestion`)
2. **Setup** — local requires `just agent-dev` + Supabase; staging/production need no setup
3. **Auth** — try existing session first, fresh sign-in if needed

See `app-sanity-test` skill sections 1-4 for the exact steps. The same patterns apply here — same env table, same auth flow, same `playwright-cli` commands.

**Local uses port 63000** (`just agent-dev`), not 3000.

## 3. Classify Criteria

Using the spec's verification expectations, split each criterion into a verification method:

| Method | When | Example |
|--------|------|---------|
| **Automated** | Spec says unit, integration-db, integration-llm, e2e | "Slug generation handles unicode" → check unit tests exist and pass |
| **Manual** | Spec says visual, or criterion describes observable UI behavior | "Card layout matches design on mobile" → browser verification |
| **Both** | Has automated tests AND observable UI behavior | "Form shows validation errors inline" → check tests + visually confirm |

Present the classification to the user:

```
Automated only:  AC-1, AC-4
Manual only:     AC-3, AC-7
Both:            AC-2, AC-5, AC-6
```

Get approval via `AskUserQuestion` before proceeding — the user may reclassify some criteria.

## 4. Automated Verification

For each criterion classified as automated (or both):

### Run the Test Suite

```bash
# Run all tests relevant to the feature
bun test                    # Unit tests (nextjs-app)
uv run pytest               # Unit tests (python-services)
```

Use the verification expectations to identify which test files and test types to check.

### Verify Test Coverage

For each automated criterion, confirm:

| Check | How |
|-------|-----|
| Tests exist | Search for test files covering the criterion's behavior (`Grep` for relevant test names/descriptions) |
| Tests pass | Run the specific test file or suite |
| Level matches | Spec says "integration-db" → verify it's actually an integration test, not just a unit test with mocks |

### Record Results

For each criterion:
- **Pass** — tests exist at the expected level and pass
- **Fail: missing tests** — no tests found for this criterion
- **Fail: tests failing** — tests exist but fail
- **Fail: wrong level** — tests exist but at a different level than specified (e.g., unit test when spec says integration)

## 5. Manual Verification via Sub-Agents

**The main thread orchestrates. Sub-agents do the browser work.**

**Run sub-agents sequentially — one at a time, never in parallel.** `playwright-cli` controls a single browser instance.

### Group Criteria

Cluster related manual criteria into verification missions — criteria that share a page, flow, or setup context. Each cluster becomes one sub-agent.

Example grouping:
```
Agent 1: Project creation flow (AC-2, AC-3)
Agent 2: Chat behavior (AC-5, AC-6, AC-8)
Agent 3: Settings and permissions (AC-7, AC-9)
```

### Sub-Agent Prompt

Each sub-agent receives:

```markdown
## Spec Verification Agent

You are verifying specific acceptance criteria for spec <spec-issue-id>.

**Environment:** <url>
**Auth:** Load state from `<env>-auth.json`

### Your Criteria

<list of criteria assigned to this agent, with AC-IDs>

### Instructions

1. Start with `playwright-cli --help` to learn available commands
2. Load auth: `playwright-cli state-load <auth-file>`
3. Navigate to the relevant page: `playwright-cli goto <url>`
4. For EACH criterion:
   a. `snapshot` before every interaction
   b. Perform the actions described in the criterion
   c. `snapshot` (and `screenshot` when visual evidence matters) to capture the result
   d. Record: **AC-ID: PASS** or **AC-ID: FAIL — <what you observed vs what was expected>**
5. Stay focused on your assigned criteria — don't explore beyond what's needed to verify them
6. If a criterion requires setup (e.g., creating test data), do the minimal setup needed
7. If you can't verify a criterion (blocked by environment, missing data, etc.), record: **AC-ID: BLOCKED — <reason>**

Reference the `manual-testing-by-agent` skill for playwright-cli details.

### Output Format

Return a structured result:

AC-X: PASS
AC-Y: FAIL — Expected error toast on save failure, but no toast appeared. Console showed uncaught promise rejection.
AC-Z: PASS
```

### Collect Results

After each sub-agent completes, record its results against the verification checklist.

## 6. Report & File Bugs

### Summary

Present the full verification checklist to the user:

```
## Verification Results — ENG-XXX

### Passed (7/10)
- AC-1: User sees error toast when save fails — PASS
- AC-2: Deleted projects don't appear in list — PASS
...

### Failed (2/10)
- AC-5: Chat with 0 files shows empty context message — FAIL (no message shown, input just spins)
- AC-8: Settings save persists across reload — FAIL (values revert after refresh)

### Blocked (1/10)
- AC-9: Admin panel shows usage stats — BLOCKED (no admin access in staging)
```

### File Bug Issues

For each **failed** criterion, create a Linear issue:

```bash
plan create "bug: <short description of failure>" --parent <spec-issue-id> --label bug
```

Then update each bug issue's description with:

```markdown
## What

Verification of [spec title] found that acceptance criterion AC-X is not met.

## Expected

<what the acceptance criterion says should happen>

## Actual

<what actually happened during verification>

## Evidence

<screenshots, console output, or other evidence captured during verification>

## Reproduction

<steps to reproduce — environment, page, actions>

## Context

- Spec: ENG-XXX
- Acceptance criterion: AC-X
- Verification run: <date>
```

**Do not file issues for blocked criteria** — surface those to the user for discussion.

### Update Parent Spec

After filing bugs, update the parent spec issue with a verification summary:

```bash
plan update <spec-issue-id> --description "..."
```

Append a verification section:

```markdown
## Verification — <date>

| Criterion | Result | Issue |
|-----------|--------|-------|
| AC-1 | Pass | — |
| AC-5 | Fail | ENG-YYY |
| AC-8 | Fail | ENG-ZZZ |
| AC-9 | Blocked | — (no admin access) |

**Overall: 7/10 passed, 2 failed, 1 blocked**
```

This record enables failed-only re-verification in the next run.

## Feature Toggles

If the feature is behind a toggle, the verification agent needs to enable it before testing:

1. Navigate to `<app-url>/toggles`
2. Enable the relevant toggle(s)
3. Proceed with verification

Include toggle instructions in each sub-agent prompt when applicable.

## What This Skill Does NOT Do

- **Write code** — that's `implementing-specs`
- **Write the spec** — that's `writing-specs`
- **Explore beyond the spec** — that's `app-sanity-test`
- **Fix bugs** — file them for another agent to pick up
