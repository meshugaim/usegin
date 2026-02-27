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
