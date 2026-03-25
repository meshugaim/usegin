# Our Workflow — Liaison Flavor

Overrides and additions to the base `SKILL.md`. When in conflict, this file wins.

## Agents Commit

Agents commit and push their own work. The liaison does not commit — agents are trusted to commit clean, tested code. This keeps agents self-contained and avoids bottlenecking on the liaison for git operations.

## Step Size

Liaison's judgment. Not forced tiny, not forced large. Right-sized for the task — enough scope to be meaningful, small enough to stay focused and produce reviewable diffs.

## TDD — Required, Strict

Red-green-refactor. Every implementation step.

- **Red**: Write a failing test first. The test must fail for the _right reason_ — it tests the behavior you're about to build, not a missing import or syntax error. If red doesn't mean something, it's not TDD.
- **Green**: Make the test pass. Minimal code to satisfy the test.
- **Refactor**: Clean up. Don't skip this step. Look for duplication, naming, structure.

Red and green can be separate agents (one writes the failing test, the next makes it pass). Splitting is optional — use judgment based on task complexity. When committing red-phase tests, mark them as expected-to-fail so CI stays green — see the `tdd-ci` skill.

## Verification Agents

After implementation, spawn a separate verification agent. The implementer is not the verifier. Fresh eyes catch what familiarity misses.

More agents is better. Separating concerns across agents (impl, test, verify, review) keeps each agent focused and produces better results than one agent doing everything.

## Review — Multi-Perspective, Unseeded

After a feature or phase completes, spawn multiple reviewers. Each reviewer brings a different perspective.

**Critical: do not seed reviewers with directions, ideas, or things to look for.** We want independent thinking, not confirmation of the liaison's assumptions. Give them the diff and context, let them think big.

Review cycles: review → fix → review → fix, until only nitpick-level findings remain.

**Fix everything.** Every issue AND every suggestion gets addressed — no selectivity, no "non-blocking" dismissals. If a reviewer says it would make the code better, we do it. The codebase gets better one small choice at a time. The only findings that don't get fixed are ones the re-reviewers themselves downgrade to nitpick on the next pass.

**Capturing learnings**: Review findings that are relevant to future agents (patterns, anti-patterns, architectural insights) may be captured in repo documents. Scope and location decided case by case — the user is in the loop on what gets remembered and where it goes. Nothing is saved without the user seeing and approving it.

## Companion

Spawned at session start. Watches for drift against this workflow. Updated when workflow evolves.

## More overrides

- per issue / slice decide in advance how to manually verify it works and fits with rest of system
- review->fix infinite loop until nitpick level - fixing all (unless completely wrong)
- wait for companion, dont continue before seeing its inputs
- tdd cycle can be made stricter by separate agents do 1. write the tests (including review fix infinite loop) 2. impl production code (again infinite loop)
- FYI - other agents might be working in parallel on other things; only commit your own changes - tell your agents

## What Stays the Same from SKILL.md

- Sequential by default (no parallelism unless explicitly requested)
- Definition of Done stated before each step
- Linear flow (plan start -> work -> plan close)
- Sub-agent guardrails (orient before acting, recognize spinning, escalate over stubbornness)
- Retro after closing issues or at natural breakpoints
- Safeguarding project patterns
