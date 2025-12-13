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
| **Vertical slices**        | End-to-end functionality over horizontal layers. Get to prod fast.                         |
| **No upfront master plan** | Only plan the next step. Discover as you go.                                               |
| **TDD**                    | Tests first. Start local, verify the slice works, push to prod, verify on prod.            |
| **User in the loop**       | Ask questions, verify alignment, summarize often.                                          |
| **Small iterations**       | Short cycles, small commits, frequent checkpoints.                                         |
| **Meta process**           | Check pace with user often. Slow down when uncertain. Ask: "Should we take smaller steps?" |
| **Self-verification**      | Get into feedback loops to verify your own work (run tests, check UI, hit endpoints).      |
| **Feature toggles**        | Use them to get incomplete work to prod safely.                                            |

## Progress Doc

Keep an `<feature>.impl-status.md` next to the spec (e.g., `docs/specs/auth.impl-status.md` alongside `auth.spec.md`).

**What to include:**
- Meta section at top: purpose of doc, link to spec
- Next step (keep at top, write in reverse chronological order)
- Decisions made along the way
- Open questions

The doc itself should state its purpose: "This is not a full plan upfront. It tracks ongoing decisions and progress."

Update it as you go. It's a living record, not a contract.

**Style:** Keep it concise. Don't list files created or flags added - just show usage examples. Focus on what matters for the next person reading it.

## Workflow Guidelines

Guidelines, not a strict process. Adapt to the situation.

| Step                    | What                                                        | Notes                                                                                   |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Pick a slice**        | Propose the smallest vertical slice to user. Get alignment. | End-to-end, not layer-by-layer. Decide together. Discuss **feature toggle** strategy early. |
| **Plan tests first**    | Discuss with the user which tests to write.                 | Use `AskUserQuestion` to confirm test approach before writing code.                     |
| **Write failing tests** | Write the tests. Watch them fail.                           | TDD. Tests first, implementation second. No exceptions.                                 |
| **Implement**           | Write minimal code to pass tests.                           | Only what's needed to make tests green.                                                 |
| **Self-verify**         | Run tests, check UI, hit endpoints.                         | Use `closed-loop-web-development` skill for UI verification.                            |
| **Checkpoint**          | Summarize progress. Ask user if still aligned.              | Do this often.                                                                          |
| **Commit & push**       | Commit after each slice. Don't accumulate uncommitted work. | Small commits, pushed frequently. Avoids lost work and enables easier rollback.         |
| **Update progress doc** | Record decisions, next step.                                | Keep it current.                                                                        |
| **Check context**       | Run `/context` to assess context window usage.              | If getting full, prepare/create handoff. See "Context Management" section.              |
| **Repeat**              | Propose next slice. Ask: "Right size? Go smaller?"          | Continuous alignment.                                                                   |

## Commit Often

Default to committing. When in doubt, commit.

| Situation                      | Action                     |
| ------------------------------ | -------------------------- |
| Completed a slice              | Commit and push            |
| Tests passing                  | Commit and push            |
| Fixed a bug                    | Commit and push            |
| About to start something risky | Commit current state first |
| Moving to next task            | Commit first, then proceed |

Avoid staying in uncommitted state between slices.

## TDD is Non-Negotiable

**Every slice needs tests BEFORE implementation.** This is the most important principle.

### Pre-Implementation Checklist

Before writing any code for a slice:

1. **Consider feature flag** - Does this slice need a feature flag to ship safely? Discuss with user.
2. **Draft a test plan** - List what tests you'll write (unit + integration, backend + frontend)
3. **Use `AskUserQuestion`** - Present the test plan and feature flag decision, get explicit approval
4. **Only then write tests** - After user approves the approach
5. **Watch tests fail** - Confirms tests are actually testing something
6. **Implement** - Write minimal code to make tests pass

### Feature Flag Decision

Ask yourself before each slice:
- Is this a breaking change?
- Can incomplete work be safely deployed?
- Do we need to gradually roll out?

If yes to any, add a feature flag. Discuss strategy with user via `AskUserQuestion`.

**Example `AskUserQuestion` for pre-implementation approval:**
```
Before implementing this slice, I need your approval:

**Feature Flag:** Not needed - this is additive and won't break existing functionality.

**Testing Approach:**

Backend:
- Unit tests for the new service function (success + error cases)
- Mock Supabase client to test in isolation

Frontend:
- Component test to verify prop is passed correctly
- Integration test via Playwright MCP to verify end-to-end flow

**What I won't test (and why):**
- Existing dashboard chat - already covered, just manual regression check

Does this approach sound right?
```

The goal is to align on *what* to test and *how* to test it, not to list every test name upfront.

### What to Test

Both backend and frontend need unit tests (isolated logic) and integration tests (end-to-end flows).

### Red Flags - Stop and Add Tests

- "I'll add tests later" → **Stop. Write tests now.**
- "It's just a small change" → **Small changes still need tests.**
- "I tested it manually" → **Write an automated test for it.**
- "The backend is tested, frontend doesn't need tests" → **Both need tests.**
- "Tests are passing" but you only tested happy path → **Add error case tests.**

### Coverage Checklist

Before declaring a slice complete:

- [ ] Backend unit tests written and passing?
- [ ] Backend integration tests written and passing?
- [ ] Frontend unit tests written and passing?
- [ ] Frontend integration tests written and passing?
- [ ] Edge cases covered (empty input, errors, boundaries)?
- [ ] User approved the test plan before implementation?

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

**Summaries:** Keep them concise. Focus on decisions made, not implementation details. Offer deeper discussion if user wants it.

## Context Management & Handoffs

Long implementations can exhaust context. Proactively manage this to avoid degraded performance.

### After Each Slice

Run `/context` to check context usage. This shows a visual grid of how much context window is used.

| Context State | Action |
| ------------- | ------ |
| Plenty of room | Continue to next slice |
| Getting full (~70%+) | Prepare for handoff, update impl-status.md proactively |
| Nearly full (~85%+) | Create handoff, suggest new session |

**Note:** `/compact` can reduce context by summarizing, but it may be disabled in settings. Don't rely on it - treat handoffs as the primary strategy for managing long implementations.

### When to Create a Handoff

- Context is nearly full
- You're losing track of details
- Session has been running very long
- About to start a complex new slice

### Handoff Process

1. **Commit all current work** - Nothing uncommitted
2. **Update impl-status.md** - Mark completed slices, document current state
3. **Create handoff prompt** - Either in impl-status.md or share directly with user

### Handoff Prompt Structure

Include in impl-status.md or provide to user:

```markdown
## Handoff: [Feature Name]

### Session Summary
- Slices completed: 1, 2, 3
- Current branch: feature/xyz
- Last commit: abc123 "feat: add user auth endpoint"
- Tests: all passing / X failing

### Current State
- [What's working]
- [What's partially done]
- [Known issues]

### Next Steps
- Slice 4: [specific tasks]
- Slice 5: [specific tasks]

### Key Context
- [Important decisions made]
- [Gotchas discovered]
- [Patterns established]
```

### Continuing from Handoff

When starting a new session to continue:

1. Read the spec and impl-status.md
2. Check git log for recent commits
3. Run tests to verify current state
4. Pick up from documented next steps

The goal: A fresh session can continue seamlessly without re-discovering context.

## Self-Verification

Get into feedback loops to verify your own work before asking the user.

**Examples:** Run tests, check UI visually, hit endpoints, check logs, build locally. Use whatever makes sense for the change.

**Note:** There may be relevant skills for specific feedback loops (e.g., `closed-loop-web-development` for UI verification). Check available skills.

Don't wait for user to tell you something is broken. Catch it yourself.

## Using Context7 for Latest APIs

When working with libraries/frameworks (Bun, React, etc.), use Context7 MCP to fetch latest docs:

1. Check if `context7` MCP server is available
2. Use `mcp__context7__resolve-library-id` to find the library
3. Use `mcp__context7__get-library-docs` to get current API docs

This prevents using outdated patterns. If Context7 isn't connected, remind the user to activate it.
