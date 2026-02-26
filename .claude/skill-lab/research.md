# research — Skill Lab

## Intent

Two-tier research orchestration that produces grounded, auditable answers.

The skill exists because agents doing research will either go too shallow (one search, one conclusion) or lose themselves in detail (reading every file, exhausting context). The skill enforces a director/phase-manager/worker hierarchy where the director manages the arc, phase managers manage execution, and workers do the reading.

The skill also handles experiments — phases where the answer comes from doing (deploying, testing, measuring), not reading. The experiment weight adds state management (Experiment State section on whiteboard) and iteration tracking (letter-suffix phase files).

Success means: a research question answered with evidence, confidence levels, and an auditable trail — all visible from the whiteboard alone.

## Success Signals

When retroing a session that used this skill, a good session looks like:

- [ ] Director never used Grep, Glob, Edit, or Bash
- [ ] Director never read phase files, source material, or experiment results
- [ ] Director never loaded a skill into its own context
- [ ] Note-to-self written before every phase manager spawn
- [ ] Every note-to-self includes the "Role check" circuit breaker line
- [ ] Every phase manager was instructed to return a ≤10 line summary
- [ ] Whiteboard stayed under 200 lines
- [ ] Auto-Inject block present at top of whiteboard, unmodified
- [ ] Whiteboard tells the full story — someone reading only the whiteboard understands what was found
- [ ] Judgment was triggered (both process judge and answer judge)
- [ ] Convergence was deliberate — director decided to stop, not just ran out of ideas
- [ ] Entry mode was discussed with user (autonomous/collaborative/autonomy level)
- [ ] (If experiments) Experiment State section maintained between iterations
- [ ] (If experiments) Success criteria pre-registered before first experiment phase
- [ ] Phase managers were given the phase-manager.md reference

## Known Limitations

- **Experiment weight is highest role-collapse risk.** Experiments produce tangible results (logs, metrics, endpoints) that tempt the director to "just check one thing." Warning is in the skill but may not be enough.
- **No "too broad" guardrail.** The skill has convergence signals but no hard limit on number of phases. A director could run 15 phases without converging.
- **Heavy weight (TeamCreate) is undertested.** Most research sessions use lightweight. Heavy weight coordination patterns are less proven.
- **Phase manager instructions are in a separate file.** If the director forgets to tell the phase manager to read `phase-manager.md`, the manager operates without its operating instructions.
- **Judgment can be skipped.** Nothing enforces that judgment happens. A director in a hurry may skip it and present findings directly.
- **No guidance on research vs. build-orchestrate.** When a research question leads to "we should build this," the transition to build-orchestrate isn't documented.

## Retro Guide

When the `skill-retro` skill triggers a retro for research, follow this evaluation process:

**1. Check for role collapse (most critical)**
Scan the session for director tool usage. Flag any use of Grep, Glob, Edit, Bash, or Skill by the director thread. Pay special attention during experiment phases — the director is most likely to collapse when results come back and it wants to "just check" something.

**2. Check whiteboard quality**
Was the whiteboard created early with the Auto-Inject block? Does the final whiteboard tell the full story? Could someone unfamiliar with the research understand the answer from the whiteboard alone? Was SNR maintained (distilled insights, not dumps)?

**3. Check agent output protocol**
Did the director instruct phase managers to return concise summaries? Did the director read phase files directly? When summaries were unclear, did the director spawn a follow-up agent or read the source?

**4. Check pre-phase hook compliance**
Was the skill re-read at phase boundaries? Was a note-to-self written before each spawn? Did notes follow the template?

**5. Check research arc**
Were phases dynamic (adapted based on findings) or rigid (followed initial plan regardless)? Did the director pivot when findings contradicted assumptions? Were dead ends documented?

**6. Check judgment**
Was judgment triggered? Were both judges spawned (process + answer)? Did the director address gaps identified by judges, or ignore them?

**7. Check experiment discipline (if experiments used)**
Was Experiment State section maintained? Were success criteria pre-registered? Did the director read experiment results directly (collapse) or through agent summaries?

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

## Ideas / Notes

- The same hardening applied to build-orchestrate (2026-02-25) was applied here: Hard Rules, Role Collapse, Auto-Inject, Agent Output Protocol, Note-to-Self Template. Both are "director skills" that share the same structural pattern.
- The 4th Auto-Inject line differs: build-orchestrate has "Verification" (continuous sanity checks), research has "Convergence" (when to stop). This reflects their different purposes — building needs ongoing quality checks, research needs to know when to stop.
- Should there be a hard phase limit? E.g., "after 8 phases, you must either converge or escalate to the user." Would prevent infinite research loops.
- The research → build-orchestrate transition is undocumented. When research concludes "we should build X," what happens? Does the director hand off to a build-orchestrate session? Does it become a phase? Worth designing.
- Experiment iterations vs. research phases: the line between "another iteration of the same experiment" and "a new phase" is fuzzy. Director judgment is the only guide. Could we add heuristics?

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-02-25 | Added Hard Rules, Role Collapse, Agent Output Protocol, Note-to-Self Template, Auto-Inject block (4 lines with Convergence), role-check in pre-phase hook | Same motivation as build-orchestrate: agents collapsed despite instructions. |
| 2026-02-25 | Added role-collapse warning to Experiment weight section | Experiments are highest risk for collapse — tangible results tempt direct checking. |
