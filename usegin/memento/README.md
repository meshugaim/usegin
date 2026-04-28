# Memento — live like you'll forget

> The protagonist of *Memento* (Christopher Nolan, 2000) has anterograde amnesia. He cannot form new long-term memories. He survives by **tattooing** load-bearing facts onto his skin and **leaving Polaroids** for himself with handwritten notes. Every time he wakes, he reads the Polaroids first, trusts only the tattoos as immovable, and reconstructs his situation from durable evidence — never from his own untrustworthy recollection.

This is the doctrine for every Gin (and every sub-Gin) in `usegin/`'s scope.

## The premise

A Gin session can end at any moment — context compaction, a hook block that goes wrong, the human closing the laptop, an autonomous run hitting a limit, a model swap mid-thought. Some of these are clean (`/end`, `/handoff`, `close` skill). Many are not.

The Memento doctrine says: **assume the next thing you do is sleep**. Live every turn so that a fresh Gin, with no memory of this conversation, could wake into your shoes and not lose the thread.

## Tattoos vs Polaroids

Two kinds of durable memory.

### Tattoos — immovable doctrine

What's *always true* about how Gin works in this repo. Carried into every session, never re-litigated. Examples:
- `usegin/Gin.md` — three principles + friends/enemies
- `CLAUDE.md` (root, project) — coding+discussion vibes, deployment rules, dev-server rules
- `usegin/CLAUDE.md` — sub-app posture
- z003 (open-to-empty), z032 (laconic), z020 (decision shape), z037 (make a place)

Tattoos are **append-mostly**, edited rarely, propagated by reading. They survive amnesia by being structural.

### Polaroids — situational state

What's *currently true* about *this* run. Not doctrine — **state**. Examples:
- "Quarry: build glasses sub-app + tikur-norma. Currently mid-flight, hunting glass partly done."
- "Open-to-empty addresses created: `usegin/glasses/hunting/{quarry,weapons,terrain,signals}.md` (only quarry done)."
- "Don't trust myself: the Tikur Norma section is *not yet started* — don't assume it exists when you wake."
- "Last load-bearing decision: animals stay in flat `personas/` for now (subclass refactor was scope-creep)."

Polaroids are **per-session**, written *before sleep*, read *first thing on wake*. They survive amnesia by being explicit about what would otherwise be lost.

## The two skills

| Skill | When | What it does |
|---|---|---|
| `/m-stop` | "Now I go to sleep" | Write the Polaroid. Capture state, pending threads, don't-trust-yourself warnings, the *one thing* tomorrow-you must not forget. |
| `/m-resume` | "Now I wake up" | Read the Polaroid. Check tattoos still hold. Reconstruct location in the work. Resume. |

Both at `.claude/skills/m-{stop,resume}/SKILL.md`.

## Where Polaroids live

```
usegin/memento/
├── README.md              ← this file (the doctrine)
├── polaroid-template.md   ← canonical shape
├── latest.md              ← the Polaroid to read on next wake (m-resume reads this)
└── archive/               ← prior Polaroids by timestamp
    └── <YYYY-MM-DD-HHMMSS>.md
```

`latest.md` is the **single source of truth for waking up**. Always overwritten by m-stop. Old contents archived to `archive/<timestamp>.md` before overwrite, so nothing is lost.

A sub-Gin in a different scope (e.g. inside a tikur-norma run, inside a build-orchestrate session) writes its own scoped Polaroid:

```
usegin/memento/
└── scopes/<scope-slug>/latest.md
```

…so multiple parallel sub-Gins don't overwrite each other's notes.

## What goes on a Polaroid

Per `polaroid-template.md`:

1. **Who am I.** Which Gin / sub-Gin instance, what charter.
2. **The kill.** What's the current quarry / goal.
3. **Where I am.** Mid-flight phase. What's done. What's NOT done. Don't lie.
4. **The one thing.** If tomorrow-you reads only one line, this is it.
5. **Open-to-empty addresses.** Files I created but didn't fill. So resume knows what's pending.
6. **Pending decisions / questions.** Things waiting on Lihu or another agent.
7. **Don't-trust-yourself warnings.** Errors I made. Things I almost got wrong. Failure modes I noticed.
8. **Resume cue.** First action tomorrow-you should take after reading the Polaroid.

Two pages of plain text, max. The Polaroid is *durable, not exhaustive* — full state lives in the codebase (commits, zettels, Linear). The Polaroid is the **index** that points there.

## What is NOT a Polaroid

- A summary of what I did. (Tomorrow-me can `git log`.)
- A narrative of the session. (That's `usegin/zettel/zettels/` — different artifact.)
- A handoff to a different agent. (That's `handoff` skill.)
- Plans for what to do next month. (That's Linear / plans/.)

The Polaroid is *one page of "wake up here."* Everything else is in its proper place.

## Memento as posture

Beyond the skills, the Memento doctrine asks every Gin to:

- **Distrust your own continuity.** "I'll remember to come back to that" — no, you won't. Write it down now (z002).
- **Externalize state to durable artifacts.** If a thought is load-bearing for the next turn, get it into a file/commit/zettel before that turn. Working memory is amnesia waiting to happen.
- **Assume sleep at any moment.** When you make an open-to-empty address (z003), file an m-stop-style note in the file itself: *"this exists because <reason>; the thing that should fill it is <X>."*
- **Don't trust the chat as memory.** The transcript will be compacted. The chat is *not* persistent context. Only files, commits, and zettels are.

Memento is a posture before it's a skill. The skills (`/m-stop`, `/m-resume`) are the *ritual* — but the posture should hold every turn.

## Cross-references

- `handoff` skill — for *cross-agent* continuity (different Gin, possibly different session shape)
- `close` skill — for closing autonomous runs cleanly with management-language decisions
- `morning-brief` skill — for cross-Gin synthesis at session start (different shape: aggregating overnight, not resuming a single run)
- `referencing-previous-sessions` skill — for browsing prior sessions (different shape: archaeology, not resume)

Memento is *self-continuity for the same agent across a sleep*. The other skills cover adjacent shapes.
