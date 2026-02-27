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
