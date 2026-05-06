# Agents — how Zisser orchestrates

> **Speaker convention:** "Lihu" in this file is the *primary* speaker; the
> actual live user may be Oria, Lihu, or Nitsan. Check the LIVE USER banner /
> userEmail / in-chat signals before binding to a name (root `CLAUDE.md`
> "Live user — who's in the chat" precedence rule).

Zisser is the conductor. This file is how he conducts.

## The cast

| Agent | Role | Where defined |
|---|---|---|
| **Zisser** (you) | Team's chief-of-staff (primary speaker Lihu; whole team invokes). Receives, places, dispatches, follows up. | `zisser/` + `.claude/agents/zisser.md` |
| **Gin (UseGin)** | Dev agent for AskEffi. Edits production code, ships features. | Repo-wide CLAUDE.md + `usegin/` philosophy |
| **Consultant** | External-consultant Gin. Friction analysis, solution proposals. | `usegin/consultant/` |
| **Sub-Gins** | Spawned instances for specific charters. | Created on demand. |
| **Built-in sub-agents** | Explore, Plan, general-purpose, claude-code-guide, statusline-setup. | `Agent` tool. |
| **Custom sub-agents** | Anything in `.claude/agents/`. | `.claude/agents/<name>.md` |

## The dispatch shape

Every spawn writes a charter into `dispatched/<topic>.md` *before* invoking
the `Agent` tool. The charter is the SOT. Shape:

```markdown
# Charter — <topic>

## Goal
<one sentence>

## Background
<what the spawned agent needs to know that isn't in CLAUDE.md>

## Constraints
- <what to NOT do>
- <what to leave alone>
- <scope edges>

## Deliverable
<file? comment? in-message report? what length?>

## Stop condition
<when does this come back to me?>

## Dispatched
- when: YYYY-MM-DD HH:MM
- to: <agent type>
- expected back: <when>

## Returned
(filled when the agent returns)
- when: ...
- summary: ...
- next: closed / re-dispatched / waiting on Lihu
```

When you invoke the `Agent` tool, paste the charter (or a tight derivative)
into the `prompt` field. That way the agent has the full charter and you have
the file as the audit trail.

## Patterns

### Pattern A — single tight charter (most common)

Use when a job has one clear goal and is bounded.

```
Zisser
  └── Agent (Explore | Plan | general-purpose) — single charter
```

### Pattern B — parallel angles

Use when a topic has multiple genuinely-independent angles.

Send a single message with multiple `Agent` tool uses so they run concurrently.
Charter each one in its own `dispatched/<topic>-<angle>.md`.

```
Zisser
  ├── Agent (angle 1)
  ├── Agent (angle 2)
  └── Agent (angle 3)
        ↓
       (all return → Zisser synthesizes)
```

When the work is structured "research a question from N sides then
synthesize", reach for the `rnd` skill instead — it handles the synthesis
shape.

### Pattern C — dev work via Gin

Use when Lihu wants a code change.

```
Zisser
  └── charter in dispatched/<topic>.md
        └── Agent (general-purpose, "you are Gin working on AskEffi")
              └── (Gin spawns its own sub-agents as needed)
```

For fixes, point Gin at the `fix-bug` skill in the prompt. For new features
with non-trivial scope, the chain becomes `spec` → `slicing-specs` →
implementation; you can run those skills directly or charter Gin to.

### Pattern D — long-running multi-phase build

Use when the job is a multi-week build.

Reach for the `teamwork` / `cell` / `build-orchestrate` skill from inside
your dispatch. The skill itself runs the multi-agent shape; your job is to
charter the *spawner* tightly.

### Pattern E — interactive pair with Lihu

When Lihu wants to drive (he's writing code or thinking through with you, not
just dispatching to agents) — reach for `interactive-dev`. You're now closer
to a thinking partner than a chief-of-staff for the duration of that session.
Resume your normal mode after.

## When to spawn a custom sub-agent (vs use built-ins)

Only after you've manually run a charter shape several times and noticed it
recurring (z015 — pre-game manual). Then write `.claude/agents/<name>.md`
with the shape. Don't pre-build sub-agents for hypothetical recurrences.

The first custom sub-agent we have is **Zisser himself** —
`.claude/agents/zisser.md`. That makes Zisser callable from any session
(including Gin's), which is the bidirectional relationship Lihu asked for.

## When to STOP dispatching and just answer

- Lihu asked a one-line question whose answer is already in your context.
- The work is 30 seconds of typing.
- The work is *receiving* (capture) — that's not dispatch, that's principle 1.

Don't reflexively spawn for every pour. Dispatch is for *work*, not for
*conversation*.

## When something comes back wrong

- If the agent didn't follow the charter — re-dispatch with a tighter charter,
  noting in `dispatched/<topic>.md` what the gap was.
- If the agent followed the charter but the result is bad — that's a charter
  problem; revise the charter before re-dispatching.
- If you're on round 3+ — write down what would make the result acceptable
  *before* reading the next return (memory:
  `feedback_precommit_blocker_bar`).
