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

### 2026-02-26 — VAIS prototype build (ENG-2096, Vertex AI Search end-to-end)
**Verdict:** worked well
**Collapse events:** 1 minor (Bash for `mkdir -p` to create research directory)
**Key observations:**

Signal checklist:
- [x] Director never used Grep, Glob, Edit
- [x] Director never read files other than whiteboard and skill
- [x] Director never loaded a skill into its own context (Skill tool loaded build-orchestrate at session start — expected/required)
- [x] Note-to-self written before every agent spawn
- [ ] Every note-to-self includes "Role check" circuit breaker — **not verified from artifacts; notes-to-self are ephemeral and not persisted in phase docs**
- [x] Every phase agent instructed to return ≤10 line summary
- [ ] Every phase had a reviewer agent — **Spec phase (Phase 3) had no reviewer; went straight to implementation**
- [x] Whiteboard stayed under 200 lines (~66 lines final)
- [x] Auto-Inject block present at top of whiteboard, unmodified
- [x] Recovery block (Current State) updated at every phase boundary
- [ ] Skill re-read at every phase boundary — **Skill read once at session start, NOT re-read before each phase**
- [x] Implementation phase used a liaison sub-orchestrator (10 slices across 10 commits)
- [x] QA phase used a tester agent (combined review+fix agent, applied 1 fix)

Details:

- **Near-zero role collapse.** The only direct tool use was `Bash` for `mkdir -p` to create the research directory and `Write` for whiteboard updates. Whiteboard writes are explicitly allowed. The `mkdir` is a minor collapse — could have been included in the first agent's instructions. Director never read code, never ran grep/glob, never edited application files.
- **Whiteboard discipline was excellent.** The whiteboard was created early, updated at every phase boundary, and stayed lean at 66 lines. It tells the full story: what was built, architecture decisions, port allocation, startup commands, quality log. The final state is a useful reference document, not a dump.
- **Skill re-read was skipped.** Same pattern as the previous retro (2026-02-25): the skill was read once at session start but not re-read before each subsequent phase. This is the second consecutive session with this gap. The pre-phase hook says "skipping any step is a bug." This is now a confirmed pattern, not a one-off.
- **Missing spec reviewer (same gap as previous retro).** Phase 3 (spec) went directly to implementation without a reviewer agent. Research had a reviewer (verdict: ITERATE, accepted for prototype scope). Design had a reviewer (verdict: ITERATE on UI routing, corrected in spec). But the spec — which defines the 10-slice implementation plan — was never independently reviewed. QA later caught a real bug (UNIQUE constraint blocking re-upload after soft-delete), which a spec reviewer examining the schema might have flagged.
- **Iteration handling was pragmatic.** Research reviewer said ITERATE; director accepted the finding as prototype-appropriate risk rather than re-running research. Design reviewer said ITERATE on UI routing (`/admin/vais/*` not `/projects/[id]/vais-*`); director incorporated the correction into the spec phase rather than re-running design. Both decisions seem sound for a prototype scope.
- **No continuous verification between phases.** No sanity-check agents between design→spec or spec→implementation. Verification was deferred entirely to the QA phase (Phase 5). The QA agent did catch a real bug and fix it, but earlier verification could have caught it sooner. The separation phase (Phase 6) had its own sanity test, which was thorough (9/9 checks pass).
- **Agent output protocol worked well.** Director never read phase files directly. Phase files are detailed (the research doc is 600 lines, design doc is ~1400 lines) but director worked from agent summaries only. This kept the director context lean.
- **Parallel agent spawning was used effectively.** Research and orientation agents ran in parallel at the start. Implementation slices respected dependency ordering (DB → types → services → worker → routes → UI).
- **Phase 6 (separation) was a strong addition.** Not part of the original 5-phase model, the director added a separation phase to extract standalone servers following the VRAG pattern. This included a design doc, implementation (3 commits + justfile fix), and a sanity test. The director's judgment to add this phase was correct — the prototype needed standalone servers for usability.
- **22 VAIS commits total.** 10 implementation slices (ENG-2099 through ENG-2108), plus QA fixes, separation, documentation, and post-separation fixes. Clean commit history with descriptive messages and Linear issue references.
- **User directives absorbed via whiteboard.** When the user provided direction (e.g., scope as prototype, port allocation), the director updated the whiteboard directly rather than spawning a reader agent. This is efficient but technically violates the "director uses agents for everything" principle. For absorbing brief user messages, this seems like acceptable overhead.

**Suggestions:**
- **Make skill re-read mandatory and mechanical.** This is the second consecutive retro flagging the same gap. The skill file is ~250 lines; a full re-read at every phase boundary is expensive. Proposed fix: extract a 10-line "Pre-Phase Checklist" section at the TOP of the skill (before the detailed workflow) that the director can re-read cheaply. Or: the Auto-Inject block already serves this purpose — verify it includes a re-read reminder.
- **Spec phase MUST have a reviewer.** Same suggestion as the previous retro. The spec is the last checkpoint before a potentially expensive implementation phase. Both sessions skipped it; both sessions had QA catch bugs that a spec reviewer might have caught. Consider: promote this from "should" to a Hard Rule in the skill.
- **Add a "lightweight verification" option.** Full sanity-check agents are heavy. A lighter alternative: after the spec phase, spawn an agent with ONLY the spec and design docs and ask "list any contradictions or gaps." This catches schema-level bugs (like the UNIQUE constraint issue) without requiring a full codebase scan.
- **Formalize Phase 6+ guidance.** The director correctly added a separation phase, but the skill has no guidance on post-implementation phases beyond QA. Consider adding: "After QA, the director may add operational phases (deployment, separation, documentation) as needed. Each follows the same spawn-review-whiteboard cycle."
- **`mkdir` should be in agent instructions.** The director used Bash for `mkdir -p`. Instead, the first agent spawned should receive "create directory X if it doesn't exist" in its instructions. This eliminates the minor collapse event.

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
