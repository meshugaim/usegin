---
name: implementing-specs
description: This skill guides implementation from spec documents. Triggered by "let's implement this spec", "start implementing", "continue implementing", or "vertical slice".
---

# Implementing Specs

Turn specs into working software through vertical slices, TDD, and continuous alignment.

**Pipeline:** `writing-specs` → `slicing-specs` → **`implementing-specs`** (you are here)

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

### 1. Read the spec and check for slices

```bash
plan show <spec-issue-id> --tree   # Spec + sub-issues + graph context
```

Read the full spec. Internalize scope, constraints, and open questions. If the spec lives in a file (`docs/specs/`), read that too.

**Check if slices already exist.** If `slicing-specs` has already run, the parent issue will have a slice map and sub-issues with acceptance criteria and verification expectations. In that case:
- The sub-issues are your slice sketch — don't create a new one
- Read each sub-issue to understand scope, criteria, seams, and suggested test levels
- Skip to step 4 (share your understanding) with the existing slices as your plan

If no sub-issues exist, you'll create the slice sketch yourself (see "Slice Sketch" below).

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
- **Slice plan**: The existing sub-issues (if pre-sliced) or a rough ordered list of slices you see (explicitly marked as "will change as we learn")
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

If you're creating your own slice sketch (no pre-existing sub-issues from `slicing-specs`), see the `slicing-specs` skill for the full decomposition approach — good slice qualities, ordering priorities, infrastructure slices, and edge cases.

**Quick reference for mid-implementation decisions:**

- Start from user-facing behavior, work backward ("User can see X" > "Add database table for X")
- Reduce uncertainty first — riskiest slice before easiest
- Check seams between slices — shared types, API contracts, DB schema. Get them right early rather than refactoring later
- Right-sized: one migration max, implementable in a single agent session without context pressure

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
2. **Read verification expectations** — If the slice has a Verification section (from `slicing-specs`), use it to guide test choices. It tells you *what* to test and at *which level* (unit, integration-db, integration-browser, etc.). You decide the implementation: mocks, fixtures, test structure. See `docs/testing/README.md` for the full test type matrix.
3. **Write tests** — At the levels indicated by the verification expectations. If no expectations exist, default to unit + integration as applicable.
4. **Watch tests fail** — Confirms they're actually testing something
5. **Implement** — Minimal code to make tests pass
6. **Self-verify** — Run all tests, check nothing else broke

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

Long implementations exhaust context. Proactively manage this. The goal: any session can pick up where the last one left off using only Linear issues and handoff notes — no in-context memory required.

### Linear as Source of Truth

Linear is the durable memory that survives across sessions. Keep it current:

- **Close slice issues** immediately when a slice is done (`plan close <id>`)
- **Update the parent issue's slice map** with completion status after each slice
- **Add notes to slice issues** when you discover something the next session should know

A new session should be able to run `plan show <spec-issue-id> --tree` and immediately see: which slices are done, which is next, and what the current state is. If that's not clear from Linear alone, something is missing.

### After Each Slice

Run `cctx` to check context usage.

| Context State | Action |
| ------------- | ------ |
| Under 60% | Continue to next slice |
| **60%+ — do not start a new slice** | Finish current slice if close to done, otherwise commit what works and hand off |
| **70%+ — MUST handoff NOW** | Non-negotiable. Stop immediately. Commit, update Linear, write handoff, exit. No "let me just finish this." |

The 60% threshold is conservative by design. Starting a new slice at 62% risks hitting 80%+ if the slice has complications — leaving no room for a clean handoff. The 70% hard stop exists because handoff itself consumes context (reading state, writing the note, updating Linear).

### Slice Lifecycle

A slice progresses through specific states. Knowing the exact state is critical for handoffs.

| State | What's true | Linear status |
|-------|------------|---------------|
| **Pending** | Not started | Pending |
| **Tests written** | Failing tests exist, no implementation yet | In Progress |
| **Implemented** | Tests passing, code written | In Progress |
| **Verified** | Self-verified (tests + manual checks), ready to push | In Progress |
| **Done** | Pushed, issue closed | Done |

**"Done" means all of the above:** coded, tested, self-verified, pushed, issue closed. If any step is missing, the slice is still in progress.

When handing off mid-slice, record the exact state — the next agent needs to know whether to write tests, implement, verify, or just push.

### At 60%+: Wrap Up Current Slice

When context reaches 60%:

1. **Finish the current slice if you're close** — if verified and just needs push, finish it. Otherwise commit what works.
2. **Do not start a new slice**
3. **Update Linear** — close completed slice issues, keep in-progress slices marked as In Progress, update parent issue slice map
4. **Create handoff** — use `/handoff` with the structure below

### At 70%+: Emergency Handoff

If you reach 70% (missed the 60% window or current slice ran long):

1. **Stop immediately** — do not continue implementing
2. **Commit whatever compiles** — even partial work, with a clear commit message about the state
3. **Update Linear** — mark current slice state accurately
4. **Write handoff** — use the structure below, be extra precise about what's mid-flight
5. **Exit** — do not do anything else after writing the handoff

### Auto-Implement Mode

When run via the `auto-implement` CLI (headless `claude -p` sessions), output these exact signals so the outer loop knows what happened:

| Signal | When | What it does |
|---|---|---|
| `AUTO_IMPLEMENT_HANDOFF` | After writing a handoff (60%+ context or natural stopping point) | Outer loop spawns a fresh session that reads the handoff |
| `AUTO_IMPLEMENT_COMPLETE` | After all slices are done and cross-slice verification passes | Outer loop stops — implementation is finished |

Output each signal on its own line in stdout. The auto-implement CLI also checks Linear as a fallback (all child issues Done = complete), but explicit signals are more reliable.

### Handoff Structure for Spec Implementation

The standard handoff format applies, but for spec implementation the "What's Pending" section must be precise about slice state:

```markdown
## Spec Progress

Parent spec: ENG-XXX
Slice map: [link or inline summary]

### Completed Slices
- ENG-111: [title] — Done (pushed, closed)
- ENG-222: [title] — Done (pushed, closed)

### Current Slice
- ENG-333: [title]
- **State:** [tests written / implemented / verified]
- **What's left:** [specific — e.g., "RLS integration tests pass, need to implement the API endpoint and UI component"]
- **Files touched so far:** [list]

### Remaining Slices
- ENG-444: [title] — Pending
- ENG-555: [title] — Pending

### Discoveries
- [Anything that affects remaining slices — seam changes, spec gaps, risks found]
```

This structure lets the next agent skip re-reading completed slices and jump straight to the exact point where work stopped.

### Resuming After Handoff

The next session (whether started manually via `/handoff-continue` or automatically) should:

1. Read the handoff note
2. Run `plan show <spec-issue-id> --tree` to see current state in Linear
3. Verify the handoff matches Linear — if they disagree, Linear wins (it's the source of truth)
4. If resuming a mid-slice handoff: read the slice issue, check what code exists, pick up from the recorded state
5. If starting a new slice: read the slice's sub-issue for acceptance criteria and verification expectations

**The key insight:** because slices are self-contained sub-issues with their own acceptance criteria, a new session doesn't need the full history of previous sessions. It needs: which slice am I on, what state is it in, what are its criteria, and what seams connect it to completed slices. Linear + handoff provide all of this.

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

## After All Slices

When the last slice is complete:

1. **Update Linear** — close the last slice issue, update the parent spec's slice map to show all slices done
2. **Cross-slice verification** — check anything marked "end-to-end verification — after all slices" in the spec's acceptance criteria. These are behaviors that only work once all pieces are assembled.
3. **Run the full test suite** — all tests, not just the ones from this session
4. **Commit and push** — final state should be clean, all tests green
5. **Signal completion** — update the parent spec issue to reflect that implementation is done. The spec's acceptance criteria and verification expectations now serve as the checklist for the verification agent downstream.
