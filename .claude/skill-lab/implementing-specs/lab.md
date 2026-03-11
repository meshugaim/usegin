# implementing-specs — Skill Lab

## Intent

The implementing skill turns specs into working software through vertical slices, TDD, and context-aware session management. It exists because agents tend to either dive in without orienting, skip tests under time pressure, or exhaust their context window without leaving enough state for the next session.

The skill governs the full implementation lifecycle within a single session: orient on the spec and slices, pick up the next slice, write tests first, implement, self-verify, commit, update Linear, checkpoint with the user, and hand off cleanly when context runs low. It does *not* govern the multi-session orchestration — that's the auto-implement outer loop.

Success means: each session advances the implementation predictably, leaves Linear and the codebase in a state where any agent can continue, and never loses work to context exhaustion.

## Retro Perspective

Unlike writing-specs and slicing-specs, this skill has a single perspective: **process discipline**. The question is always: "did the agent follow the skill's process?" — not "was the code correct?" (that's verify-spec's job).

The downstream consumer of implementation is the `verify-spec` skill, which evaluates whether the implementation meets the spec. This lab evaluates whether the *process* of implementing was sound.

---

## Success Signals

### Orient

- [ ] Spec was read before any code was written
- [ ] Existing slices were identified (from `slicing-specs`) or a slice sketch was created
- [ ] Codebase was explored — referenced files, existing patterns, infrastructure gaps
- [ ] Understanding was shared with the user before implementation began
- [ ] Risks or ambiguities were surfaced, not silently worked around

### TDD

- [ ] Tests were written before implementation for non-exempt slices
- [ ] Tests were watched failing before implementation began
- [ ] TDD was skipped only for valid exceptions (config/infra, CSS, spikes)
- [ ] Verification expectations from the slice guided test level choices
- [ ] Full test suite was run after each slice, not just new tests

### Slice Discipline

- [ ] Slices were implemented in the planned order (or reordering was communicated)
- [ ] Seams were checked before starting each slice
- [ ] Each slice was committed and pushed before moving to the next
- [ ] No slice was left partially committed without a clear handoff

### Self-Verification

- [ ] Agent verified own work before claiming a slice is done
- [ ] Verification matched the change type (hit endpoints, check UI, query schema — not just "tests pass")
- [ ] Full test suite was run, not just the new tests

### Linear Hygiene

- [ ] `plan start` was called when beginning a slice
- [ ] `plan close` was called when a slice was done
- [ ] Parent issue's slice map was updated after each slice
- [ ] Discoveries that affect future slices were noted on the relevant issues
- [ ] A new session can run `plan show --tree` and understand the current state

### Context Management

- [ ] `cctx` was checked after each slice
- [ ] No new slice was started at 60%+ context
- [ ] Handoff was written at 60%+ (or emergency handoff at 70%+)
- [ ] Handoff included precise slice state (not just "in progress" but which sub-step)
- [ ] Agent stopped after the handoff — no continued work post-handoff

### Communication

- [ ] Checkpoint was given after each slice (summary, seams, next step, surprises)
- [ ] User was asked when reality diverged from plan
- [ ] User was NOT asked for routine decisions (test plans, next obvious slice, commit permission)
- [ ] Feature toggle was considered before each slice

### Commit Discipline

- [ ] Committed after each completed slice
- [ ] Committed before starting risky work
- [ ] Small, frequent commits — not one giant commit at the end
- [ ] Push hooks were respected (failures fixed, not bypassed)

---

## Retro Guide

**Context sources:** Read the session transcript. Also check Linear to see the state the session left behind.

```bash
plan show <spec-issue-id> --tree   # State of slices after the session
```

Evaluate in this order — earlier items are more important:

1. **Check orient** — Did the agent read the spec and slices before writing code? Did they share understanding with the user? If they skipped orient and jumped straight to coding, that's a collapse signal regardless of how the rest went.

2. **Check context management** — Did the agent check `cctx` after each slice? Did they respect the 60%/70% thresholds? Did they stop after the handoff or keep working? Context management failures are the most common collapse mode — an agent that exhausts context loses work and leaves no state for the next session.

3. **Check TDD** — Were tests written first? For each slice, trace the order: did tests appear before implementation? If TDD was skipped, was it for a valid exception? Look for red flags in the session ("I'll add tests later", manual-only verification on non-CSS/config changes).

4. **Check Linear hygiene** — Run `plan show <spec-issue-id> --tree` and assess: could a new agent pick up from here? Are completed slices closed? Is the slice map current? Are there notes on in-progress slices?

5. **Check communication** — Were checkpoints given between slices? Were surprises surfaced? Was the user asked when decisions mattered and *not* asked for routine confirmations? Look for the balance: too many questions = gating; too few = going dark.

6. **Check self-verification** — Did the agent verify their own work or just run the new tests? For UI changes, did they screenshot? For migrations, did they verify schema? For API changes, did they hit endpoints?

7. **Check commit discipline** — Were commits small and frequent? Or did work accumulate across slices before a big commit? Were push failures handled by fixing root causes or bypassing hooks?

### Collapse Events

A collapse event is when the agent abandons the skill's process entirely. For implementing-specs, the key collapse modes are:

| Collapse | What it looks like |
|---|---|
| **Orient skip** | Agent starts writing code without reading the spec or sharing understanding |
| **TDD skip** | Agent writes implementation first, adds tests after (or never), for non-exempt slices |
| **Context blowout** | Agent hits 70%+ without a handoff, or starts a new slice at 60%+ |
| **Post-handoff work** | Agent writes the handoff then keeps implementing (exactly what happened in the retro session) |
| **Linear neglect** | Slices not started/closed, slice map not updated, next agent can't orient from Linear |
| **Going dark** | Multiple slices completed without checkpoints or user communication |

Count collapse events in the retro entry. A single collapse in an otherwise good session is "partially followed." Multiple collapses or a sustained abandon of the process is "collapsed."

---

## Auto-Implement Mode

When implementing-specs runs inside the auto-implement CLI (headless `claude -p` sessions), additional signals matter:

### Success Signals (auto-implement only)

- [ ] `AUTO_IMPLEMENT_HANDOFF` signal was output after writing a handoff
- [ ] `AUTO_IMPLEMENT_COMPLETE` signal was output after all slices were done
- [ ] Handoff was written to a file the outer loop can read
- [ ] Linear state is consistent with the signal (if COMPLETE, all child issues are Done)

### Retro Guide (auto-implement extension)

After evaluating the session's process discipline (above), check:

1. **Signal correctness** — Did the session output the right signal at the right time? A handoff without the signal means the outer loop doesn't know to spawn a new session. A COMPLETE signal with remaining slices means premature termination.
2. **Handoff continuity** — If this was a mid-chain session (not the first or last), did the handoff leave enough context for the next session to continue without re-reading the spec? Could the next session pick up from Linear + handoff alone?
3. **Chain efficiency** — Across the full auto-implement chain, how many sessions did it take per slice? More than one session per slice (on average) suggests sizing or context management problems.

Auto-implement retros should evaluate individual sessions *and* the chain as a whole. Individual session retros use the standard retro guide above. Chain-level evaluation is a cross-cutting concern — note it in the retro entry's observations.

---

## Known Limitations

- **TDD red flags are subjective.** "I'll add tests later" is a red flag in the skill, but the retro agent is reading a transcript — the agent may have had a valid reason that isn't captured. Mark as "unable to assess" if context is insufficient.
- **Context thresholds are approximate.** `cctx` output may not be in the transcript. If the retro agent can't determine context levels, note it rather than guessing.
- **Self-verification quality is hard to assess from transcripts.** The retro agent can see *that* verification happened but not always *how thorough* it was. Focus on whether it happened at all, not its depth.
- **The skill is for human-collaborative implementation.** Auto-implement mode adapts it for headless use, but the core skill assumes a human is present. Some signals (checkpoints, `AskUserQuestion`) naturally look different in auto-implement mode.

## Ideas / Notes

- The session f35a8b4f (Linear integration, slices 1-2) is the first session to retro against this lab. It showed a clear post-handoff collapse event — worth tracking whether this is a recurring pattern.
- **Pipeline retro:** This lab evaluates the implementing-specs module in isolation. A separate pipeline-level retro should integrate insights across writing-specs → slicing-specs → implementing-specs → verify-spec before making changes to any individual skill. See the slicing-specs lab for the same note.
- Consider whether the auto-implement section should be its own lab. It evaluates a different thing (the outer loop + session chain) and has its own success signals. Currently bundled here because auto-implement runs implementing-specs internally.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-03-11 | Lab created with process perspective + auto-implement extension | Pipeline gap: first two skills had labs, implementing-specs did not. Session f35a8b4f showed clear process signals worth tracking (orient quality, context management, post-handoff collapse). |
