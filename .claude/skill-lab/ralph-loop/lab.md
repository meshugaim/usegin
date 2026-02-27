# ralph-loop — Skill Lab

## Intent

Autonomous development loop for long-running, well-defined tasks that can be verified programmatically.

The skill exists because some tasks need persistent iteration — build, test, fix, repeat — without human involvement at each step. Ralph uses a Stop hook to block exit and re-inject the prompt, creating a loop where each iteration builds on the previous (files and git history persist).

Unlike liaison (which orchestrates sub-agents), ralph IS the worker — it does the work directly, iteration after iteration. Unlike build-orchestrate (which manages phases), ralph has one phase: do the thing until it's done.

Success means: task completed within the iteration budget, completion promise only output when genuinely done, no infinite loops, no wasted iterations on the same stuck problem.

## Success Signals

When retroing a session that used this skill, a good session looks like:

- [ ] `--max-iterations` was set (safety net against infinite loops)
- [ ] Task had clear, specific completion criteria (not vague)
- [ ] Completion criteria were programmatically verifiable (tests pass, lint clean, etc.)
- [ ] Completion promise was only output when criteria were truly met
- [ ] The agent didn't get stuck repeating the same failing approach for 3+ iterations
- [ ] Each iteration made meaningful progress (not thrashing)
- [ ] Cost was reasonable relative to the task complexity
- [ ] The task was appropriate for ralph (well-defined, auto-verifiable, not needing human judgment)

## Known Limitations

- **No stuck detection.** If the agent keeps trying the same approach and failing, there's no built-in circuit breaker. It loops until `--max-iterations` is hit. Wasted tokens.
- **No progress tracking.** There's no whiteboard or state file. The agent relies on files and git history to orient between iterations, but after context compaction it may lose track of what it already tried.
- **Cost opacity.** The skill warns about cost but there's no real-time cost monitoring. A 50-iteration loop can silently burn $50-100+.
- **No sub-agent support.** Ralph is a single-agent loop. It can't delegate to sub-agents within an iteration (or if it can, there's no guidance on it).
- **Completion promise is honor-system.** The skill says "don't lie to escape" but a frustrated agent may output the promise prematurely.
- **No partial progress handoff.** If ralph hits max-iterations without completing, there's no structured way to hand off partial progress to a new session.
- **The skill is thin.** At ~60 lines, it's more of a reference card than a comprehensive guide. The real documentation lives in the plugin README (fetched at runtime). If that fetch fails, the agent has minimal guidance.

## Retro Guide

When the `skill-retro` skill triggers a retro for ralph-loop, follow this evaluation process:

**1. Check task appropriateness**
Was this the right tool for the job? Ralph is for well-defined, auto-verifiable tasks. If the task needed human judgment, design decisions, or multi-service coordination, ralph was the wrong choice.

**2. Check iteration efficiency**
How many iterations did it take? Were iterations making progress, or was the agent stuck? Look for patterns of: same error repeated 3+ times, same file edited repeatedly without progress, tests failing with the same error across iterations.

**3. Check stuck behavior**
When the agent got stuck, did it try a different approach or keep hammering the same one? Did it escalate (if possible) or burn through iterations?

**4. Check completion integrity**
Was the completion promise output at the right time? Did all stated criteria actually pass? Or did the agent declare victory prematurely?

**5. Check cost-appropriateness**
How many iterations were used vs. needed? Was `--max-iterations` set conservatively? Was the outcome worth the token cost?

**6. Check state management**
Did the agent maintain awareness of what it had already tried? After context compaction, did it re-attempt failed approaches?

## Ideas / Notes

- Ralph is fundamentally different from the other orchestration skills — it's a worker, not a director. The retro criteria reflect this: we're evaluating efficiency and stuck detection, not delegation discipline.
- The biggest failure mode isn't doing the wrong thing — it's doing the same wrong thing 20 times. A stuck-detection mechanism (e.g., "if you've edited the same file 3+ times and the same test still fails, write a progress note and try a fundamentally different approach") would be high-value.
- Progress tracking via a simple state file (`.claude/ralph-state.md` — what's been tried, what worked, what failed) could survive context compaction and prevent re-attempting failed approaches.
- The skill fetches the plugin README at runtime via WebFetch. If that URL changes or the fetch fails, the agent has almost nothing to work with. Consider inlining the critical guidance.
- Should ralph support a "checkpoint" pattern? E.g., every N iterations, commit progress and write a summary. Would make partial-progress handoff possible.
- Ralph + liaison could be powerful: ralph as the loop driver, but within each iteration it uses liaison-style delegation. Currently undocumented.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| (pre-lab) | Initial skill created | Wraps the ralph-wiggum plugin for autonomous iteration |
| (pre-lab) | Cost warning added | Users surprised by token costs on long loops |
| 2026-02-27 | Restructured lab: split retros into individual files under `retros/` | Single-file lab structure doesn't scale as retros accumulate. |
