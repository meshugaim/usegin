---
name: implementing-specs
description: This skill guides implementation from spec documents. Triggered by "let's implement this spec", "start implementing", "continue implementing", or "vertical slice".
---

# Implementing Specs

Turn specs into working software through vertical slices, TDD, and continuous alignment.

**Companion to:** `writing-specs` skill.

**When to use this vs alternatives:** This skill is for human-collaborative implementation — the user is present, guiding priorities, and making decisions. For autonomous execution of well-understood work, consider `cell` or `teamwork`. For pure TDD loops on isolated modules, consider `worker-reviewer`.

## Core Principles

| Principle              | Why                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Orient first**       | Read the spec, explore the code, identify risks before touching anything.             |
| **Vertical slices**    | End-to-end functionality over horizontal layers. Get to prod fast.                    |
| **Sketch the path**    | Rough-order your slices upfront. Commit only to the next one. Revise as you learn.    |
| **TDD by default**     | Tests first for most work. Known exceptions exist — see "When to Skip TDD" below.    |
| **Ask when surprised** | Don't gate every step on approval. Do raise a flag when reality diverges from plan.   |
| **Small iterations**   | Short cycles, small commits, frequent checkpoints.                                    |
| **Self-verification**  | Verify your own work before asking the user. See "Self-Verification" below.           |
| **Feature toggles**    | Use them to get incomplete work to prod safely.                                       |

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

Before proposing slices, surface anything that could derail implementation:

- Ambiguities in the spec
- Gaps between what the spec assumes and what the code actually looks like
- Areas you don't understand yet
- Missing test infrastructure (see "Test Infrastructure" below)

### 4. Share your understanding

Use `AskUserQuestion` to present:

- **Summary**: 2-3 sentences on what the spec is asking for
- **Slice sketch**: Rough ordered list of slices you see (explicitly marked as "will change as we learn")
- **Risks/questions**: Anything unclear or concerning

Only proceed to implementation after the user confirms your understanding.

## Slice Sketch

After orienting, produce a lightweight plan — a rough ordered list of slices. This is not a commitment. It's a shared map that helps:

- **Coherence** — slices fit together because you've thought about the whole before starting any part
- **Seams** — you identify where slices connect (shared types, API contracts, DB schema) and design clean interfaces between them
- **Risk ordering** — you can sequence riskiest-first deliberately, not accidentally

Update the sketch as you go. After completing each slice, revisit: does the remaining plan still make sense? When discoveries lead you to add, remove, or reorder slices, tell the user — this is exactly the kind of surprise worth surfacing.

**The sketch lives in the Linear parent issue description.** Update it via `plan update` as slices are completed or reordered.

## Progress Tracking

Track progress in Linear via sub-issues and issue updates. See `plan align` for workflow context.

- Break slices into sub-issues with `plan create --parent <spec-issue>`
- Use `plan start` / `plan close` to track progress
- Update issue descriptions with decisions and open questions via `plan update`

## Workflow

Guidelines, not a strict process. Adapt to the situation.

| Step                    | What                                                        | Notes                                                                  |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Pick a slice**        | Take the next slice from your sketch.                       | See "Slicing Heuristics" below.                                        |
| **Check the seams**     | How does this slice connect to previous and future slices?  | Review shared types, API contracts, DB schema at boundaries.           |
| **Write failing tests** | Write tests first. Watch them fail.                         | See "TDD" section for approach and known exceptions.                   |
| **Implement**           | Write minimal code to pass tests.                           | Only what's needed to make tests green.                                |
| **Self-verify**         | Run tests, check UI, hit endpoints.                         | See "Self-Verification" below.                                         |
| **Commit & push**       | Commit after each slice. Don't accumulate uncommitted work. | Small commits, pushed frequently.                                      |
| **Update Linear**       | Record decisions, close slice issue.                        | Keep issues current.                                                   |
| **Checkpoint**          | Summarize what you did. Propose next slice.                 | See "Checkpoints" below.                                               |
| **Check context**       | Run `cctx` to assess context window usage.                  | If getting full, create a handoff. See "Context Management" below.     |

### Slicing Heuristics

A good slice is:

| Quality | Test |
| --- | --- |
| **End-to-end** | Touches all layers needed (DB → API → UI), not just one |
| **Independently shippable** | Works on its own, even if the feature is incomplete |
| **Demonstrable** | You can show it working to the user |
| **Right-sized** | One migration max. Implementable in a single agent session without context pressure. If you can't describe it in one sentence, split it |

**Decomposition approach:** Start from the user-facing behavior and work backward. "User can see X" is a better slice than "Add database table for X."

**Ordering:** Prefer slices that reduce uncertainty first — the riskiest or least-understood part of the spec, not the easiest.

**Coherence between slices:** Before starting a slice, consider how it connects to what came before and what comes after. Shared types, API contracts, and DB schema are the seams — get them right early. If a later slice will need a different shape than what you're building now, adjust now rather than refactoring later.

### Feature Toggles

Before each slice, ask:

- Is this a breaking change?
- Can incomplete work be safely deployed?
- Do we need to gradually roll out?

If yes to any, add a feature toggle. See the `feature-toggles` skill for implementation patterns.

## Commit Often

Default to committing. When in doubt, commit.

| Situation                      | Action                     |
| ------------------------------ | -------------------------- |
| Completed a slice              | Commit and push            |
| Tests passing                  | Commit and push            |
| Fixed a bug                    | Commit and push            |
| About to start something risky | Commit current state first |
| Moving to next task            | Commit first, then proceed |

## TDD

Tests first is the strong default. Write tests before implementation for every slice, unless it falls into a known exception below.

### The Loop

1. **Consider feature toggle** — Does this slice need one? (See "Feature Toggles" above)
2. **Write tests** — Unit + integration, backend + frontend as applicable
3. **Watch tests fail** — Confirms they're actually testing something
4. **Implement** — Minimal code to make tests pass
5. **Self-verify** — Run all tests, check nothing else broke

### When to Skip TDD

| Situation | What to do instead |
| --- | --- |
| Config/infra changes (env vars, CI, deps) | Just verify the change works |
| Pure CSS/styling tweaks | Visual verification with `manual-testing-by-agent` |
| Spike/exploration to answer a question | Skip tests entirely, discard the code, restart with TDD once you know the answer |

These aren't loopholes — they're cases where TDD genuinely doesn't apply. For everything else, tests first.

### Test Infrastructure

Sometimes the first slice isn't a feature — it's setting up the test harness. A new integration test setup, a missing fixture pattern, a test utility that doesn't exist yet. This is a valid first slice. Acknowledge it, track it in Linear, and get it done before moving to feature slices.

### Red Flags — Stop and Add Tests

- "I'll add tests later" — **Stop. Write tests now.**
- "It's just a small change" — **Small changes still need tests.**
- "I tested it manually" — **Write an automated test for it.**
- "The backend is tested, frontend doesn't need tests" — **Both need tests.**
- "Tests are passing" but you only tested happy path — **Add error case tests.**

## When Things Go Wrong

Implementation rarely goes exactly to plan. Here's how to handle common problems:

| Situation | Action |
| --- | --- |
| Slice turned out bigger than expected | Stop. Commit what works. Re-slice the remainder. Tell the user. |
| Spec is wrong or incomplete | Stop implementing. Surface the gap to the user. Update the spec before continuing. |
| Architectural problem discovered | Stop. Discuss with user. May need to revisit earlier slices. |
| Push rejected by pre-push hooks | Fix the issue (lint, test failure). Never bypass with `--no-verify` without user approval. |
| Tests pass locally but CI fails | Read CI logs (`fetching-ci-logs` skill). Fix the root cause — don't just make CI pass. |
| A committed slice turns out to be wrong | Don't panic. Feature toggles protect prod. Fix forward with a new slice, or revert if the fix is non-trivial. Discuss with user. |
| Current slice needs something from a future slice | Pull the minimal dependency forward into the current slice, or reorder the sketch. Don't build throwaway stubs — they become tech debt. Tell the user about the reorder. |
| Unexpected codebase state (unfamiliar patterns, stale code, broken assumptions) | **Raise a flag.** Use `AskUserQuestion` to surface what you found. Don't silently work around it. |

## Asking Questions

Don't ask for permission at every step. Do ask when it matters.

**Always ask (via `AskUserQuestion`):**

- During orient — to confirm your understanding and slice sketch
- When reality diverges from the plan — something unexpected in the code, a spec ambiguity, a risk you didn't anticipate
- When you need to make a design decision that affects future slices
- When a slice fails or needs to be re-scoped

**Don't ask:**

- For routine test plans on straightforward slices — just write the tests
- For confirmation before every commit
- To propose the next slice when it's obvious from the sketch

**The principle:** Ask when you're surprised or when you're making a decision the user should know about. Don't ask when you're just following the plan.

## Checkpoints

Checkpoint after completing each slice. Keep it concise — focus on decisions made, not implementation details.

**What to cover:**

| Type      | Examples                                                |
| --------- | ------------------------------------------------------- |
| Summary   | "Here's what I just did..."                             |
| Seams     | "This connects to the next slice via..."                |
| Next step | "Next up from the sketch: X. Still makes sense?"        |
| Surprises | "I noticed Y, which might affect the remaining plan..." |

If nothing is surprising and the next slice is obvious, the checkpoint can be two sentences in your commit message summary. Save `AskUserQuestion` for when you genuinely need input.

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
3. **Update Linear** — close completed slice issues, update parent issue with current state and remaining slice sketch
4. **Create handoff** — use `/handoff` to create a handoff note (it handles format and transcript export)
5. **Tell the user** — explain that context is full and they should start a new session with `/handoff --continue` to pick up where you left off

The next session will orient from the handoff note and `plan show`. It should re-read the slice sketch from the parent issue and validate it still makes sense — things may have changed on main, or the user may have new priorities.

## Self-Verification

Verify your own work before asking the user. Don't wait to be told something is broken — catch it yourself.

**By change type:**

| Change | How to verify |
| --- | --- |
| API endpoint | Hit the endpoint, check response shape and status codes |
| UI component | Screenshot with `playwright-cli`, compare to spec expectations |
| DB migration | Run `migration up`, query the schema to confirm it's correct |
| Data flow | Trace a value from input to output — write to DB, read it back, check the UI |
| Styling | Visual check with `manual-testing-by-agent` |
| Bug fix | Reproduce the bug first, confirm the fix resolves it, check for regressions |

**General:** Run the full test suite after each slice, not just the tests you wrote. Regressions hide in unexpected places.

**Composed behavior:** Periodically — and always after the final slice — verify the feature end-to-end as a user would experience it. Individual slices passing their own tests doesn't guarantee the assembled feature works. Step back and test the full flow.

Use the `manual-testing-by-agent` skill for any browser-based verification.
