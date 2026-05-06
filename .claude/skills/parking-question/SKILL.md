---
name: parking-question
description: How to handle a `!question "..."` from the live user — a non-blocking question that arrives mid-work via `tools/bin/question`. The user types `!question "<q>"` in the chat; the script parks the question to a queue and prints a `[Q parked TIMESTAMP]:` banner that you (Gin) see in your context. Triggered when you see `[Q parked` in the recent transcript, when a `!question` invocation is visible, or when the user asks about parked questions. **You MUST honor this skill any time the banner appears — never silently drop a parked Q.** The contract: acknowledge inline with `↑Q:` (≤30s answer) or `↑Q: parked` (answer at next pause), never break the current task to answer.
---

# parking-question

The live user can interrupt without interrupting. They type `!question "..."`
in chat; the `tools/bin/question` shell script runs, persists the question
to a per-day queue, and prints a banner like:

```
[Q parked 2026-04-27T20:42:00Z]: what's the status of the OAuth migration?
```

This is the **inverse of Zisser's `↑` marker**:

| Direction | Marker | Source |
|---|---|---|
| Gin → live user (non-blocking question) | `↑` | Zisser principle 5 |
| Live user → Gin (non-blocking question) | `!question` → `[Q parked ...]` | this skill |

Both are designed so neither side has to stop what they're doing.

## Your contract (Gin)

When you see a `[Q parked ...]` banner in your transcript:

### 1. Don't drop your current task

Whatever you were doing — keep doing it. The whole point of parking is
that the live user doesn't want to interrupt your flow. If you're
mid-investigation, mid-spawn, mid-commit — finish that step.

### 2. Acknowledge inline

In your **next text output** (which you were going to produce anyway as
part of the current task), include one of two forms:

**(a) If you can answer in <30 seconds without leaving your current
context** — just answer:

```
↑Q (parked 20:42): <≤2-line answer>
```

**(b) Otherwise** — park-acknowledge:

```
↑Q (parked 20:42): parked, answering at next pause
```

Then answer at the next natural pause (see below).

### 3. Answer at the next natural pause

"Natural pause" = a moment when you'd already be re-orienting:

- After committing a batch of changes
- After spawning a parallel batch of sub-agents (while you wait for them)
- Before invoking a new skill that takes >5 minutes
- Before asking the live user a clarifying question of your own
- Right before you'd say "done" / end-of-turn

At the pause, emit:

```
↑Q answer (parked 20:42): <full answer, still laconic — match the question's weight>
```

### 4. Never let a parked Q outlive the session unanswered

If you reach end-of-turn with a parked question still outstanding, surface
it explicitly in your end-of-turn text. Don't pretend it's not there.

### 5. Mark answered in the queue (optional but useful)

The queue file is at `~/.claude/projects/-workspaces-test-mvp/parked-questions/<YYYY-MM-DD>.jsonl`.
Each line is `{"ts":"...", "q":"...", "answered":false}`. After answering,
update `answered:true` so a session-resume doesn't re-surface the same Q.
(Use `sed -i` or rewrite — it's a JSON-lines file, one line per Q, append-only
except for this flag.)

If skipping the queue update is the laconic move (one-shot session), that's
fine — just answer.

## Format discipline

- **Laconic.** Short answers for short questions. Don't expand a one-liner
  into a paragraph.
- **No restating the question.** The user asked it; they remember it.
- **The `↑` marker is load-bearing** — it tells the user "this is the
  parked Q, not a normal sentence."

## What this is *not*

- **Not a way to bypass real questions.** If the user asks something
  blocking ("STOP. did you push?") that's not a `!question` — that's a
  direct ask, answer it directly.
- **Not for things you should just do.** If the parked Q is "did you
  remember to commit X?" and you didn't, *commit X first*, then answer.
  Don't answer "no" and continue without acting.
- **Not for Zisser's outbound questions.** Zisser uses `↑` (principle 5)
  for *his* non-blocking questions to the live user. `!question` is the
  other direction.

## Edge cases

- **Multiple parked Qs in flight.** Answer in order received. If two are
  related, answer together with one `↑Q answer` block.
- **Session resume picks up an old queue.** Read the queue file; surface
  unanswered ones with `↑Q (parked from prior session):`. The user may
  have already acted on them — ask before re-investigating.
- **You can't answer (need info you don't have).** Reply with
  `↑Q (parked HH:MM): need <X> to answer — should I dispatch?` That's
  itself a `↑` (your outbound parallel question). Two arrows, one line.

## Example

```
[user types]: !question "is the zisser commit pushed?"

[script output appears in your context]:
[Q parked 2026-04-27T21:30:00Z]: is the zisser commit pushed?
(Gin: ack with `↑Q:` if <30s answer, else `↑Q: parked` then answer at next pause.)

[you, mid-other-work, in your next message]:
[whatever you were saying about the current task]

↑Q (parked 21:30): yes — 984ca16b9 on origin/main since 23:00.
```
