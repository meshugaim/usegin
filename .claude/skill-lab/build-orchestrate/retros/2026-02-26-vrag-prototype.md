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
- **Agent output protocol followed.** Director trusted summaries consistently, never read phase files directly. Context stayed lean despite the long session.
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
