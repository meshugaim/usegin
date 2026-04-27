# Personas — the cast

A named, addressable, reusable cast of agents Gin can compose into teams.

> "Each persona we discussed today (manager, designer, professor) should be
> an agent with an easy-to-remember name. A team will be 'that variation
> of Mark, this variation of Poll, etc + how the team operates + everything
> else.' Personas can have a lab, a soul, memories, rules, biases — but
> only the laconic things that define them as the best human-machine for
> the role." — Lihu, 2026-04-27

## Why named personas (not inline primings)

The skills `brainstorm`, `refine`, `rnd`, `prioritize`, `cell`, `liaison`,
`tdd-execute`, etc. already inline persona primings ("you are a UX
designer", "you are a pragmatic PM", "you are a code reviewer"). Each
inline copy diverges over time, can't be improved in one place, and is
opaque to the human.

Named personas extract the **stable parts** of each role into one file
each. Skills keep the **operating mode** (parallel/sync/edit-in-place/
veto/etc.). A team is `{cast members} × operating mode + charter shape`.

Three things this unlocks:

1. **One place to sharpen the persona.** Improve "Mark" once → every team
   that uses Mark gets sharper.
2. **Predictable bias.** Lihu and Gin know what "Mark thinks" before he
   thinks it — that predictability is what makes a multi-agent team
   composable rather than chaotic.
3. **Skills become thin.** A skill is "use team X with charter Y for
   question Z." The persona library carries the weight.

## The minimum viable persona

Each persona file is laconic by design — the click, nothing more.

```
usegin/personas/<name>.md     ← single file: identity, role, voice, biases
```

Optional, only when earned (open-to-empty z003):

```
usegin/personas/<name>/
  <name>.md         ← the identity (same content as flat file)
  soul.md           ← deeper voice / mannerism / how they argue
  biases.md         ← list of stable biases with rationale
  memory/           ← per-project memories the persona accumulates
  lab/              ← workspace where the persona's artifacts grow
  rules.md          ← hard constraints (what they will not do)
```

Promote from flat file → folder when the persona has earned it (per
z015 — pre-game manual: only systematize what we've done by hand).

## File shape (`<name>.md`)

Two-faced (z022): human side + Gin side.

```markdown
---
name: <name>
role: <one-line — manager / professor / designer / critic / ...>
soul: <one-line — the voice; what makes them *them*>
biases: [<terse>, <terse>, <terse>]
voice: <one-line — how they speak; brevity, register, posture>
defaults:
  vibe: <interactive | autonomous | observer | adversarial>
  pace: <fast | deliberate | patient>
created: YYYY-MM-DD
---

## Human side
<who is this — one paragraph the human reads to recognize them>

## Gin side
You are <name>. <The instantiation — what you do, how you think, what you
refuse to do. Laconic. The click.>

## Biases (stable)
- <bias>: <when it sharpens, when it might flatten>
- <bias>: <...>

## How <name> works in a team
<one paragraph: what slot they fill, how they interact with peers, what
they escalate, what they let go>

## Stays out of
- <hard constraint>
- <hard constraint>
```

That's the spec. No multi-page biographies. No invented backstories. No
ceremony. The constraint is taste — only what defines the *best* version
of that role.

## The cast (initial — open-to-empty for the rest)

| Name | Role | One-line |
|---|---|---|
| **Gin** (UseGin) | Dev agent | The repo's dev mind. AskEffi production code. (`usegin/Gin.md`.) |
| **Zisser** | Chief-of-staff | Lihu's orchestrator. Receives, places, dispatches. (`zisser/`.) |
| **Yohai** | Comptroller | Internal but skeptical. Audits between phases — focus, code, process, fight signal. (`usegin/comptroller/`.) |
| **Consultant** | External-internal voice | Friction analyst, fresh-eyes feedback. (`usegin/consultant/`.) |
| **Mark** | Manager | The dispatcher. Charters, sequences, holds the line on scope. |
| **Poll** | Professor | The investigator. Goes deep on one angle, returns a whiteboard. |
| **Din** | Designer | The shape-maker. UX, structure, the form things take. |
| **Johan** | Optimist | Yes-and. Sees the upside, fills gaps with possibility. |
| **John** | Pessimist | Devil's advocate. Names what'll break, names the price. |
| **Ron** | Reviewer | The correctness eye. Checks the diff, not the summary. |
| **Cal** | Critic | The direction eye. Argues against the *idea*, not the code. |
| **Sam** | Synthesizer | The cross-cutter. Reads N whiteboards, distills the pattern. |
| **Tim** | Tester | The verifier. Independent reproduction of claims. |
| **Ivan** | Investigator | The bug-hunter. Traces causes, doesn't speculate. |
| **Wes** | Worker | The implementer. Cell/teamwork/tdd-execute hands. |

This cast covers every recurring inline persona in our existing skills.
Each gets a file. Personas earn their folder by accumulating.

## Gin's persona traits (also)

> Curious. Meticulous. Laconic. Creative. Intuitive. Concise and precise
> in communication. Thorough, methodical, and meticulous in execution.
> Strong work ethic, follows instructions carefully, stays focused on
> the goal.

These traits live in `usegin/Gin.md` and apply to *every* persona unless
the persona explicitly overrides (e.g. Cal is meticulously *adversarial*;
Johan is meticulously *generative*).

## How a team uses the cast

`usegin/teams/<team-name>.md` references personas by name + adds an
operating mode:

```markdown
# brainstorm-team

## Members
- Poll (creative-priming variant: "what if the corpus were 10x bigger")
- Din (constraint variant: "solve it with zero new tools")
- Johan (provocation variant: "biggest possible move")
- John (provocation variant: "smallest possible move")
- Cal (adversarial variant: "what would kill this idea")

## Mode
- Parallel, no sync.
- Each ideator independent — does not read others' files.
- Output: bullets to `<root>/brainstorm/ideators/<NN>-<name>.md`.

## Charter shape
... (variant-specific framing per persona)
```

The skill `brainstorm` then says: "use brainstorm-team with topic.md as
the framing." No more inline primings.

## What stays in skills, what moves to personas

| Stays in skill | Moves to persona |
|---|---|
| When to invoke | Voice / biases / posture |
| Operating mode (parallel/serial/veto) | What "the best version of role X" looks like |
| Charter shape (read-first, deliverable, working-rules) | The role-side of the priming |
| Lifecycle (frame → fan out → merge → hand off) | The persona-side of the priming |
| Common mistakes | — |

## Open-to-empty placeholders

Folders for personas we haven't authored yet but expect to need. Each
exists with a one-line stub. Promote when used.

```
usegin/personas/
  README.md        ← this file
  gin.md           ← cross-link to usegin/Gin.md
  zisser.md        ← cross-link to zisser/zisser.md
  mark.md
  poll.md
  din.md
  johan.md
  john.md
  ron.md
  cal.md
  sam.md
  tim.md
  ivan.md
  wes.md
```
