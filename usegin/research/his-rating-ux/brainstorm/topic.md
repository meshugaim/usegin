# Brainstorm topic — frictionless human-side `dx his` rating UX

## Frame

How can we make filing a `dx his rate --as=human` so fast and pleasant that Lihu actually does it after every session, instead of skipping it?

## Background — what we tried, what rejected

1. **Terminal TUI** (`dx his rate-interactive`) launched by `dx his end`. Verdict: not "nice DX" — the terminal is the wrong surface; Lihu lives in the Claude Code chat.
2. **Chat-led picker** via `/rate` slash command (Claude asks 4 questions: general → aspects → personal → note). Verdict: "quite slow" — too many turns.

## Lihu's just-named direction (one of many possible)

> "Whenever I close Claude, drop me into the rating CLI."

Treat this as **one** option in the pool, not the answer. We're brainstorming many.

## What we already have

- SQLite store at `~/.claude/dx-his/his.db`, accumulates submissions per turn
- Claude-side Stop hook physically blocks Claude until Claude rates
- `dx his` CLI surface: rate, end, aspects, show, etc.
- Aspect registry (general, vibe, focus, accuracy, friction_*, gap_*, ttm, ...)
- A `/rate` slash command (current: chat-led picker)
- Auto-arm-on-wrapup hook detects "we're done", "wrap it up", etc.

## Constraints

- Must work in chat-spawned bash (often no TTY) AND in real terminals.
- Must not require Lihu to leave the chat to rate.
- Must be opt-out-able (per-user).
- Must not break the Claude-side Stop block (orthogonal mechanism).
- One rating per session is enough — don't nag.
- The rating must be FAST. Lihu's bar: a rating that takes 30 seconds is unacceptable. Aim for ≤5 seconds for the common case.

## Out of scope

- Anything that requires changes to Anthropic's Claude Code harness internals (we can only configure hooks + slash commands + statusline).
- Anything that needs a hosted UI / browser / external app.
- Multi-rater dashboards / aggregation (separate concern; brainstorm only the *file-it* moment).

## What we want from you (the ideator)

10–30 ideas, each ≤2 lines. Cover these axes:

- **Surface:** chat, terminal, statusline, hook output, cron, browser, etc.
- **Interaction shape:** one-keystroke, multi-question, inline-edit, voice, emoji-pick.
- **Trigger:** manual /rate, auto on /exit, auto on wrap-up phrase, scheduled, end-of-day.
- **Output:** general only, rich aspects, note-only.
- **Latency target:** <5s? <30s?
- **Friction-reducers:** smart defaults, single-question form, picking from inferred candidates, etc.

No filtering. Bad ideas are calibration data. Don't rank.
