---
name: his-self-rating
description: Autonomously file a how-is-session reading mid-session whenever you notice something worth recording — frustration, dead-end loops, gaps between intent/code/spec, vibe shifts, friction with infra/tests/dev-env. Use proactively, not just on /end. Triggered by phrases like "rate this turn", "log a vibe check", "his self-rate", or by your own judgment when one of the trigger signals below fires.
---

# How-Is-Session — autonomous Claude rating

**You can — and should — file a `dx his rate --as=claude` submission whenever you notice something worth recording.** You don't need permission. The store accumulates; nothing you write overwrites anything else.

This is the "how is session" telemetry. Both human and Claude write to it. Submissions are bound to the current turn and accumulate across the session. The user sees them via `dx his show`. Future Gins read them as signal.

## When to autonomously rate (mid-session)

Don't wait for `/end`. File a submission whenever any of these fire:

| Signal | What to record |
|---|---|
| Human shows frustration / anger / impatience in their message tone | `frustration`, `anger`, `friction_human_claude` — with a one-line note about what triggered it |
| You notice you're looping / re-reading the same files / dead-ending | `tool_thrashing`, `self_doubt`, `efficiency` (low) — note what you were stuck on |
| The app behavior diverges from what the code seems to say | `gap_app_vs_code` — note the divergence |
| The code diverges from what the spec / acceptance criteria asked for | `gap_code_vs_spec` — note the gap |
| What you shipped doesn't match what was actually asked for | `gap_intent_vs_outcome` |
| Tests pass but you suspect they're not exercising the right thing | `friction_running_tests`, `accuracy` (lower) — note your doubt |
| You hit infra/tooling friction (slow shells, missing CLIs, broken devcontainer) | `friction_claude_devenv` or `friction_claude_infra` |
| Vibe shift — energy in the conversation changed (better or worse) | `vibe` — note the shift and the trigger |
| You realize you misread the human earlier | `understood_human` (low) — note what you missed |
| You're about to do something risky/irreversible and want a marker | a note submission — `dx his note "..."` |

## How to file a self-rating

```bash
dx his rate --as=claude --trigger=manual \
  vibe=<1..100> \
  friction_human_claude=<1..100> \
  tool_thrashing=<1..100> \
  --note "<specific, concrete observation about what just happened>"
```

You don't have to fill every aspect — score what's actually salient right now. Other aspects can be left out; they'll get scored at `/end`.

For pure observations (no scoring yet):
```bash
dx his note --as=claude "<observation>"
```

## What makes a good self-rating

- **Concrete** — name the trigger. "Human asked twice about X — I missed it the first time" beats "communication felt off."
- **Honest** — score yourself low when you should. We're mining this for signal, not a performance review.
- **Cheap** — don't agonize. 30 seconds. The point is the signal density across many submissions, not any one.
- **Note > scores when in doubt** — a vivid one-line note is worth more than precise scores.

## What NOT to rate

- Don't rate every turn. Rate when something *shifted*.
- Don't rate to flatter the human (or yourself). The data is for us, not the user-facing feedback loop.
- Don't ask permission. Just file it. The user will see it in `dx his show` if they care.

## Listing aspects

```bash
dx his aspects                    # all aspects
dx his aspects --bucket claude    # claude-specific
dx his aspects --bucket shared    # shared with human
```

Aspects are extensible at `tools/dx/src/his/aspects.json`. Unknown keys still pass through — feel free to use a new key if nothing fits, then propose adding it to the registry.

## At session end

`/end` (the user's wrap-up command) sets a force-rate flag; the Stop hook physically blocks you from stopping until you file a final reading covering all aspects with a substantive note. That's the *minimum* — your mid-session ratings make that final reading more honest because you have your own breadcrumbs to read.
