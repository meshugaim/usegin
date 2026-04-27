# Persona Lab

Lab files for personas at `usegin/personas/`. Same pattern as
`.claude/skill-lab/`: each persona gets a lab entry stating *intent*,
*success signals* (when it shows up well in a session), and *retro
criteria* (what to check after a session that used the persona).

Persona files at `usegin/personas/<name>.md` carry the **identity** —
who the persona is, voice, biases, defaults. Lab files at
`usegin/persona-lab/<name>.md` carry the **evaluation** — how do we
know the persona did its job; what does a sharp invocation look like
vs a soft one.

## Pattern

```
usegin/personas/tim.md      ← identity (laconic — soul + biases + voice)
usegin/persona-lab/tim.md   ← evaluation (intent + success signals + retro criteria)
```

## When to backfill a lab entry

Only after a persona has been used by hand in at least one session
(z015 — pre-game manual rule). Until then, identity-only is enough.

When a persona is used and the orchestrator notices something worth
pinning ("Tim came in too soft — he didn't reproduce from cold",
"Cal kept slipping into Ron's slot"), add the entry as open-to-empty
(z003) and grow it as the persona is exercised.

## Cross-skill usage

Personas appear in teams (`usegin/teams/`). Team labs at
`usegin/team-lab/` evaluate the **composition + operating mode**.
Persona labs evaluate the **member's individual contribution**.
Both can be checked in a `team-retro` or `skill-retro` pass.
