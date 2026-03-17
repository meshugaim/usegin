# build-orchestrate — Skill Lab

## Intent

Prevent directors from collapsing into workers during multi-phase builds.

The skill exists because agents given a complex build task will naturally start doing the work themselves — reading code, reviewing specs, running tests. This consumes their context, narrows their perspective, and breaks orchestration. The skill enforces a strict delegation model: the director keeps the whiteboard, spawns agents for everything, and never touches the work.

Success means: a full build lifecycle (research → design → spec → implement → QA) completed with the director thread staying thin, the whiteboard telling the full story, and every phase executed by subagents.

## Success Signals

When retroing a session that used this skill, a good session looks like:

### Correctness (highest priority)
- [ ] Test plan existed before implementation started (from spec, prior session, or created with user)
- [ ] No test assertions were deleted or weakened without orchestrator approval
- [ ] Every implementation phase had a test-integrity reviewer checking `git diff -- '*/tests/*'`
- [ ] Deferred items are tracked and visible (skipped tests on whiteboard, not silently removed)
- [ ] "Tests pass" was verified by reviewer, not just reported by implementer
- [ ] Implementation agents received the Test Integrity Rules and Pass/Stop/Defer instructions

### Delegation (process discipline)
- [ ] Director never used Grep, Glob, Edit, or Bash
- [ ] Director never read files other than the whiteboard and the skill itself
- [ ] Director never loaded a skill into its own context (no `Skill:` calls)
- [ ] Note-to-self written before every agent spawn
- [ ] Every note-to-self includes the "Role check" circuit breaker line
- [ ] Every phase agent was instructed to return a ≤10 line summary
- [ ] Every phase had a reviewer agent (not reviewed by director)

### Orchestration (whiteboard + flow)
- [ ] Whiteboard stayed under 200 lines
- [ ] Auto-Inject block present at top of whiteboard, unmodified
- [ ] Recovery block (Current State) updated at every phase boundary
- [ ] Skill was re-read at every phase boundary (Pre-Phase Hook step 1)
- [ ] Implementation phase used a liaison orchestrator, not direct workers
- [ ] QA phase used a tester agent with a testing skill, not director checking
- [ ] QA agent briefing included auth flow, dev server ports, and sequential-only constraint

## Known Limitations

- **Subagent collapse is invisible.** The skill prevents the director from collapsing, but doesn't address what happens when a liaison or spec-writer agent collapses into poor behavior. The director sees only the summary.
- **Continuous verification is optional.** Step 9 in the workflow says "Optional." In practice it should be standard, but the skill doesn't enforce it.
- **No mid-phase intervention guidance.** If a phase agent is taking too long or going off-track, the skill doesn't say what to do. The director has to wait for results.
- **Skill length.** At ~250 lines, the skill is long. After context compaction, the re-read consumes meaningful context. The Auto-Inject block mitigates this but doesn't replace the full re-read.
- **No guidance on phase ordering.** The skill lists phase types but doesn't guide when to skip phases (e.g., skip design if the spec is already clear).

## Retro Guide

When the `skill-retro` skill triggers a retro for build-orchestrate, follow this evaluation process:

**1. Check for role collapse (most critical)**
Scan the session for director tool usage. Flag any use of Grep, Glob, Edit, Bash, or Skill by the director thread. Each instance is a collapse event. Note what triggered it — was it impatience, a "quick check," or misunderstanding the delegation model?

**2. Check whiteboard discipline**
Was the whiteboard created early? Does it have the Auto-Inject block? Was the recovery block updated at phase boundaries? Did the whiteboard stay under 200 lines, or did the director dump instead of distill?

**3. Check agent output protocol**
Did the director instruct agents to return concise summaries? Did the director read phase files directly (context budget violation)? When agent responses were long, did the director read them fully or skim + delegate?

**4. Check pre-phase hook compliance**
Was the skill re-read at phase boundaries? Was a note-to-self written before each spawn? Did notes follow the template (including role-check line)?

**5. Check phase quality**
Did every phase have a reviewer agent? Were iterations logged on the whiteboard? Did the director escalate after 3 failed iterations, or keep going?

**6. Check continuous verification**
Were sanity-check agents spawned between phases? Or was verification deferred entirely to the QA phase?

## What We Learned

See [`what-we-learned.md`](what-we-learned.md) — comprehensive audit of all 7 sessions (Feb 25 — Mar 17), 31 phase artifacts, and 15 research directories. Written 2026-03-17 to preserve institutional knowledge before cleaning up phase artifacts and whiteboards.

## Ideas / Notes

- The hardening added on 2026-02-25 (Hard Rules, Role Collapse, Auto-Inject) was motivated by a user prompt that had to manually reinforce every rule the skill already contained. The skill said the right things but agents didn't follow them — the instructions read as advice, not constraints.
- Experiment: could the Auto-Inject block be even shorter (2 lines instead of 4) without losing effectiveness? Or does brevity lose the § references that make it useful?
- The "Continuous Verification" section was added based on a user's build-orchestrate prompt that ran QA as a parallel axis, not just a final phase. Worth watching whether agents actually spawn verification agents mid-build or skip it.
- Should the skill have a "phase skip" guidance? E.g., "if the user hands you a complete spec, skip research and design, start at implementation."
- Auto-inject session notes (from whiteboard) may be redundant with the whiteboard read itself. The skill rules part is the useful bit — role circuit breaker. The session notes part adds nothing beyond what the director reads from the whiteboard at phase boundaries. Consider making the hook inject only skill rules, keeping session-specific state in the whiteboard. (Observed in 2026-03-17 greet-tool and ping-tool test sessions.)

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-02-25 | Added Hard Rules, Role Collapse, Agent Output Protocol, Note-to-Self Template, Auto-Inject block (4 lines), Continuous Verification, role-check in pre-phase hook | Agents collapsed into doing work despite existing instructions. User had to manually reinforce every rule in their prompt. |
| 2026-02-25 | Renamed "Director's Creed" → "Hard Rules" | Simpler, more direct language. |
| 2026-02-27 | Added QA agent briefing template to skill | QA agents lacked practical setup instructions (auth, ports, sequential constraint). |
| 2026-02-27 | Restructured lab: split retros into individual files under `retros/` | Single file grew to 37KB after 4 retros. Stable reference material buried under growing history. |
| 2026-03-12 | Added Priority Hierarchy, Correctness Rules (#7-10), Test-Integrity Review, Pass/Stop/Defer framework, Implementation Agent Instructions template, updated Auto-Inject (5→6 lines), updated Workflow diagram | GFS Sync Unification retro: 14 regressions shipped because subagents deleted/weakened tests and director had no mechanism to catch it. Skill optimized for flow over correctness. |
