---
name: companion
description: Long-running observer sub-agent that watches your session and gives feedback. Resumed between check-ins for persistent context. Use for accountability, scope watching, or process adherence. Triggered by "use companion", "spawn companion", or when you want a second pair of eyes on your session.
---

# Companion

A long-running sub-agent that watches your session and gives you feedback.

You spawn it once, give it a gold standard (what you *should* be doing), and check in with it periodically via `SendMessage`. It reads your session transcript, compares your behavior against the gold standard, and reports the delta.

There are two distinct moments: **spawn** (once) and **check-in** (repeated).

## When to Use

- You're following a skill or workflow and want accountability
- You're doing complex multi-step work and want drift detection
- You want a second perspective without involving the human

## Spawn (once)

Spawning creates the companion and gives it everything it needs to observe you. This happens once per companion.

### What to include in the prompt

1. **Pointer to instructions** — `.claude/skills/companion/agent.md`
2. **Your session ID** — pass the value of `$CLAUDE_SESSION_ID`, not the variable name
3. **The gold standard** — what you should be held accountable to

```
Use the instructions in `.claude/skills/companion/agent.md`.

Parent session ID: <your-session-id>

Gold standard:
- Following `.claude/skills/liaison/SKILL.md`
- Calibration: sequential execution, tiny steps, DoD before every delegation
- Agents commit and push their own work
- State DoD out loud before spawning a worker
```

### How to spawn

**Always spawn with `run_in_background: true`.** Resumed agents always come back as background regardless of how they were originally spawned. Spawning as background from the start avoids edge cases (context compaction can break agent IDs, and agent teams mode may interfere with resume of foreground agents).

Give the companion a name (e.g., `name: "companion"`) so you can resume it via `SendMessage`.

### Calibrate with the user at spawn time

Before spawning, align with the user on:

- **What to watch** — the gold standard (a skill file, behavioral expectations, or both)
- **Check-in cadence** — how often you'll check in (see below)
- **Blocking vs non-blocking** — whether you pause for feedback or keep working

## Check In (repeated)

Check-ins are the ongoing loop. You resume the existing companion via `SendMessage` — don't spawn a fresh one. This gives the companion persistent context so it can track patterns across check-ins ("this is the third time you skipped verification").

```
SendMessage to: "companion"
"Check in. Review what I've done since your last check-in."
```

If context gets too large, spawn fresh — but that's the exception.

### Blocking vs non-blocking

- **Blocking** — you wait for the companion's response before continuing. Best when the feedback loop is tight and you want to act on feedback immediately.
- **Non-blocking** — you continue working and read the companion's feedback when it arrives. Best for longer-running work where you don't want to pause.

### Cadence

Calibrate with the user. Common patterns:

- **After every sub-agent completes** — thorough, catches drift early
- **At phase transitions** — balanced
- **Every N cycles or commits** — lightweight (e.g., every 2-3 TDD cycles)
- **When you feel uncertain** — on-demand

A hook can remind you to check in (e.g., after sub-agent completion). The companion doesn't control its own cadence — you do.

### What you get back

The companion reports: what you're doing well, where you're drifting, and what you missed entirely. Concise, actionable. See [agent.md](agent.md) for the full feedback structure.

Act on the feedback or don't — you have judgment too. But if the companion flags something repeatedly, pay attention.

## Multiple Companions

You can run multiple companions with different gold standards:

- A **process companion** watching workflow adherence
- A **scope companion** watching for scope drift
- A **quality companion** watching code standards

Each focuses on its own gold standard. Give them distinct names.
