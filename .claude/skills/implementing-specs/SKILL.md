---
name: implementing-specs
description: This skill guides implementation from spec documents. Triggered by "let's implement this spec", "start implementing", "continue implementing", or "vertical slice".
---

# Implementing Specs

Turn specs into working software through vertical slices, TDD, and continuous alignment.

**Companion to:** `writing-specs` skill.

## Core Principles

| Principle                  | Why                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| **Orient first**           | Read the spec, explore the code, identify risks before touching anything.                  |
| **Vertical slices**        | End-to-end functionality over horizontal layers. Get to prod fast.                         |
| **No upfront master plan** | Only plan the next step. Discover as you go.                                               |
| **TDD**                    | Tests first. Start local, verify the slice works, push to prod, verify on prod.            |
| **User in the loop**       | Ask questions, verify alignment, summarize often.                                          |
| **Small iterations**       | Short cycles, small commits, frequent checkpoints.                                         |
| **Self-verification**      | Get into feedback loops to verify your own work (run tests, check UI, hit endpoints).      |
| **Feature toggles**        | Use them to get incomplete work to prod safely.                                            |

## Orient

Before writing any code, build a mental model of the work.

### 1. Read the spec

```bash
plan show <spec-issue-id> --tree   # Spec + sub-issues + graph context
```

Read the full spec. Internalize scope, constraints, and open questions. If the spec lives in a file (`docs/specs/`), read that too.

### 2. Explore the codebase

Follow the breadcrumbs from the spec — referenced files, modules, database tables. Read enough to understand:

- Where the change lives (which services, which layers)
- What patterns are already established (how similar features are built)
- What's likely to break

### 3. Identify risks and unknowns

Before proposing a slice, surface anything that could derail implementation:

- Ambiguities in the spec
- Gaps between what the spec assumes and what the code actually looks like
- Areas you don't understand yet

### 4. Share your understanding

Use `AskUserQuestion` to present:

- **Summary**: 2-3 sentences on what the spec is asking for
- **Approach**: How you'd decompose it (rough slice ideas, not a full plan)
- **Risks/questions**: Anything unclear or concerning

Only proceed to slicing after the user confirms your understanding.

## Progress Tracking

Track progress in Linear via sub-issues and issue updates. See `plan align` for workflow context.

- Break slices into sub-issues with `plan create --parent <spec-issue>`
- Use `plan start` / `plan close` to track progress
- Update issue descriptions with decisions and open questions via `plan update`

## Workflow

Guidelines, not a strict process. Adapt to the situation — see "When to Deviate" below.

| Step                    | What                                                        | Notes                                                                                   |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Pick a slice**        | Propose the smallest vertical slice to user. Get alignment. | See "Slicing Heuristics" below.                                                         |
| **Plan tests first**    | Discuss with the user which tests to write.                 | Use `AskUserQuestion` to confirm test approach before writing code.                     |
| **Write failing tests** | Write the tests. Watch them fail.                           | TDD. Tests first, implementation second.                                                |
| **Implement**           | Write minimal code to pass tests.                           | Only what's needed to make tests green.                                                 |
| **Self-verify**         | Run tests, check UI, hit endpoints.                         | Use `manual-testing-by-agent` skill for UI verification.                                |
| **Checkpoint**          | Summarize progress. Ask user if still aligned.              | Do this often.                                                                          |
| **Commit & push**       | Commit after each slice. Don't accumulate uncommitted work. | Small commits, pushed frequently.                                                       |
| **Update Linear**       | Record decisions, close slice issue.                        | Keep issues current.                                                                    |
| **Check context**       | Run `cctx` to assess context window usage.                  | If getting full, create a handoff. See "Context Management" below.                      |
| **Repeat**              | Propose next slice. Ask: "Right size? Go smaller?"          | Continuous alignment.                                                                   |

### Slicing Heuristics

A good slice is:

| Quality | Test |
| --- | --- |
| **End-to-end** | Touches all layers needed (DB → API → UI), not just one |
| **Independently shippable** | Works on its own, even if the feature is incomplete |
| **Demonstrable** | You can show it working to the user |
| **Small enough to hold in your head** | If you can't describe it in one sentence, split it |

**Decomposition approach:** Start from the user-facing behavior and work backward. "User can see X" is a better slice than "Add database table for X."

**Ordering:** Prefer slices that reduce uncertainty first — the riskiest or least-understood part of the spec, not the easiest.

### Feature Toggles

Before each slice, ask:

- Is this a breaking change?
- Can incomplete work be safely deployed?
- Do we need to gradually roll out?

If yes to any, add a feature toggle. Discuss strategy with user via `AskUserQuestion`. See the `feature-toggles` skill for implementation patterns.

## Commit Often

Default to committing. When in doubt, commit.

| Situation                      | Action                     |
| ------------------------------ | -------------------------- |
| Completed a slice              | Commit and push            |
| Tests passing                  | Commit and push            |
| Fixed a bug                    | Commit and push            |
| About to start something risky | Commit current state first |
| Moving to next task            | Commit first, then proceed |

## TDD is Non-Negotiable

**Every slice needs tests BEFORE implementation.**

### Pre-Implementation Checklist

Before writing any code for a slice:

1. **Consider feature toggle** — Does this slice need one? (See "Feature Toggles" above)
2. **Draft a test plan** — List what tests you'll write (unit + integration, backend + frontend as applicable)
3. **Use `AskUserQuestion`** — Present the test plan, get explicit approval
4. **Write tests** — After user approves
5. **Watch tests fail** — Confirms they're actually testing something
6. **Implement** — Minimal code to make tests pass

**Example `AskUserQuestion` for pre-implementation approval:**
```
Before implementing this slice, I need your approval:

**Feature Toggle:** Not needed - this is additive and won't break existing functionality.

**Testing Approach:**

Backend:
- Unit tests for the new service function (success + error cases)
- Mock Supabase client to test in isolation

Frontend:
- Component test to verify prop is passed correctly
- Integration test via playwright-cli to verify end-to-end flow

**What I won't test (and why):**
- Existing dashboard chat - already covered, just manual regression check

Does this approach sound right?
```

### Red Flags — Stop and Add Tests

- "I'll add tests later" — **Stop. Write tests now.**
- "It's just a small change" — **Small changes still need tests.**
- "I tested it manually" — **Write an automated test for it.**
- "The backend is tested, frontend doesn't need tests" — **Both need tests.**
- "Tests are passing" but you only tested happy path — **Add error case tests.**

## When to Deviate

The workflow above is the default. Here's when to adapt:

| Situation | Adaptation |
| --- | --- |
| Config/infra changes (env vars, CI, deps) | Skip TDD — just verify the change works |
| Pure CSS/styling tweaks | Visual verification over unit tests. Use `manual-testing-by-agent` |
| Spike/exploration to answer a question | Skip tests entirely, but discard the code and restart with TDD once you know the answer |
| Slice turned out bigger than expected | Stop. Commit what works. Re-slice the remainder. Tell the user |
| Spec is wrong or incomplete | Stop implementing. Surface the gap to the user. Update the spec before continuing |
| Architectural problem discovered | Stop. Discuss with user. May need to revisit earlier slices |
| User says "just do it, skip the ceremony" | Respect it. Drop the `AskUserQuestion` gates, keep TDD |

## Checkpoints

Checkpoint often. Use `AskUserQuestion` to stay aligned.

**When to checkpoint:**
- After completing a slice
- Before starting something new
- When uncertain about direction
- When pace feels off

**What to cover:**

| Type      | Examples                                                |
| --------- | ------------------------------------------------------- |
| Summary   | "Here's what I just did..."                             |
| Alignment | "Does this match what you expected?"                    |
| Next step | "I'm thinking we do X next. Sound right?"               |
| Meta      | "Should we take smaller steps?" "Is this pace working?" |

Keep summaries concise. Focus on decisions made, not implementation details.

## Context Management

Long implementations exhaust context. Proactively manage this.

### After Each Slice

Run `cctx` to check context usage.

| Context State | Action |
| ------------- | ------ |
| Under 70% | Continue to next slice |
| **70%+ — hard stop** | **Do not start new work.** Finalize current slice, then create a handoff (see below) |

### At 70%: Finalize and Hand Off

This is non-negotiable. When context reaches 70%:

1. **Finish what you're doing** — complete the current slice if close, or commit what works and note what's left
2. **Do not start a new slice**
3. **Update Linear** — close completed slice issues, update parent issue with current state
4. **Create handoff** — use `/handoff` to create a handoff note (it handles format and transcript export)
5. **Tell the user** — explain that context is full and they should start a new session with `/handoff --continue` to pick up where you left off

The next session will orient from the handoff note and `plan show`.

## Self-Verification

Get into feedback loops to verify your own work before asking the user.

Run tests, check UI visually, hit endpoints, check logs, build locally — whatever makes sense for the change. Use the `manual-testing-by-agent` skill for browser-based verification.

Don't wait for the user to tell you something is broken. Catch it yourself.
