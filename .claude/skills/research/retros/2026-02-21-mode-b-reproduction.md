# Retro: Mode B SSE Stream Death Reproduction

**Date:** 2026-02-21
**Research:** `.claude/research/reproduce-mode-b/`
**Session:** Fully autonomous, ~3 hours

## Context

First real use of the research skill on an experiment-heavy investigation. Goal: reproduce Phil Lau's exact SSE stream death (Mode B — streams dying during active token flow, not idle timeout). Required deploying code to Railway, running tests, iterating on experiment design, and catching a rare infrastructure event.

## What Worked

**The whiteboard as central artifact.** At the end, the whiteboard told a coherent story: what was asked, what was found, how confident we are. Someone unfamiliar with the research can read it cold and understand. The dual purpose (anchor + living record) held up.

**The note-to-self ritual.** Prevented drift between phases. When a phase manager returned a wall of findings, having pre-written "here's what I was looking for" helped process them without getting lost.

**The dual-judge pattern.** Process judge (ADEQUATE) caught overconfidence on the two-hop claim — single event treated too strongly. Answer judge (SUPPORTED) identified Railway proxy logs as the single most impactful next step. Neither rubber-stamped. The PROVEN/SUPPORTED/BEST-GUESS vocabulary forced honest calibration that narrative hedging doesn't.

**Forensic-first approach.** Phase 1 (reading Sentry traces) was a perfect fit for the skill's read-research model. The ms-level reconstruction of Phil's failures grounded everything that followed.

**Evidence trail.** Every claim traces to a Sentry trace ID, Railway log timestamp, or experiment result. Phase files are auditable. The judges could verify the narrative against the evidence.

## What Didn't Work

**The director did Phase 2 (experiment) himself.** The skill says "you never do the research yourself." But experiment work — deploy server, run tests, it fails, modify approach, redeploy, run again — is an iteration loop that didn't fit the "spawn phase manager → get findings → next phase" model. The director ended up writing code, running curl, debugging deployments directly.

**Why it happened:**
1. Each experiment iteration needed context from all previous iterations
2. Phase managers are stateless — they die after the phase, no memory of what was tried
3. Spawning a new phase manager for each iteration meant re-explaining everything
4. Debugging a failed deployment (proxy service serving wrong code) required the full context the director already had

**Soak v2 results never got written to phase-02.** The whiteboard referenced them (0/500) but the phase file said "Results will be added when complete." Documentation gap — fixed retroactively but shouldn't have happened.

**No TCP-level diagnostics when the failure occurred.** curl was running with basic options. `--trace-ascii` would have revealed RST vs FIN vs TLS alert — data that can't be recovered after the fact. The experiment wasn't instrumented for the rare event it was designed to catch.

**"Cannot be prevented" stated without testing prevention.** The judges called this out. No experiment tested TCP keepalive tuning, HTTP/2 PING frames, or other defensive measures. Conclusion may be correct but was asserted, not demonstrated.

**No pre-registered success criteria.** Should have defined upfront: "Mode B is reproduced if we observe curl exit 18 during active token flow, with no server-side error, on at least N independent events." Instead caught 1 event and declared partial success. The judges had to retroactively calibrate confidence.

## Skill Changes Made

Added **experiment weight** alongside lightweight and heavy:

- **Experiment State section** on the whiteboard — what's deployed, what's been tried, current hypothesis, next step. The director maintains this between iterations.
- **Each iteration is a sub-phase** — cheap, fast, focused. Phase files use letter suffixes: `phase-02a`, `phase-02b`, etc.
- **Phase manager gets experiment state + previous phase file** — strategic context from the whiteboard, tactical detail from the last iteration's phase file.
- **Phase manager returns what changed** — not just findings but infrastructure modifications, so the director can update experiment state.
- **Pre-registration of success criteria** before the first experiment phase.
- **Shorter note-to-self** between experiment iterations (vs full ritual between phase transitions).

These changes affect `SKILL.md` and `phase-manager.md` only. The orchestration loop, judgment process, and judge files are unchanged.

## Open Questions

1. **Is "keep iterations small" practical?** The skill now says one iteration = one testable change. But "deploy endpoint + run 20 test connections + analyze results" feels like one natural unit of work, even though it's technically multiple steps. Will phase managers split too granularly?

2. **Will the experiment state section get unwieldy?** If an experiment runs 10+ iterations, the "Tried" list grows long. Should there be a pruning rule (move old entries to a "history" subsection)?

3. **Should judges get the experiment state section?** Currently they read whiteboard + phase files. The experiment state is on the whiteboard, so they see it — but should they evaluate it differently than research findings?

4. **Untested.** These changes came from analyzing one session. The experiment weight hasn't been used yet. First real test will reveal whether the iteration-as-sub-phase model actually works or whether the director still ends up doing things directly.
