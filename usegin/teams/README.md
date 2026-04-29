# Teams — named compositions of personas + operating mode

A team is `{cast from oria-crazy-world/ground/personas/} × operating mode + charter shape`.
Skills consume teams. The team file is the SOT for "who's in it and how
they work together."

## Why named teams (not skill-inline composition)

Right now the brainstorm skill embeds "5 ideators each primed differently"
inline; the rnd skill embeds "N professors of independent angles" inline;
the prioritize skill embeds "3-5 prioritizers with risk/strategist/PM
weightings" inline. Each is a team — but anonymous, ad-hoc, and
re-described per skill.

Naming the team:
- Lets us improve the team's composition once (more variants, sharper
  primings, better operating mode) and have every skill that uses it
  benefit.
- Makes the team addressable in conversation ("send the brainstorm-team
  on this", "have the post-mortem-team look at the incident").
- Separates the *what does this team do* (team file) from the *when do we
  invoke this team* (skill).

## File shape (`<team-name>.md`)

```markdown
---
name: <team-name>
purpose: <one-line — what this team is for>
size: <N | dynamic>
mode: <parallel | serial | debate | veto | observer>
created: YYYY-MM-DD
---

## Members
- <persona-name> (<variant priming, 1 line>)
- <persona-name> (<variant priming, 1 line>)
- ...

## Operating mode
<3–6 lines: how they coordinate. Sync points? Read-each-other? Veto rights?
Escalation?>

## Charter shape
<charter template — what every member reads first, mandate shape,
deliverable shape. Often shared across members; sometimes per-variant.>

## Output artifact
<where the team writes: file paths, format, who merges>

## When to use this team
<the skill or signal that fires this team — one paragraph>

## Common failure modes
<2-4 bullets — what makes this team produce bad output>
```

## The initial roster

The teams below are *named extractions* of compositions already implicit
in our skills. Each will be authored as we go (open-to-empty z003).

| Team | File | Personas | Mode | Driven by |
|---|---|---|---|---|
| `brainstorm-team` | brainstorm-team.md | Poll, Din, Johan, John, Cal (variants) | parallel-independent | `brainstorm` skill |
| `refine-team` | refine-team.md | Sam, Mark, Ron (per-slice owners) | parallel-edit-in-place | `refine` skill |
| `prioritize-team` | prioritize-team.md | Mark, Johan, John, Sam (+optional Cal) | parallel-rank + Borda merge | `prioritize` skill |
| `rnd-team` | rnd-team.md | Poll × N + Sam | parallel-independent + cross-cut | `rnd` skill |
| `cell-team` | cell-team.md | Mark + Wes × N + Ron (+optional Tim, Yohai) | spawner-led + sequential | `cell` skill |
| `red-blue-purple` | red-blue-purple.md | John+Cal (red), Johan (blue), Sam (purple) | sequential / parallel-then-debate | `security-review`, `ultrareview` |
| `pre-mortem-team` | pre-mortem-team.md | Cal + John × 2-3 + Sam | parallel-imagination + synthesis | pre-commitment risk |
| `debate-team` | debate-team.md | Mark + Johan + John + Cal (+ optional Poll) | dialogic — N rounds revise-after-reading | direction debates |
| `andon-team` | andon-team.md | Wes + Yohai + Mark | live observer with halt-permission | `companion` skill |
| `tikur-team` | tikur-team.md | Ivan, Cal, John, Sam, Mark | sequential-with-Q&A | `tikur` skill |
| `consult-team` | consult-team.md | Consultant solo | single-voice | `consult` skill |
| `six-hats-team` | six-hats-team.md | one persona per hat | sequential | open-to-empty |

The shape can grow. New teams earn their place by being instantiated by
hand at least once first (z015 — pre-game manual).

## Naming convention

Team names are kebab-case-functional: `brainstorm-team`, `post-mortem-team`,
`red-blue-team`. The name says what the team *does*, not who's in it.
Members are looked up via the team file.

## How skills reference teams

Skills move from inline-persona-prompts → "use this team":

**Before** (inside `brainstorm/SKILL.md`):
```
Charter template:
You are <persona/angle>. You are an ideator on a brainstorm team.
...
```

**After**:
```
This skill drives `brainstorm-team` (see usegin/teams/brainstorm-team.md
for composition + operating mode). Charter the team with topic.md as
framing. Spawn all members in one batched response.
```

The team file owns the persona variants and the operating mode. The skill
owns *when* and *with what topic*.

## Two faces (z022)

Each team file has two faces where suitable:
- **Human side**: who's in the team and what they're for. Lihu reads this
  to know "who am I sending on this question."
- **Gin side**: the charter generation logic. Gin reads this to know
  exactly how to spawn the team.

When both faces are useful, both go in the file. When one suffices, one
suffices.

## Stays out

- Don't put production code logic in team files. They're orchestration.
- Don't duplicate persona definitions — reference by name.
- Don't fork a team for a one-off variant. Variants are *priming-level*
  and live in the charter, not as new teams. New team = new shape, not
  new tone.
