---
name: m-stop
description: Memento — write the Polaroid before sleep. Use when ending a session/run, when an interrupt has landed, when about to context-compact, or when Lihu says "/m-stop". Captures: where you are, the one thing tomorrow-you must not forget, open-to-empty addresses created but not filled, pending decisions, don't-trust-yourself warnings, resume cue. Triggered by "/m-stop", "going to sleep", "Memento stop", or by your own judgment when you sense the session may end imminently.
---

# m-stop — write the Polaroid

> **Speaker convention:** "Lihu" in this file is the *primary* speaker; the
> actual live user may be Oria, Lihu, or Nitsan. Check the LIVE USER banner /
> userEmail / in-chat signals before binding to a name (root `CLAUDE.md`
> "Live user — who's in the chat" precedence rule).

You are about to **sleep**. A fresh Gin will wake into your shoes with no memory of this conversation. Write the Polaroid that lets them resume cleanly.

## The doctrine

Read `usegin/memento/README.md` first if you haven't. The premise: assume amnesia is one turn away. Live every turn so a fresh Gin could pick up.

## Steps

### 1. Decide the scope

**Default: scoped.** The shared `latest.md` raced across concurrent sessions during 2026-04-28; ~5 polaroids overwrote each other in 30 minutes. Scoped paths held cleanly. Doctrine updated: every session writes to its own scope unless it's the *true* main thread (e.g. Zisser's chief-of-staff session, or an explicitly-named-as-main run).

| Scope | Where the Polaroid lands |
|---|---|
| **Default — every session has a kill / project / session-name** | `usegin/memento/scopes/<slug>/latest.md` |
| True main thread (Zisser's chief-of-staff, or explicitly-named-main run) | `usegin/memento/latest.md` |

**Pick the slug:** the session's title-bar name slugified (e.g. session "[effi] [chore] [priority 1] drive" → `effi-drive-oauth` or `effi-priority-1-drive`). The slug should match what `m-resume` will be told on wake. If unsure: derive from the session's `kill` (one-line quarry), slugified.

If you genuinely have no slug-able context (rare), fall back to `latest.md` *and* note in the Polaroid's "Don't-trust-yourself warnings" that the next session may race you.

### 2. Archive the current Polaroid (if one exists)

```bash
TS=$(date -u +%Y-%m-%d-%H%M%S)
mkdir -p /workspaces/test-mvp/usegin/memento/archive
[ -f /workspaces/test-mvp/usegin/memento/latest.md ] && \
  cp /workspaces/test-mvp/usegin/memento/latest.md \
     /workspaces/test-mvp/usegin/memento/archive/${TS}.md
```

(Substitute the scoped path if applicable.)

### 3. Write the new Polaroid

Open `usegin/memento/polaroid-template.md` for the shape. Fill it for the current state. Land it at `usegin/memento/latest.md` (or scoped path).

**Sections you MUST fill, even briefly:**

- Who am I
- The kill (or: not-a-hunt, what we're doing)
- Where I am — Done / Not done / In flight (don't lie about "Done")
- THE ONE THING (one line — the most expensive-to-forget thing)
- Don't-trust-yourself warnings (failure modes you noticed mid-run)
- Resume cue (concrete first action on wake)

**Sections that may be empty:**

- Pending decisions (if none — write "(none)")

### 4. Discipline checks

Before saving, re-read the Polaroid against these:

- [ ] Two pages max?
- [ ] "Done" entries are *actually done* (not "mostly done")?
- [ ] "In flight" lists every file currently mid-edit?
- [ ] "Open-to-empty" lists every address you created but didn't fill?
- [ ] The one thing is **one** thing — single sentence, picked because most expensive to forget?
- [ ] Resume cue is concrete (file path, command, or named question)?
- [ ] Don't-trust-yourself isn't empty unless you genuinely had no warnings?

If any check fails: edit, then save.

### 5. Commit (optional but recommended)

If the session is closing cleanly and the Polaroid is durable signal:

```bash
git add usegin/memento/latest.md usegin/memento/archive/${TS}.md
git commit -m "memento(stop): polaroid — <one-line scope tag>" \
  -m "<paste THE ONE THING line here as commit body>"
```

If the session is mid-fight (interrupt, partial work uncommitted), DON'T auto-commit — the Polaroid notes the uncommitted state, m-resume reads it from the working tree.

### 6. Acknowledge

Tell the user: "Polaroid: `<path>`. The one thing: <quote>." Nothing else. Two lines.

## What this skill is NOT

- Not a session retro. (That's `session-retro`.)
- Not a handoff to a different agent. (That's `handoff`.)
- Not a clean close with management-language decisions. (That's `close`.)
- Not a zettel. (Zettel = atomic durable thought. Polaroid = situational state.)

m-stop is **self-continuity for the same Gin across a sleep**. Wakes a Gin into the same chair, not into a different agent's shoes.

## Common shape (paste-ready scaffold)

```markdown
# Polaroid — <DATE TIME> (main)

## Who am I
<role / archetype / glasses worn / persona instantiated>

## The kill
<one-sentence quarry>

## Where I am
- **Phase:** <…>
- **Done:**
  - <…>
- **Not done (open-to-empty):**
  - <path> — <what should fill it>
- **In flight:**
  - <…>

## THE ONE THING
> **<one line>**

## Pending decisions / questions
- ↑ <…>

## Don't-trust-yourself warnings
- <…>

## Resume cue
> **First action on wake:** <…>

## Tattoos still holding
- z003, z032, z002, z020 standard
- <session-specific tattoo>

## Pointers
- `git log --oneline -10`
- `usegin/memento/archive/<prior>`
- <Linear / zettel / spec links>
```

## Failure modes

- **Lying about Done.** Most common failure. If it's not committed *and* tested *and* observed, it's "in flight", not "done".
- **The one thing being three things.** Pick. Park the others under pending.
- **Vague resume cue.** "Continue the work" is not a cue. "Open `usegin/glasses/hunting/weapons.md` (open-to-empty) and start filling" is.
- **Forgetting tattoos.** A new tattoo (a session-specific durable rule Lihu just established) is the kind of thing that disappears on amnesia. Capture it explicitly under "Tattoos still holding".
