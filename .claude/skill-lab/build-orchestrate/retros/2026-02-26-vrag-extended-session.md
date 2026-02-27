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
