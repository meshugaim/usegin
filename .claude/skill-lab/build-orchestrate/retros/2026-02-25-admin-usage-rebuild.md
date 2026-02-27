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
