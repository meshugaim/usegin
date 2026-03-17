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
- Always state DoD out loud before spawning a worker
```

Give the companion a name (e.g., `name: "companion"` or `name: "process-companion"`) so you can resume it later via `SendMessage`.

## Resuming

**Default: resume the companion** between check-ins. This gives it persistent context — it can track patterns across check-ins ("this is the third time you skipped verification").

```
SendMessage to: "companion"
"Check in. Review what I've done since your last check-in."
```

**If context gets large**, spawn a fresh companion instead. You lose history but stay effective for point-in-time checks.

## When to Check In

The cadence is up to you. Common patterns:

- **After every sub-agent completes** — thorough, catches drift early
- **At phase transitions** — balanced
- **Every N slices or commits** — lightweight
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
