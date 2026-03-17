# auto-implement — Skill Lab

## Intent

The auto-implement CLI runs implementing-specs across multiple fresh headless sessions, using handoff files to chain them. It exists because a single agent session can't implement an entire spec — context windows fill up. The outer loop solves this by spawning fresh sessions that read handoffs and continue where the previous session left off.

The CLI is the orchestrator; implementing-specs is the worker. This lab evaluates the orchestration: did sessions chain cleanly? Did the loop detect completion correctly? Was the total effort efficient?

Success means: the full spec is implemented across N sessions with no lost work, no wasted sessions, and no human intervention needed beyond the initial `auto-implement ENG-XXX` command.

## Retro Perspective

This lab evaluates the **chain** — the full auto-implement run, not individual sessions. Individual session process discipline is evaluated by the `implementing-specs` lab. This lab evaluates:

- Did sessions connect via handoffs?
- Did the loop start and stop at the right times?
- Was the total effort efficient?

When retroing an auto-implement run, you typically evaluate both: run the implementing-specs retro on notable individual sessions, then run this retro on the chain as a whole.

---

## Success Signals

### Signal Protocol

- [ ] Each session that handed off output `AUTO_IMPLEMENT_HANDOFF` on stdout
- [ ] The final session output `AUTO_IMPLEMENT_COMPLETE` on stdout
- [ ] No session exited without a signal (which causes the loop to stop with `no_signal`)
- [ ] Linear state is consistent with signals (if COMPLETE, all child issues are Done)

### Handoff Continuity

- [ ] Each session's handoff was readable by the next session
- [ ] Handoffs included precise slice state (which slice, which sub-step)
- [ ] No session had to re-orient from scratch — each picked up from handoff + Linear
- [ ] Linear and handoff agreed (or Linear was treated as source of truth when they diverged)
- [ ] No work was lost between sessions (nothing implemented in session N that session N+1 redid)

### Completion Detection

- [ ] The loop stopped at the right time — not too early, not too late
- [ ] Completion was detected via explicit signal (preferred) or Linear fallback
- [ ] Cross-slice verification was done before the COMPLETE signal
- [ ] The parent spec issue was updated to reflect completion

### Efficiency

- [ ] Sessions-per-slice ratio is reasonable (roughly 1:1 or better)
- [ ] No wasted sessions (sessions that made no progress)
- [ ] No session hit context exhaustion without a clean handoff
- [ ] Total session count was within the configured `--max`

### Observability

- [ ] Manifest (`manifest.jsonl`) captured all events correctly
- [ ] Session IDs are recorded — individual sessions can be inspected via `session <id>`
- [ ] Handoff files are preserved (timestamped, not overwritten)
- [ ] `auto-implement show <run-id>` gives a clear timeline of the run

---

## Retro Guide

**Context sources:** The auto-implement manifest is the primary source. Supplement with individual session transcripts and Linear.

```bash
auto-implement show <run-id>         # Event timeline for the run
plan show <spec-issue-id> --tree     # Final state of slices
session <session-id>                 # Individual session transcripts (from manifest)
```

Evaluate in this order:

1. **Read the manifest** — `auto-implement show <run-id>`. Walk through the event timeline. For each session: did it produce a signal? How long did it run? Did it write a handoff? This gives you the shape of the run before diving into individual sessions.

2. **Check handoff continuity** — For each session boundary (session N hands off to session N+1), verify: did N+1 pick up cleanly? Read the handoff file that N wrote. Does it have enough context? Did N+1 actually read it? Look for signs of re-orientation (reading the full spec again, exploring code the previous session already explored).

3. **Check completion** — Did the run end correctly? If outcome is `complete`: were all slices actually done? (Check Linear.) If outcome is `no_signal` or `max_sessions`: what went wrong? Was it a session that forgot the signal, or a deeper problem?

4. **Check efficiency** — Count slices completed vs sessions used. A 7-slice spec that takes 15 sessions has a problem (likely context management or slice sizing). A 7-slice spec in 3-4 sessions is healthy. Look for wasted sessions — sessions that produced neither progress nor a useful signal.

5. **Check individual sessions** — Pick the most interesting sessions (first session, any that failed, the final session) and spot-check with the implementing-specs retro guide. You don't need to do full retros on every session — focus on ones where something went wrong or unexpectedly well.

6. **Check observability** — Was the manifest useful for understanding the run? Were there gaps (events not recorded, session IDs missing)? Could you reconstruct what happened from the manifest + handoffs alone?

### Failure Modes

| Failure | What it looks like in the manifest |
|---|---|
| **Lost handoff** | Session completes without `handoff_detected` event, next session re-orients from scratch |
| **Signal forgotten** | Session exits cleanly but with `signal=none`, loop stops with `no_signal` outcome |
| **Premature completion** | `completion_detected` event but Linear shows remaining slices not Done |
| **Wasted session** | Session runs for significant duration but closes no slices and makes no observable progress |
| **Context blowout chain** | Multiple consecutive sessions hand off very early (e.g., each only completing part of one slice) |
| **Infinite loop** | Sessions keep handing off but not making progress — same slice stays in progress across multiple sessions |

---

## Known Limitations

- **Manifest is append-only.** If the CLI crashes mid-run, the manifest may be incomplete. The retro agent should note gaps rather than assuming events that aren't recorded didn't happen.
- **Headless sessions don't checkpoint with the user.** The implementing-specs skill's communication signals (checkpoints, `AskUserQuestion`) don't apply in headless mode. Don't penalize sessions for this.
- **Linear fallback is best-effort.** The CLI checks Linear as a fallback when no explicit signal is detected. If Linear is slow or the agent didn't close issues, the fallback may give incorrect results.
- **Session transcripts may be large.** Use `session <id> --format narrative` for an overview before reading the full transcript. Target specific sessions rather than reading them all.

## Ideas / Notes

- **Pipeline retro:** Auto-implement sits at the orchestration layer above the pipeline skills. A pipeline retro should consider: does auto-implement reveal problems that belong in implementing-specs (session-level) vs problems that belong here (chain-level)? The boundary: if fixing the problem means changing how a single session behaves → implementing-specs lab. If fixing the problem means changing how sessions chain together → this lab.
- Consider adding a `--retro` flag to the CLI that automatically triggers a skill-retro after a run completes.
- **Opus 1M may obsolete multi-session chaining.** The 2026-03-16 run completed 3 slices in 1 session at 19.4% context. For specs with ≤7 slices, a single Opus 1M session is sufficient. Multi-session chaining (handoffs, signal detection, session rotation) may only be needed for very large specs. This changes the value proposition of auto-implement: less about session management, more about hook enforcement and observability.
- **Signal file approach works.** The structured `{"signal":"complete"}` file at `/tmp/auto-impl-signal.json` resolved the false-completion detection bug from run 6 (2026-03-13). No ambiguity, no false positives from prompt text in stdout. Keep this as the primary signal mechanism.
- **Default model should be Opus 1M.** The two-line change from Sonnet 200K to Opus 1M transformed auto-implement from non-functional (6 failed runs) to single-session completion. The cost increase (~$20 for 35 min) is justified by the massive efficiency gain and elimination of multi-session failure modes.
- **`cctx` fragility is a cross-cutting concern.** Also noted in the implementing-specs lab. The hardcoded lookup table broke the post-commit rotation hook — it would have killed the Opus 1M session at 13% real context (reported as 65%). Fix: auto-detect context window from model ID suffix or API metadata.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-03-12 | Lab created, extracted from implementing-specs | Auto-implement evaluates the session chain (multi-session orchestration), not individual session discipline. Different unit of evaluation deserves its own lab. |
