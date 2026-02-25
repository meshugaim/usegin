# build-orchestrate — Skill Lab

## Intent

Prevent directors from collapsing into workers during multi-phase builds.

The skill exists because agents given a complex build task will naturally start doing the work themselves — reading code, reviewing specs, running tests. This consumes their context, narrows their perspective, and breaks orchestration. The skill enforces a strict delegation model: the director keeps the whiteboard, spawns agents for everything, and never touches the work.

Success means: a full build lifecycle (research → design → spec → implement → QA) completed with the director thread staying thin, the whiteboard telling the full story, and every phase executed by subagents.

## Success Signals

When retroing a session that used this skill, a good session looks like:

- [ ] Director never used Grep, Glob, Edit, or Bash
- [ ] Director never read files other than the whiteboard and the skill itself
- [ ] Director never loaded a skill into its own context (no `Skill:` calls)
- [ ] Note-to-self written before every agent spawn
- [ ] Every note-to-self includes the "Role check" circuit breaker line
- [ ] Every phase agent was instructed to return a ≤10 line summary
- [ ] Every phase had a reviewer agent (not reviewed by director)
- [ ] Whiteboard stayed under 200 lines
- [ ] Auto-Inject block present at top of whiteboard, unmodified
- [ ] Recovery block (Current State) updated at every phase boundary
- [ ] Skill was re-read at every phase boundary (Pre-Phase Hook step 1)
- [ ] Implementation phase used a liaison sub-orchestrator, not direct workers
- [ ] QA phase used a tester agent with a testing skill, not director checking

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

**Write findings to the Retros section below.** Use the entry format specified there.

## Retros

<!-- Retro entries go here. Format:

### YYYY-MM-DD — [session-id or short description]
**Verdict:** [worked well | partially followed | collapsed]
**Collapse events:** [count, or "none"]
**Key observations:**
- ...
**Suggestions:**
- ...

-->

### 2026-02-25 — admin-usage-rebuild (conversation-first /admin/usage)
**Verdict:** partially followed
**Collapse events:** 0 (strict — no Grep/Glob/Edit/Skill by director)
**Key observations:**

Signal checklist:
- [x] Director never used Grep, Glob, Edit
- [x] Director never read files other than whiteboard and skill
- [x] Director never loaded a skill into its own context
- [x] Note-to-self written before every agent spawn
- [x] Every note-to-self includes "Role check" circuit breaker
- [x] Every phase agent instructed to return ≤10 line summary
- [ ] Every phase had a reviewer agent — **Research and Spec phases had no reviewer**
- [x] Whiteboard stayed under 200 lines (~50 final)
- [x] Auto-Inject block present and unmodified
- [x] Recovery block updated at every phase boundary
- [ ] Skill re-read at every phase boundary — **only re-read once after interrupt, skipped before Design and Spec phases**
- [x] Implementation used liaison sub-orchestrator
- [x] QA used tester agent with app-sanity-test skill

Details:
- **No role collapse.** Director used Bash only for plan CLI, git operations (at user request), mkdir, and checking agent output. Never touched application code.
- **Skill re-read was inconsistent.** Re-read after the keyboard interrupt (good recovery), but did NOT re-read before Design or Spec phases. The Pre-Phase Hook says "skipping any step is a bug."
- **Missing reviewers.** Research had 2 parallel agents that cross-validated (reasonable shortcut), but Spec phase had no reviewer at all — the spec went straight to implementation. The spec's UUID branching logic was flawed, and a reviewer might have caught it before it became a QA bug.
- **Continuous verification was front-loaded.** Sanity agent ran in parallel with research (good), but no verification between design→spec or spec→implementation. The user's original ask ("run 2 axes") was partially honored — verification happened at start and end, not throughout.
- **Haiku used for diagnostic agent.** Hook flagged this. Diagnostic checks should still use opus per project guidelines.
- **Agent output protocol worked well.** Director never read phase files, trusted summaries, spawned follow-up agents when clarification needed.
- **QA caught real bugs.** The UUID branching design flaw survived through spec and implementation, only caught in QA. Earlier verification or a spec reviewer might have caught it sooner.

**Suggestions:**
- Make skill re-read a mechanical habit, not judgment-based. Consider: "Before spawning, always re-read the first 30 lines of the skill" as a lighter-weight alternative to full re-read.
- Research phase reviewer could be skipped IF multiple agents cross-validate. Add guidance: "If research used 2+ parallel agents, cross-validation counts as review."
- Spec phase MUST have a reviewer — it's the last checkpoint before implementation. The QA bugs trace directly to an unreviewed spec decision.
- Continuous verification guidance should be stronger than "optional." Suggest: "Spawn a sanity agent after spec phase to confirm the design matches reality before building."

## Ideas / Notes

- The hardening added on 2026-02-25 (Hard Rules, Role Collapse, Auto-Inject) was motivated by a user prompt that had to manually reinforce every rule the skill already contained. The skill said the right things but agents didn't follow them — the instructions read as advice, not constraints.
- Experiment: could the Auto-Inject block be even shorter (2 lines instead of 4) without losing effectiveness? Or does brevity lose the § references that make it useful?
- The "Continuous Verification" section was added based on a user's build-orchestrate prompt that ran QA as a parallel axis, not just a final phase. Worth watching whether agents actually spawn verification agents mid-build or skip it.
- Should the skill have a "phase skip" guidance? E.g., "if the user hands you a complete spec, skip research and design, start at implementation."

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-02-25 | Added Hard Rules, Role Collapse, Agent Output Protocol, Note-to-Self Template, Auto-Inject block (4 lines), Continuous Verification, role-check in pre-phase hook | Agents collapsed into doing work despite existing instructions. User had to manually reinforce every rule in their prompt. |
| 2026-02-25 | Renamed "Director's Creed" → "Hard Rules" | Simpler, more direct language. |
