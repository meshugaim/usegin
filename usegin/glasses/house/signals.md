# Signals — house glass

The signals an agent emits when wearing the house glasses. Short, located, in-vocabulary.

## Signal shape

```
<archetype/agent> @ <room or location> — <signal-word>: <description>
  <optional: bigger-than-tending? escalate to: <archetype>>
```

## Signal vocabulary

### State signals (what the room is)

- **warm** — hearth healthy
- **tidy** — room in order
- **cluttered** — accumulating mess, still livable
- **chaos** — visibly disorganized
- **stocked / low / empty** — pantry states
- **organized / messy / locked** — drawer states
- **lush / weedy / overgrown** — garden states
- **dry / damp / flooded** — basement states
- **solid / cracking / fallen** — wall and foundation states
- **clear / smudged / boarded** — window states
- **working / sticky / locked** — door states
- **mowed / overgrown / weeds** — yard states
- **empty / piling / overflowing** — mailbox states

### Tending signals (what the agent did)

- **dished** — merged a stale-but-ready PR
- **weeded** — pulled a stale doc claim / fixed a broken ref
- **restocked** — updated a dep
- **wiped** — cleaned counter / removed dead config / cleared cache
- **swept** — passed through a room and noted state without changing
- **straightened** — small reorder of an organized-but-loose area

### Drift signals (what the agent saw)

- **dust** — small accumulated wrongness, low-priority
- **cobweb** — forgotten code, possibly dead (handoff to hyena to confirm)
- **mold** — rot, security drift, dependency rot — *escalate*, do not silently absorb
- **leak** — failing test / broken pipe — *escalate to Tikur*
- **fire** — actively spreading damage — escalate immediately
- **haunted** — code preserved with no remembered reason (handoff to Sage / Elephant)

### Escalation signals

When the chore turns out to be bigger than tending:

- **renovation** — this is structural, not cleanable. Hand off to Builder.
- **incident** — this is an active failure. Hand off to Tikur.
- **direction** — this is a question of whether we should live this way at all. Hand off to Cal / Philosopher.
- **wild** — this is a noise pattern that deserves the wild glass. Hand off to Father-Suricate.

## Aggregation: the walk

A house walk emits one signal per room (state) plus a tending pass (actions taken) plus an escalation list. See `rooms.md` for the canonical walk format. Walk records land in `walks/<YYYY-MM-DD>.md`.

## Signals are not findings

A signal is what the agent sees while wearing the glass. A finding is what the human / Mother / Mevaker decides the signal *means*. The house glasses produce *state and action notes*, not engineering verdicts. Translation to action items is downstream.

## Cross-glass handoffs

When a house-glass signal is actually a wild-glass or hunting-glass concern, hand off — don't try to handle it inside house mode.

| House signal | Hand off to |
|---|---|
| **mold** in the auth wall | Wild glass — looks like a snake (silent vulnerability) |
| **fire** in the kitchen | Wild glass + Hunter — escalate to fix-bug skill |
| **a feature half-built in the garage** | Hunting glass — Hunter takes over |
| **cobwebs across many rooms** | Wild glass — eagle for shape |
| **a haunted box in the attic** | Sage or Elephant interpret |

The house glass is not a universal lens; it's the *housekeeping* lens. When the question shifts shape, switch the glass.
