---
name: tikur
description: Run a post-mortem in the Israeli-Air-Force tarbut-ha-tikkur (תחקור) tradition — blameless, fact-first, systemic root cause, mandatory fix. Use when something went wrong in a way that could recur — bad commit, lost work, broken push, agent collision, wrong-target deploy, anything we want never to happen again. Triggered by "tikur this", "post-mortem", "let's tichkur", "what went wrong", "root-cause this".
---

# Tikur (תחקור)

Israeli-Air-Force-style post-mortem. Lifted because their culture is the operational state-of-the-art for *learning from mistakes without punishing people*. The point is to change the system, not the person.

## When to run

Any incident with a recurrence vector. If "this could happen again to someone (or you) tomorrow," tikur it.

Examples that warrant a tikur:
- A commit landed with the wrong scope (other people's work under your message).
- A push went to the wrong branch.
- An agent overwrote another agent's work.
- A hook fired in a way that surprised us.
- A test passed when it shouldn't have / a check missed something it was supposed to catch.
- A rollback was needed and wasn't trivial.

Examples that do **not** warrant a tikur (just fix and move on):
- A typo, found before commit.
- A failing test you wrote and immediately corrected.
- A first-time investigation of new territory that didn't yield.

## The five rules

1. **Blameless.** "Claude is not careful" is not a root cause — it is not actionable, and tomorrow's Claude will do the same thing for the same systemic reason. The system permitted the failure; the system gets fixed.
2. **Facts before interpretations.** Reconstruct the timeline before reasoning about it. Sources: git log/reflog, hook logs, transcripts, file mtimes, anything dated. Interpretations come *after* the timeline is written.
3. **Five whys, but stop at the first one that gives you a lever.** "Why?" until the answer points at something you can change in code, config, or process. Beyond that, you are philosophizing.
4. **Output ≥ root cause + fix + system change.** Every tikur produces three artifacts:
   - Root cause: one sentence, systemic.
   - Immediate fix: what we do *right now* to undo the damage.
   - System change: the procedural/code/config update that prevents recurrence — committed the same turn.
5. **Distill to a zettel.** The lesson lives in the zettelkasten, threaded into the graph (z040). Otherwise the next session re-learns it.

## Procedure

### 1. Stop digging

If the incident is still in motion (e.g., a bad push that hasn't propagated), pause first. Don't compound by improvising.

### 2. Write the timeline

Bulleted, timestamped where possible, present-tense. Each line is a fact you can point at evidence for. Keep it terse — the value is in completeness, not prose.

### 3. Five whys

Indent each "why" under the previous answer. Stop when the answer is a lever (a file you can edit, a setting you can change, a process you can introduce).

### 4. Pick the root cause

The deepest *leverable* answer in the chain. Phrase it as a systemic statement — "we lacked X" / "Y tool surface had property Z" — not "I forgot to."

### 5. Three fixes

- **Immediate:** what makes the user whole *now*. (revert, recommit, file the missing data, etc.)
- **System:** the change that prevents recurrence. Code, hook, doc, default. Land it the same turn.
- **Tripwire:** how we'd notice if recurrence happened anyway. Test, assertion, log line, manual check.

If "system" and "tripwire" feel skipped, the tikur isn't done.

### 6. Zettel and thread

Distill into a zettel via `dx zettel add`. Thread to neighbors per z040 (clusters emerge). Cite the immediate-fix commit and the system-change commit by SHA in the body.

### 7. Apply the immediate fix

Now — not later. (z002.) For destructive fixes (revert, force-push, dropping commits), confirm with Lihu first per CLAUDE.md.

## Format of a tikur record

Live at `.claude/tikur-records/YYYY-MM-DD-<slug>.md`. Append-only — never edit a record after it lands; if you learn more later, write a follow-up record threaded to the original.

```markdown
# Tikur: <one-line incident>

**Date:** YYYY-MM-DD
**Severity:** low | medium | high  (recurrence × blast-radius)
**Status:** open | fixed | system-fix-deferred

## Timeline
- HH:MM — fact
- HH:MM — fact
- ...

## Five whys
- Why X? — A
  - Why A? — B
    - Why B? — C  ← root cause (this is leverable)

## Root cause
One sentence, systemic.

## Fixes
- **Immediate:** what was done, commit SHA.
- **System:** what landed, commit SHA.
- **Tripwire:** how recurrence is detected.

## Zettel
zNNN — title
```

## Anti-patterns

- "Claude / I / oria forgot to X." — name a system that doesn't rely on remembering.
- "We'll be more careful next time." — not a fix.
- "Discussed in chat, will write up later." — z002 violation, not a tikur.
- A tikur with only an immediate fix and no system change. — half-done.
- Skipping the timeline because "I remember what happened." — interpretations contaminate evidence.

## Ranks

There are none in a tikur. Lihu, UseGin, sub-agents, the autosync hook — all equal participants when the incident is being reconstructed. The thing under examination is the system, and everyone in it (humans included) provides evidence and proposes fixes. Disagree freely. Defer to facts, not roles.
