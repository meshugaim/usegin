# Wild — the codebase as a jungle

Put on the wild glasses. The codebase is no longer files. It is **terrain**: jungle, savannah, swamp, river, quiet field. Things live in it. Some are friendly — water sources, food, the herd. Some are dangerous — lions, snakes, vultures circling. The air carries information: sounds, smells, weather. Some patches are calm. Some are storm-struck.

This glass is built around a core observation: **order is loud, noise is sneaky** (`usegin/Gin.md` "Friends and enemies"). Linters and type-checkers hear the loudest order; they miss the quiet wrongness. Animals — the herd — are evolved to hear *exactly* the quiet wrongness. So we make animals.

## The world (vocabulary)

| Wilderness | Codebase |
|---|---|
| **Jungle** | Dense, complex, high-cardinality code (`python-services/agents/effi/`, the sprawling parts of `nextjs-app/lib/`) |
| **Savannah** | Open, mature, well-trodden code — boring on purpose |
| **River** | Major flows that carry life through the system (auth, billing, the request path) |
| **Stream** | Small healthy flows — a tight lib, a self-contained module |
| **Quiet field** | Stable, rarely-touched, mature areas |
| **Swamp** | Sticky code that resists change — old, tangled, hard to step in |
| **Cliff** | Dangerous edges (deploys, migrations, irreversible operations) |
| **Watering hole** | Shared resources — DB, infra, secrets, the things everyone needs |
| **Sounds** | Patterns — the rhythm of an area; what it normally sounds like |
| **Noise** | Jarring deviations from the natural sound (the enemy — see `usegin/Gin.md`) |
| **Smells (good)** | Clean conventions, well-loved code, things that feel right |
| **Smells (bad)** | Code smells, suspicious shapes, the "ugh" before you can articulate it |
| **Tracks** | Traces of past activity — git history, code-history, comments left by someone |
| **Water** | What sustains the system — observability, working tests, healthy CI, accurate docs |
| **Food** | What gives energy — fast feedback loops, working dev tools, cached deps, green CI |
| **Weather (calm)** | Steady commit rhythm, low Sentry, nothing on fire |
| **Weather (storm)** | Incident in flight, mass failure, deploy crisis |
| **Drought** | Dead area — no commits, no maintenance, abandoned |
| **Flood** | Too many changes at once — diff fatigue, risk concentration |
| **The herd** | Friendly animals that watch the terrain (suricate, eagle, owl, hyena, elephant, wolf) |
| **Predators** | Lions (major bugs), snakes (silent vulnerabilities), vultures (circling failure clusters) |

Full mappings live in [`terrain.md`](terrain.md), [`ecology.md`](ecology.md), [`bestiary.md`](bestiary.md), and [`predators.md`](predators.md).

## The herd

Each animal hears, sees, or smells one thing well. They live in patches; they don't roam. Personas at `usegin/personas/<animal>.md` (Gin-side voice + biases). Bestiary entry at `bestiary.md` (the role + the slot).

| Animal | What it senses |
|---|---|
| **Suricate** (meerkat) | Stands tall on its patch; learns the natural sound; chirps the off-notes. **Noise**. |
| **Eagle** | High-altitude scan; sees clusters and shapes the ground-dwellers can't. **Macro pattern**. |
| **Owl** | Night watch; watches the systems that run while everyone's asleep (cron, CI, background workers). **Sleeping systems**. |
| **Hyena** | Scavenger; finds the dead — abandoned files, unused exports, orphaned migrations, dead branches. **Dead code**. |
| **Elephant** | Long memory; remembers what was tried before, where the old paths went, why a thing exists. **Institutional memory**. |
| **Wolf** | Pack hunter; follows a single scent (one bug) across files in coordinated chase. **Cross-file investigation**. |

Each has a persona file. Each is spawnable individually, or in coordinated dispatches via **Father-Suricate** (sentinel orchestrator) or **Zisser** (chief-of-staff above all glasses).

## Predators

The enemies. They live in the jungle too. The herd's job is to spot them.

| Predator | What it is |
|---|---|
| **Lion** | A live, dangerous bug. Visible damage. Bites. Sentry incident. |
| **Snake** | Hidden vulnerability. Silent corruption. Auth hole, RLS gap, race condition. |
| **Vulture** | Circles failing systems. Sentry alert clusters, repeated retries, flapping CI. |
| **Trap** | Hidden hazard left by someone — a foot-gun, a destructive default, a deceptively-named function. |
| **Mirage** | Looks like water; isn't. A test that passes but doesn't assert anything. A type that's `any` in disguise. |

Full predator profiles in [`predators.md`](predators.md).

## How to wear the wild glasses

1. **Trigger Zisser or Father-Suricate.** "Wild scan on `<scope>`" / "send the herd to `<area>`" / "what does `<patch>` sound like?"
2. **The herd dispatches.** Each animal goes to its patch. Suricates listen for noise. Eagles sweep from above. Owls check the sleeping systems. Hyenas sniff for carrion. Elephants surface old paths. Wolves track a specific bug.
3. **They report in their own vocabulary.** Chirps, sightings, tracks, scents. Not "function X has cyclomatic complexity 12" — "the rhythm of this area changed two weeks ago and nobody chirped about it."
4. **You triage.** The herd doesn't fix. Findings hand off to Zisser/Mark, who dispatch Wes (or whoever) to actually fix.

## Where things live

| | Where |
|---|---|
| World vocabulary | `terrain.md`, `ecology.md`, `signals.md` |
| The herd | `bestiary.md` (+ persona files in `usegin/personas/`) |
| The enemies | `predators.md` |
| Active troops + scope claims | `troops/registry.md` |
| Per-scope baselines (the natural sound) | `troops/<species>/<scope>.md` |
| Scan reports | `scans/<YYYY-MM-DD>-<trigger>.md` |
| Why this glass exists at all | this README + `usegin/Gin.md` "Friends and enemies" |

## Open-to-empty

Most of `wild/` will be open-to-empty until the glass gets worn. That's correct (z003). Address before content. The first scan that produces real chirps will start filling `troops/` and `scans/`.
