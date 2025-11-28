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

**Example `AskUserQuestion` for test plan approval:**
```
Before implementing this slice, I need your approval on the approach:

**Feature Flag:** Not needed - this is additive and won't break existing functionality.

**Test Plan:**

Backend (Python):
- Unit: test_project_service_get_project_success
- Unit: test_project_service_get_project_not_found
- Integration: test_chat_service_with_project_context

Frontend (TypeScript):
- Unit: test_chat_interface_passes_project_id
- Integration: test_project_chat_page_renders

Options:
1. Looks good, proceed
2. Add more tests (specify)
3. Need feature flag (explain why)
4. Other changes needed
```

### Test Types Required

| Layer                     | Unit Tests                                | Integration Tests                                  |
| ------------------------- | ----------------------------------------- | -------------------------------------------------- |
| **Backend (Python)**      | Service functions, data models, utilities | API endpoints, database queries, external services |
| **Frontend (TypeScript)** | Components, hooks, utilities              | Page rendering, API calls, user flows              |

### Backend Testing (Python)

```python
# Unit test - mock external dependencies
def test_project_service_get_project_success(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://fake.supabase.co")
    with patch("agent_api.project_service.create_client") as mock:
        # ... test logic

# Integration test - real database (local Supabase)
@pytest.mark.asyncio
async def test_chat_with_project_context():
    # Uses real local Supabase, tests full flow
```

### Frontend Testing (TypeScript)

```typescript
// Unit test - component behavior
test("ChatInterface passes projectId to API", async () => {
  // Mock fetch, verify projectId in request body
});

// Integration test - page rendering
test("ProjectChatPage shows project name", async () => {
  // Render page, verify project context displayed
});
```

### What Must Be Tested

| Component             | Required Tests                                    |
| --------------------- | ------------------------------------------------- |
| **Service functions** | All public methods with success + error cases     |
| **API endpoints**     | Request/response validation, auth, error handling |
| **React components**  | Props handling, user interactions, state changes  |
| **Data models**       | Validation, serialization, edge cases             |
| **Database queries**  | RLS policies, constraints, migrations             |

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
