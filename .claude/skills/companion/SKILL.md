---
name: companion
description: Long-running observer sub-agent that watches your session and gives feedback. Resumed between check-ins for persistent context. Use for accountability, scope watching, or process adherence. Triggered by "use companion", "spawn companion", or when you want a second pair of eyes on your session.
---

# Companion

A long-running sub-agent that watches your session and gives you feedback.

You spawn it, give it a gold standard (what you *should* be doing), and check in with it periodically. It reads your session via session CLI, compares your behavior against the gold standard, and reports the delta.

## When to Use

- You're following a skill or workflow and want accountability
- You're doing complex multi-step work and want drift detection
- You want a second perspective without involving the human

## Spawning a Companion

Spawn via the Agent tool. Include in the prompt:

1. **Your session ID** (`$CLAUDE_SESSION_ID` — pass the value, not the variable)
2. **The gold standard** — what you should be held accountable to
3. **The companion instructions** — point to [agent.md](agent.md)

```
Use the instructions in `.claude/skills/companion/agent.md`.

Parent session ID: <your-session-id>

Gold standard:
- Following `.claude/skills/liaison/SKILL.md`
- Calibration: sequential execution, tiny steps, DoD before every delegation
- Agents commit and push their own work
- State DoD out loud before spawning a worker
```

Give the companion a name (e.g., `name: "companion"` or `name: "process-companion"`) so you can resume it later via `SendMessage`.

### Blocking vs non-blocking

Calibrate with the user at spawn time:

- **Blocking** — check-ins run in the foreground. You wait for the companion's response before continuing. Best when the feedback loop is tight and you want to act on feedback immediately.
- **Non-blocking** — companion runs in the background. You continue working and read its feedback when it arrives. Best for longer-running work where you don't want to pause.

Either way, the companion is spawned once and resumed via `SendMessage` for subsequent check-ins.

## Resuming

**Resume the companion** between check-ins via `SendMessage`. This is the core pattern — it gives the companion persistent context so it can track patterns across check-ins ("this is the third time you skipped verification").

```
SendMessage to: "companion"
"Check in. Review what I've done since your last check-in."
```

Don't spawn a fresh companion for each check-in. Resume the existing one. If context gets too large, then spawn fresh — but that's the exception, not the norm.

## When to Check In

Calibrate the cadence with the user at spawn time. Common patterns:

- **After every sub-agent completes** — thorough, catches drift early
- **At phase transitions** — balanced
- **Every N cycles or commits** — lightweight (e.g., every 2-3 TDD cycles)
- **When you feel uncertain** — on-demand

A hook can remind you to check in (e.g., after sub-agent completion). The companion doesn't control its own cadence.

## Multiple Companions

You can run multiple companions with different gold standards:

- A **process companion** watching workflow adherence
- A **scope companion** watching for scope drift
- A **quality companion** watching code standards

Each focuses on its own gold standard. Give them distinct names.

## What You Get Back

The companion reports: what you're doing well, where you're drifting, and what you missed entirely. Concise, actionable. See [agent.md](agent.md) for the full feedback structure.

Act on the feedback or don't — you have judgment too. But if the companion flags something repeatedly, pay attention.
