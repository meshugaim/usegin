# Polaroid template

The shape of an m-stop note. Copy this when filling `latest.md` (or a scoped `scopes/<slug>/latest.md`).

```markdown
# Polaroid — <YYYY-MM-DD HH:MM> (<scope or "main">)

## Who am I

<which Gin / sub-Gin, what role / persona / archetype, what charter triggered this run>

## The kill

<one-sentence quarry — what we're hunting / building / tending. If no kill, name what we're doing instead (scouting, housekeeping, investigation).>

## Where I am

- **Phase:** <stalk / provision / kill / verify / trophy / housekeeping / scouting / blocked>
- **Done:**
  - <bullet, file paths or commit shas>
  - <bullet>
- **Not done (open-to-empty addresses I created):**
  - `<path>` — <what should fill it>
  - `<path>` — <what should fill it>
- **In flight (started but not finished):**
  - <bullet — what's mid-edit when I went to sleep>

## THE ONE THING

> **<If tomorrow-me reads only one line, it is this. Make it count.>**

## Pending decisions / questions

- ↑ <question for Lihu, non-blocking, marked with ↑>
- ↑ <…>
- (none)

## Don't-trust-yourself warnings

- <I almost did X — don't repeat>
- <I noticed Y is fragile — handle carefully>
- <The interrupt left state Z half-written — verify before assuming>

## Resume cue

> **First action on wake:** <one concrete step — open this file, run that command, ask Lihu about that decision>

## Tattoos still holding (sanity check)

- z003 (open-to-empty), z032 (laconic), z002 (no later), z020 (decision shape) — all standard
- usegin/Gin.md three principles + friends/enemies
- (any session-specific tattoo confirmed: e.g. "Lihu wants Memento mode established across all Gin")

## Pointers

- Recent commits: `git log --oneline -10`
- Recent zettels: `ls usegin/zettel/zettels/ | tail -5`
- Linear: <issue ID if any>
- Related Polaroids (prior sleeps): `usegin/memento/archive/<timestamps>`
```

## Discipline

- **Two pages max.** Compress brutally. The Polaroid is the index, not the encyclopedia.
- **Don't lie about "Done".** If a file exists but is half-written, list it under "In flight", not "Done". Tomorrow-you reads "Done" as ground truth.
- **Don't-trust-yourself is load-bearing.** Failure modes you noticed mid-run vanish on amnesia unless written. Always fill this section, even if briefly.
- **The one thing has to be a single thing.** If you can't pick one, pick the most expensive-to-forget one. Don't list five.
- **Resume cue is concrete.** Not "continue the work" — *which* file, *which* command, *which* question.
