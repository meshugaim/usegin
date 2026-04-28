# House — the codebase as a household

Put on the house glasses. The codebase is no longer files. It is a **home**: rooms, hearth, pantry, garden, basement, attic, foundations. People live here. Daily life happens — dishes pile up, dust gathers, laundry waits, the pantry empties. Without tending, the house slowly becomes unlivable.

The house glasses are for **housekeeping** — the daily, weekly, monthly cadence of keeping the home healthy. Not building new (that's Builder + Hunting glasses for new feature kills). Not investigating noise (Wild glass). **Tending.**

## Why a glass for housekeeping

Most engineers (and agents) under-invest in housekeeping. Cleaning isn't shippable. Tending isn't a feature. Drift accumulates silently. The house glasses force the language to change: "the dishes are stacking up" lands differently than "we have 14 open PRs." Both are true; one is felt.

## The world (vocabulary)

| In the home | In the codebase |
|---|---|
| **House** | The repo |
| **Rooms** | Subsystems / modules / packages |
| **Hearth** | The dev loop — fast feedback, the warm core where the family gathers |
| **Bed** | `main` — the place you trust to come back to |
| **Pantry** | Dependencies — what the house consumes |
| **Drawers** | Config / settings (`.env`, `settings.json`, etc.) |
| **Garden** | Documentation — needs regular weeding, watering |
| **Basement** | Legacy code — kept, sometimes useful, often forgotten |
| **Attic** | Archived code, old experiments, things-we-might-need-someday |
| **Walls** | API boundaries, type contracts |
| **Windows** | Observability — what we can see in/out of the house |
| **Doors** | External integrations — how we open to the outside |
| **Foundations** | Infrastructure, deploy, DB |
| **Yard** | Public surface — landing pages, marketing site, customer-facing surfaces |
| **Mailbox** | Inbox — issues, alerts, customer messages |
| **Family** | The team + the agents (Gin, sub-agents, named personas) |
| **Foster children** | The artifacts being raised — half-built features, in-progress refactors, drafts |
| **Dishes** | Open PRs / unmerged work |
| **Laundry** | Stale branches |
| **Dust** | Cruft, drift, accumulated small wrongness |
| **Cobwebs** | Forgotten code that nothing touches |
| **Mold** | Rot — code that's gone bad in place (security drift, dependency rot, contract drift) |
| **Mess** | Visible disorder — failing tests, broken types, lint errors |
| **Tidy** | Visible order — green CI, clean diffs, organized files |
| **Rules of the house** | Project conventions, CLAUDE.md, lint configs, pre-commit hooks |

Full mappings live in [`rooms.md`](rooms.md) and [`keeping.md`](keeping.md).

## The inhabitants

The house has a family. Each member has a role.

| Inhabitant | Role |
|---|---|
| **Mother** (creative archetype) | Head of household. Daily tending. Holds the family's rhythm. |
| **Builder** (creative archetype) | Renovates. Adds rooms. Repairs structural problems. |
| **Mevaker** (creative archetype) | Audits the books. Walks the house periodically with a checklist. |
| **Sage** (creative archetype) | The grandparent who's lived here longest. Remembers the original layout. |
| **Tikur** (creative archetype) | Shows up after incidents — broken pipe, lost work, fire. |

Each archetype is at `usegin/personas/creative/<name>.md`. The house glasses *call on* archetypes; they don't replace them.

## Wearing the house glasses

1. **Walk the house.** Open with a sweep — what's the *state* of each room? Hearth warm? Pantry stocked? Garden weeded? Dishes done? Don't get into details yet.
2. **Name what's neglected.** First: what hasn't been tended? Dishes (PRs), laundry (branches), pantry (deps), garden (docs), basement (legacy)? Make a list with locations.
3. **Pick a tending pass.** Not all at once. Mother-mode: small + frequent > heroic + rare. One or two patches per session.
4. **Tend.** Small, careful changes. A doc edit. A merge of a stale-but-ready PR. A cleanup of dead config. A pantry restock (`bun update`).
5. **Note what's bigger than tending.** Some things aren't dust — they're structural. Mold, broken foundations, missing wall. Those go to **Builder** (renovate) or **Tikur** (incident-trigger) or are escalated to the human.

## Where things live

| | Where |
|---|---|
| World vocabulary | `rooms.md`, `keeping.md` |
| Signals | `signals.md` |
| Inhabitants reference | this README + `usegin/personas/creative/*.md` |
| Tidying chores (open-to-empty) | `chores/<chore-slug>.md` (created when a recurring chore deserves a write-up) |
| Walkthrough records | `walks/<YYYY-MM-DD>.md` (output of a house walk) |

## Open-to-empty

`chores/` and `walks/` start empty. They fill as the house glass gets worn. A walk is the natural unit of output.
