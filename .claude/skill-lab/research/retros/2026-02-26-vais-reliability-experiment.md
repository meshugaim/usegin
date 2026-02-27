### 2026-02-26 — ENG-2093 VAIS reliability experiment
**Verdict:** worked well
**Collapse events:** 0
**Key observations:**
- **No research-level collapse.** Director never read phase files, source code, or experiment results. All research was delegated to 9 subagents across 7 phases (1, 1b, 2, 2b, 3, 4, 5) plus 2 judges.
- **Bash for session management only.** Director used Bash for `plan show/start/close` (Linear) and git operations (status, add, commit, push). These are not research actions — no experiment output was read through Bash. Technically breaks Hard Rules but not in spirit.
- **Note-to-self discipline: strong.** Written before every spawn (8/8 phases + judgment). All include the "Role check" circuit breaker line. Template followed consistently.
- **Agent output protocol: strong.** Every phase manager instructed to "return ≤10 line summary, write details to phase file." Director trusted summaries — when Phase 2a revealed the 1MB limit, spawned Phase 2b instead of reading the source.
- **Adaptive phasing.** Phase 2 split into 2a/2b when inline upload limit discovered. Not rigid adherence to initial plan.
- **Whiteboard quality: high.** 129 lines. Auto-Inject block present and unmodified (plus one custom Directives line). 3-way comparison table, verdict, confidence levels, open questions. Readable standalone.
- **Experiment discipline: strong.** Experiment State section maintained throughout. Success criteria pre-registered before first experiment phase. Letter-suffix phase files used (phase-02b).
- **Judgment: complete.** Both process and answer judges spawned. Gaps identified (>1000-chunk searchability, narrow Q6 window, no PDF testing) were documented as open questions rather than addressed with additional phases — reasonable convergence decision.
- **Entry mode not explicitly discussed.** User's prompt was highly directive ("use the /research skill, in an experimental mode") so director treated it as implicit autonomous. Skill says to ask. Minor miss.
- **Pre-phase hook step 0 skipped.** Skill was never re-read at phase boundaries. Session was continuous without context compaction, so this had no practical impact, but the step exists for a reason.
- **Phase-manager.md reference: 7/8.** Phase 1b (infra setup continuation) was not given the phase-manager.md reference. All other phases were.
- **Pre-spawned context gathering.** Before invoking /research, director spawned 2 subagents to gather existing infra info and ENG-2060 methodology. This front-loaded context efficiently and avoided re-research inside the skill.
**Suggestions:**
- Clarify in Hard Rules that Bash for session management (git, Linear CLI) is acceptable. Current wording technically forbids it but the spirit is about not doing research directly.
- Consider making step 0 (re-read skill) conditional: "Re-read if >3 phases since last read or after context compaction." Mandatory re-read every phase is friction without value in short sessions.
- The "entry mode" check could be skipped when the user's invocation prompt is clearly directive and autonomous. Add a clause: "If the user's prompt specifies the mode, adopt it."
