---
name: m-resume
description: Memento — wake up. Read the Polaroid, check tattoos, reconstruct location in the work, take the resume-cue action. Use when a Gin wakes into a fresh session/context after an m-stop, when Lihu says "/m-resume", "wake up", or "Memento resume". Trust the Polaroid; verify against the working tree before acting.
---

# m-resume — read the Polaroid, wake up

You are waking up. You may have **no memory** of the prior session beyond what's in durable artifacts (files, commits, zettels). The Polaroid is your map.

## The doctrine

Read `usegin/memento/README.md` if you haven't. The premise: don't trust your own continuity — trust what was written down.

## Steps

### 1. Locate the Polaroid

| Scope | Path |
|---|---|
| Default | `usegin/memento/latest.md` |
| Named scope | `usegin/memento/scopes/<slug>/latest.md` |

If a scope was named in the wake instruction ("m-resume tikur-norma"), use that. Otherwise default.

```bash
ls -la /workspaces/test-mvp/usegin/memento/latest.md
```

If the Polaroid is missing or older than ~24h: warn the user before acting. ("No recent Polaroid — last sleep was <date>. Resume blind, or write a fresh one?")

### 2. Read the Polaroid

Use the Read tool on the latest.md path. Read it whole — don't skim.

### 3. Check tattoos still hold

The Polaroid lists "Tattoos still holding" — load-bearing doctrine that should not have changed across the sleep. Verify briefly:

- `usegin/Gin.md` — three principles + friends/enemies still as expected
- `CLAUDE.md` (root) — the rules section hasn't shifted
- Any session-specific tattoo named in the Polaroid still applies (check the file mentioned)

If a tattoo has shifted: **stop and tell the user before resuming**. ("Tattoo drift: <X> in the Polaroid says <Y>; current state of <file> says <Z>. Reconcile?")

### 4. Verify "Done" claims against the working tree

The Polaroid lists what was Done. Spot-check 1-3 of them against `git log` / `git status` / file existence:

```bash
git log --oneline -10
git status
```

If a "Done" claim doesn't match reality: **don't lie to yourself**. Note it ("Polaroid says X is committed but `git log` doesn't show it") and correct course before taking the resume cue.

### 5. Verify "In flight" against the working tree

The Polaroid lists files mid-edit when sleep happened. Check `git status` — they should appear in the modified/untracked list. If they don't, something else happened (maybe the user committed in your absence, maybe a worktree got cleaned). Investigate before assuming the Polaroid is current.

### 6. Take the resume cue

The Polaroid's "Resume cue" is a single concrete first action. Take it.

If the cue is "open file X and continue filling" — open it, read it, continue.
If the cue is "ask Lihu about pending decision Y" — ask.
If the cue is "run command Z and check output" — run.

### 7. Acknowledge briefly

Tell the user: "Awake. The kill: <quote from Polaroid>. Resume cue: <quote>. Proceeding." 

Then take the cue. Don't re-summarize the whole Polaroid — Lihu wrote it (or the prior-you wrote it for him), he doesn't need it read back.

## What this skill is NOT

- Not a morning brief. (`morning-brief` skill — different shape: cross-Gin overnight synthesis.)
- Not session archaeology. (`referencing-previous-sessions` — different shape: browsing prior runs.)
- Not a handoff pickup. (`handoff --continue` — different shape: continuity *across* agents.)

m-resume is **the same Gin waking into the same chair**. Continuity within one persona, across a sleep.

## When to write a new Polaroid immediately after waking

If, on resume, you discover the Polaroid is stale, the work has moved, or the session shape has changed — *write a fresh Polaroid before doing more work*. Better one extra m-stop than waking the next Gin into a wrong context.

## Failure modes

- **Trusting the Polaroid blindly.** It's the index, not the truth — verify against the working tree.
- **Resuming without reading "Don't-trust-yourself" warnings.** Those are land mines the prior-you flagged. Read them, internalize, *then* act.
- **Re-summarizing the Polaroid back to Lihu.** Pointless — he saw it written. Acknowledge briefly and act.
- **Skipping tattoo check.** A tattoo drift across the sleep is the most expensive thing to miss; check.
