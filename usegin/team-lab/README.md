# Team Lab

Lab files for teams at `usegin/teams/`. Same pattern as
`.claude/skill-lab/` and `usegin/persona-lab/`: each team gets a lab
entry stating *intent*, *success signals* (what a good run looks like),
and *retro criteria* (what to check after a session).

Team files at `usegin/teams/<name>-team.md` carry the **composition** —
who's in it, operating mode, charter shape. Lab files at
`usegin/team-lab/<name>-team.md` carry the **evaluation** — how do we
know the team produced what it should; what does a sharp run look like
vs a soft one; where does the composition tend to drift.

## Pattern

```
usegin/teams/qa-team.md       ← composition (cast + mode + charter shape)
usegin/team-lab/qa-team.md    ← evaluation (intent + success signals + retro criteria)
```

## When to backfill a lab entry

Only after a team has been run by hand in at least one session
(z015 — pre-game manual rule). The lab grows from observed failure
modes and observed strengths, not from anticipated ones.

## Layered retro

When `team-retro` runs after a session, it walks three layers:

1. **Skill** — was the skill's lifecycle followed? (`.claude/skill-lab/<skill>.md`)
2. **Team** — did the composition + operating mode work? (`usegin/team-lab/<team>.md`)
3. **Persona** — did each member contribute their slot? (`usegin/persona-lab/<member>.md`)

A team-lab entry is the middle layer. It catches things the skill-lab
misses (composition-level issues) and that persona-labs miss
(individual-level issues).
