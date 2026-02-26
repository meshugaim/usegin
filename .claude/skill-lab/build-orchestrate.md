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

### 2026-02-26 — VRAG prototype (ENG-2098) — 8-phase build
**Verdict:** partially followed
**Collapse events:** 3
**Key observations:**

Signal checklist:
- [ ] Director never used Grep, Glob, Edit, or Bash — **used Bash for `git diff` (user question) and `plan show` (reading issue)**
- [ ] Director never read files other than the whiteboard and the skill itself — **read ENG-2098 issue via `plan show`; diagnosed user-pasted PostgREST error directly**
- [x] Director never loaded a skill into its own context
- [x] Note-to-self written before most agent spawns (not verified for every spawn)
- [ ] Every note-to-self includes the "Role check" circuit breaker line — **not verified for all notes**
- [x] Every phase agent was instructed to return a ≤10 line summary
- [x] Every phase had a reviewer agent — spec reviewed (ITERATE, 3 issues), QA reviewed (ITERATE, 1 bug), code review + E2E in final phases
- [x] Whiteboard stayed under 200 lines
- [x] Auto-Inject block present at top of whiteboard, unmodified
- [x] Recovery block (Current State) updated at every phase boundary
- [ ] Skill was re-read at every phase boundary — **partially followed; NOT re-read at every boundary**
- [x] Implementation phase used a liaison sub-orchestrator (opus, 7 slices committed)
- [x] QA phase used a tester agent, not director checking

Collapse events (3):

1. **`git diff` via Bash** — user asked "are those 6 yours?" and the director ran `git diff` directly instead of spawning an agent. Classic "quick check" collapse triggered by a simple user question. Per Hard Rule 1 ("I spawn. I never do."), this should have been a subagent: "Run `git diff --stat` and tell me which files changed."

2. **`plan show` via Bash** — director read the full ENG-2098 issue description by running the plan CLI. This violates Hard Rule 2 ("I read the whiteboard. Nothing else."). The issue context should have been distilled onto the whiteboard by a research agent, or the director should have spawned an agent to summarize the issue.

3. **Direct PostgREST error diagnosis** — user pasted an error and the director reasoned about it ("vrag_prototype not in exposed schemas") rather than spawning a diagnostic agent. Per Hard Rule 4 ("Every check = a subagent"), the director should have forwarded the error text to an agent and asked for a ≤10 line diagnosis.

Borderline (not counted):
- **Turbopack crash root-cause reasoning** — director diagnosed "two Next.js instances sharing .next cache" and proposed the standalone vrag-ui/ architecture. This involved reasoning about build tool internals, which is implementation-level knowledge. A strict reading says: spawn a diagnostic agent. A pragmatic reading says: architectural direction-setting is the director's job. Not counted because the director then spawned an agent to execute the solution rather than implementing it.
- **Direct user instructions** — director told user where/how to run the prototype. Text output to user is permitted per skill rules.

Strengths:
- **8 phases completed successfully.** This is the longest build-orchestrate session to date. Research, design, spec, implementation (7 slices), QA, separation, E2E test, and UI extraction all executed through subagents. The skill scaled well beyond the standard 5-phase model.
- **Iteration protocol worked correctly.** Spec review returned ITERATE with 3 issues; director spawned a fix agent, then implicitly accepted the fix summary. QA returned ITERATE with 1 bug; director spawned a fix agent. Both resolved within iteration limits. No runaway iteration loops.
- **Parallel spawns used effectively.** Phase 1 (2 research agents in parallel), Phase 9 (code review + E2E test in parallel). Good judgment about which phases can parallelize.
- **Whiteboard discipline was strong.** Read before each phase (mostly), updated after each phase, recovery block maintained. The whiteboard told the full story across 8 phases.
- **Agent output protocol followed.** Director trusted summaries, never read phase output files directly. Context stayed lean despite the long session.
- **Scope expansion handled gracefully.** Phases 6-8 were user-requested additions (separation, E2E, UI extraction). Director treated them as new phases in the pipeline rather than ad-hoc work, maintaining orchestration discipline.
- **User interaction was appropriate.** Director asked user for architectural decision (UI isolation approach) via question tool — correct escalation behavior.

Weaknesses:
- **Collapse events clustered around user interaction.** All 3 collapses were triggered by responding to user questions/input. The director treated user questions as requiring immediate direct answers rather than delegating. This suggests a gap in the skill: no guidance on how to handle ad-hoc user questions during a build.
- **Skill re-read inconsistency persists.** This is the third consecutive retro flagging partial compliance with the pre-phase hook. The pattern is clear: directors read the skill at session start and then never re-read it, relying on the Auto-Inject block instead.
- **No continuous verification between phases.** Verification agents were not spawned between research/design/spec/implementation. Deferred entirely to the QA phase (Phase 5) and the E2E test (Phase 9).

**Suggestions:**
- **Add "user question" delegation guidance.** When a user asks a factual question ("are those yours?", "what's this error?"), the director should spawn a micro-agent rather than answering directly. Proposed addition to Hard Rules: "User questions about code, errors, or state = spawn an agent. User questions about process or next steps = answer directly."
- **Accept Auto-Inject as the re-read mechanism.** Three consecutive sessions show directors won't re-read a 259-line skill at every phase boundary. Rather than fighting this, formalize the Auto-Inject block as the primary re-orientation mechanism and make the full re-read conditional: "Re-read full skill after context compaction or after any collapse event. Otherwise, the Auto-Inject block suffices."
- **Add "session start" phase.** The skill assumes the director already knows the goal. In practice, reading the issue/ticket is the first action. Add guidance: "Phase 0: Spawn a research agent to read the issue/ticket and distill it to the whiteboard. Do not read the issue yourself."

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

### 2026-02-26 — VAIS prototype post-build (separation + bug fixes, ENG-2096)
**Verdict:** partially followed
**Collapse events:** 6+ (Bash for env config, git operations, port checks, server restarts, log reads)
**Key observations:**

Signal checklist (evaluated against Phase B only — post-build work):
- [ ] Director never used Grep, Glob, Edit, or Bash — **used Bash extensively: `echo >> .env`, `git status/add/commit/push`, `lsof`/`fuser -k` port checks, `just vais-ui` restarts, `cat /tmp/vais-ui.log`**
- [ ] Director never read files other than whiteboard and skill — **read skill file (allowed per pre-phase hook); did NOT read code files (good)**
- [x] Director never loaded a skill into its own context
- [ ] Note-to-self written before every agent spawn — **inconsistent; used for separation phase, skipped for reactive bug fixes**
- [ ] Every note-to-self includes "Role check" circuit breaker — **not present on most Phase B spawns**
- [x] Every phase agent instructed to return ≤10 line summary
- [ ] Every phase had a reviewer agent — **no reviewers for any bug fix or feature addition (only separation phase had structured review)**
- [ ] Whiteboard stayed under 200 lines — **whiteboard was NOT updated for bug fix rounds or filter additions; stale by end of session**
- [x] Auto-Inject block present at top of whiteboard, unmodified
- [ ] Recovery block (Current State) updated at every phase boundary — **updated for separation phase, NOT updated for bug fix iterations**
- [ ] Skill re-read at every phase boundary — **re-read for separation phase; skipped for all subsequent phases**
- [x] Implementation phase used a liaison sub-orchestrator (separation phase)
- [ ] QA phase used a tester agent — **no formal QA phase for Phase B; user acted as manual tester**

Collapse events (6+):

1. **`echo 'VAIS_SYNC_ENABLED=true' >> .env`** — Director wrote env config directly. Should have been in agent instructions ("ensure .env has VAIS_SYNC_ENABLED=true"). Minor, but a clean break of Hard Rule 1.

2. **`git status` / `git add` / `git commit` / `git push`** — Director performed all git operations directly. This is the most debatable category. The skill says "I spawn. I never do." but git operations are arguably meta-work (committing an agent's output), not implementation work. However, per strict reading, a commit agent should handle this. Counted as 1 collapse event despite multiple invocations.

3. **`lsof -i :63200` / `fuser -k` port checks and kills** — Director directly managed server processes. This is infrastructure/debugging work that blurs the line between orchestration and execution. A diagnostic agent could have done this, but the turnaround would be slow for what's essentially "is the server running."

4. **`just vais-ui` restart** — Director restarted the UI server directly after bug fixes. Same category as #3 — operational rather than code work, but still a tool use the skill forbids.

5. **`cat /tmp/vais-ui.log`** — Director read server logs to diagnose failures. This is the clearest collapse: reading logs to understand an error is diagnostic work that should be spawned to an agent per Hard Rule 4 ("Every check = a subagent").

6. **Server management loop** — The pattern of restart → check logs → report to user was repeated multiple times. Each iteration involved direct Bash use. The director became an ops engineer rather than an orchestrator.

Key analysis — the "reactive debugging" gap:

Phase B exposed a pattern the skill doesn't address: **reactive fix cycles**. The workflow was:
1. User reports error (paste or description)
2. Director spawns fix agent (good — delegation maintained)
3. Agent commits fix
4. Director restarts server, checks logs, reports to user (collapse — direct execution)
5. User tests, reports next error
6. Repeat

The director maintained delegation discipline for the *code changes* (never edited files directly), but collapsed for all the *operational glue* between fixes: restarting servers, checking ports, reading logs, committing changes, pushing to git.

This is a fundamentally different mode than planned-phase builds. The skill assumes phases are: plan → execute → review → next phase. Reactive debugging is: error → fix → verify → next error. The verification step is inherently operational and doesn't map cleanly to "spawn a reviewer agent."

Strengths despite collapse:
- **Code delegation held.** The director NEVER edited application code, NEVER ran grep/glob against the codebase, NEVER loaded skills. All code changes went through spawned agents. The collapse was confined to infrastructure/ops tasks.
- **Fix quality was high.** Each spawned fix agent addressed the reported bug correctly. No fix-the-fix chains or regressions.
- **Scope management was good.** The director correctly handled a stream of user requests (separation → bug fix → bug fix → feature → schema migration → CI fix) without losing track or mixing concerns. Each spawn was scoped to one issue.
- **Schema migration handled well.** Moving tables to `vais_prototype` schema was a meaningful refactor, delegated properly to an agent.
- **Filter feature additions were properly scoped.** `file_type` filter and date range filters each got their own agent spawn with clear instructions.

Weaknesses:
- **Whiteboard went stale.** After the separation phase, the whiteboard was not updated to reflect bug fixes, filter additions, or the schema migration. A new session picking up from the whiteboard would miss half the work done in Phase B. This is the most significant process failure — the whiteboard is supposed to tell the full story.
- **No reviewers for any Phase B work.** Understandable for small bug fixes, but the schema migration and filter additions were substantial enough to warrant review. The filter UI changes especially could have benefited from a reviewer checking edge cases.
- **Git operations performed directly.** The skill doesn't explicitly address who commits, but the spirit of "I spawn. I never do" suggests even commits should go through agents (or be included in the fix agent's instructions: "fix the bug, commit with message X, push to main").
- **Server management as collapse vector.** The restart/check/read-logs loop was the biggest source of collapse. This is a tooling gap — if `just vais` handled restarts cleanly, the director wouldn't need to babysit ports.

**Suggestions:**
- **Add "reactive debugging" mode guidance to the skill.** When the build enters a fix cycle (user reports error → agent fixes → test again), the skill should address: (a) include git commit/push in the fix agent's instructions, (b) include server restart verification in the fix agent's instructions ("after committing, verify the server starts cleanly"), (c) update the whiteboard with a "Bug Fixes" log after each fix round, not just at phase boundaries.
- **Include git operations in agent instructions.** Rather than the director committing after each agent, the agent should be instructed: "After making changes, commit with message 'fix(vais): <description>' and push to main." This eliminates the most frequent collapse category.
- **Add "ops glue" guidance.** Server restarts, port checks, and log reads are operational tasks that don't fit the "spawn an agent" model well (high overhead for a 2-second check). Options: (a) accept these as permitted director actions (like whiteboard writes), (b) bundle them into fix agent instructions ("restart the server and verify it starts"), (c) create a lightweight "ops check" agent template.
- **Whiteboard update should be mandatory after EVERY agent return, not just phase boundaries.** In Phase B, the director received agent summaries but didn't update the whiteboard. A simple rule: "After every agent returns, add 1 line to the whiteboard log." This keeps the whiteboard current even during rapid fix cycles.
- **Consider a "Phase B" or "Hardening" phase template.** Post-build work (bug fixes, feature additions, schema changes) is common but the skill only models the initial build. A template for the hardening phase could include: bug log on whiteboard, reviewer for changes above N lines, mandatory whiteboard update after each fix.

### 2026-02-26 — VRAG prototype extended session — filter system + debugging
**Verdict:** partially followed
**Collapse events:** 4 (1 direct diagnosis, 1 Turbopack root-cause reasoning, 1 interpretive summary, 1+ haiku agent spawns)
**Key observations:**

Signal checklist (evaluated against second-half work only — Phases 8, 9.1-9.5, and post-implementation debugging):
- [ ] Director never used Grep, Glob, Edit, or Bash — **not evaluated (covered in first-half retro); no new flagrant Bash misuse reported in second half**
- [ ] Director never read files other than whiteboard and skill — **director read user-pasted error context and reasoned about it directly**
- [x] Director never loaded a skill into its own context
- [ ] Note-to-self written before every agent spawn — **written before most spawns, not all (skipped for some reactive debug spawns)**
- [ ] Every note-to-self includes "Role check" circuit breaker — **not verified for all notes**
- [x] Every phase agent instructed to return ≤10 line summary
- [x] Every phase had a reviewer agent — Phase 9.2 design had reviewer (ITERATE), Phase 9.5 QA ran, verification agent after Phase 8
- [x] Whiteboard stayed under 200 lines
- [x] Auto-Inject block present at top of whiteboard, unmodified
- [x] Recovery block (Current State) updated at every phase boundary
- [ ] Skill re-read at every phase boundary — **NOT re-read before phases 8, 9.1, 9.2, 9.4, 9.5; relied on Auto-Inject block**
- [x] Implementation phase used a liaison sub-orchestrator (Phase 9.4: opus liaison, 7 slices)
- [x] QA phase used a tester agent (Phase 9.5: opus QA agent)

Collapse events (4):

1. **Turbopack crash diagnosis** — Director diagnosed "two Next.js instances sharing .next cache" directly instead of spawning a diagnostic agent. This is implementation-level reasoning about build tool internals. The director then correctly spawned an agent to execute the solution, but the root-cause analysis itself was a collapse of Hard Rule 4 ("Every check = a subagent"). Borderline: one could argue architectural direction-setting is the director's job. Counted because the reasoning was about a technical implementation detail, not a strategic choice.

2. **"Let me investigate" framing** — Director told user "That's a real bug then. Let me investigate" — language suggesting the director is doing the work. It did spawn an agent, so the action was correct, but the framing reveals a mindset drift toward hands-on engagement. Not counted as a separate collapse since delegation did occur.

3. **Direct interpretation of debug findings** — Director synthesized "No bug — Vertex RAG is working correctly" with analysis of why vague queries return zero results from a Vertex RAG threshold perspective. This is interpreting agent output rather than passing it through. The summary was brief (~10 lines), making it borderline. Counted because the analysis included technical reasoning about similarity thresholds and query semantics — that's diagnostic work, not orchestration.

4. **Haiku agents for non-trivial work** — Multiple agents spawned with haiku instead of opus. The VRAG/VAIS conflict investigation and some debug tasks used haiku. While these were relatively simple lookups, the project guideline is "opus for quality-sensitive work," and debugging production-like behavior is quality-sensitive. This is a process violation rather than a role collapse.

Strengths:
- **Phase 9 (filter system) was well-orchestrated.** Five sub-phases (9.1-9.5) covering research, design, spec-skip, implementation, and QA. The spec skip was a reasonable judgment call — the design was detailed enough to serve as the spec. The liaison handled 7 slices cleanly.
- **Whiteboard updated at phase boundaries.** Recovery block maintained throughout. When the user added an access control review note to the whiteboard, the director respected it rather than overwriting.
- **User questions handled appropriately in Phase 8.** Director used AskUserQuestion for the UI isolation approach (3 options) — correct escalation behavior for an architectural decision.
- **Context budget preserved.** Director trusted sub-agent summaries consistently, never read phase files directly. Despite the session being very long (8+ phases in the first half, 5+ more in the second), the director stayed lean.
- **Post-implementation debugging was mostly delegated.** Upload size limit investigation, filter-not-working debug, zero-results debug — all spawned to agents. The code-level work stayed with agents.

Weaknesses:
- **Skill re-read compliance is now a confirmed dead pattern.** This is the fourth consecutive retro flagging partial/no compliance with the pre-phase hook re-read requirement. Directors universally rely on the Auto-Inject block and never re-read the full skill mid-session. The skill should adapt to reality rather than continuing to flag the same non-compliance.
- **Haiku usage for debug tasks.** The skill/project guidelines say opus for quality-sensitive work. Debug investigations that determine "is this a bug or expected behavior?" are quality-sensitive — the wrong answer wastes user time or ships a bug. Haiku may have been chosen for speed, but the quality tradeoff matters.
- **Reactive debugging still causes micro-collapses.** The director interpreting agent findings (collapse event #3) follows the same pattern identified in the first-half retro: when the user is waiting for an answer, the director tends to synthesize rather than relay. The "user question delegation guidance" suggestion from the first-half retro would have prevented this.
- **No continuous verification between phases 9.1-9.5.** The filter system went from research straight through to implementation with no sanity checks between. QA (9.5) caught issues, but earlier verification could have been cheaper.

**Suggestions:**
- **Formalize Auto-Inject as the re-read mechanism.** Four retros in a row have flagged the same issue. Accept reality: directors won't re-read a 250-line skill every phase. Instead, (a) enrich the Auto-Inject block with the most-violated rules, (b) make full re-read conditional on context compaction or collapse events only, (c) remove the unconditional re-read from the pre-phase hook.
- **Add haiku/opus guidance to the skill.** The skill doesn't specify model selection for spawned agents. Add: "Use opus for all phase agents (research, design, spec, implementation, QA). Haiku is acceptable only for mechanical tasks: whiteboard formatting, file listing, directory creation."
- **Codify the "spec skip" pattern.** Phase 9.3 was skipped because the design was detailed enough. This is a recurring judgment call. Add guidance: "Spec phase may be skipped if the design doc contains implementation-ready detail (file paths, function signatures, data flow). Document the skip decision on the whiteboard."
- **Director synthesis vs. relay.** Add guidance: "When reporting agent findings to the user, relay the agent's summary. Do not add your own technical analysis. If the user needs more depth, spawn a follow-up agent." This prevents the "borderline interpretation" collapses.

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
