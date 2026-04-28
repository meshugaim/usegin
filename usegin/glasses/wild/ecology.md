# Ecology

What lives in the wild beyond the animals — the resources the herd needs, the weather, the smells in the air, the sounds underfoot.

## Sounds

Every patch has a natural sound — its rhythm, its repeated shapes, its expected cadence. The herd learns the sound first, then listens for what doesn't fit.

| In the wild | In the codebase |
|---|---|
| The patter of leaves | The shape of a typical file in this area |
| The rhythm of insects | Test cadence, commit cadence |
| The wind direction | Which way changes are flowing — feature work, refactor work, fire-fighting |
| Distant thunder | Sentry alert volume rising |
| Footsteps | Recent commits — whose, how many, how scattered |
| Echo | Code that repeats itself somewhere else |
| **Silence** | A patch with no commits, no tests running, no logs — drought |

**Noise** is anything that doesn't fit the natural sound. The eleventh test that's *almost* like the ten before it. The function whose name doesn't sound like its neighbors. The commit message in a different tone than the rest of the log.

## Smells

The flinch. Things that hit the nose before the eye understands them.

| Bad smell | What it signals |
|---|---|
| **Stale** | Code that hasn't been touched but isn't peaceful — it's neglected, not at rest |
| **Sour** | Patched-over wrongness; a fix that didn't fix |
| **Rot** | Dead code that nobody cleared; references to things that no longer exist |
| **Smoke** | Something *was* on fire here recently — recent revert, hot Sentry, repeated retries |
| **Iron** | Blood in the air — a recent incident, hurry, fear in the commits |
| **Wet wool** | Sticky swamp smell — code that resists every change |
| **Sulfur** | Magic — something works and nobody knows why; explicit `# don't touch` energy |

| Good smell | What it signals |
|---|---|
| **Fresh** | Recently maintained, tests passing, comments accurate |
| **Pine** | Clean, conventional, sits in its slot — boring on purpose |
| **Bread** | Loved code — small comments that explain the *why*, names that suit |
| **Petrichor** | After-storm calm — recent fix that landed cleanly, the area healed |

Smells are not metrics. They're the named flinch. When an animal reports a smell, that's evidence; the *why* is investigated downstream.

## Water

What sustains the system. Without it, things die.

| Wilderness | Codebase |
|---|---|
| Clear water | Observability — logs, metrics, traces. The system can be read. |
| A drinking pool | A passing CI run |
| Rainfall | Active maintenance — commits flowing in |
| A spring | Documentation that's actually accurate |
| A test that catches a real bug | A test that catches a real bug — direct mapping, no metaphor needed |

**Mirage**: looks like water; isn't. A test that passes but doesn't assert. A "monitoring dashboard" that's never red. A log line that says "success" before the operation completes. Mirages are dangerous — the herd thinks it drank.

## Food

Energy. What gives the team strength to move.

| Wilderness | Codebase |
|---|---|
| Fresh kill | A merged PR that closes a real ticket |
| Stored cache | Cached deps, hot reload, fast `bun install` |
| A working tool | Working dev tools, a passing pre-push, fast feedback loops |
| Berries on a bush | Small, easy wins — quick cleanups, low-hanging refactors |

**Famine**: when the dev loop is slow, deps are broken, CI is flaky. The herd weakens. Decisions get worse. Suricates start mistaking shadows for predators because they're hungry.

## Weather

The mood of the wild as a whole.

| Weather | Codebase state |
|---|---|
| **Calm** | Steady commits, low Sentry, nothing on fire, green CI |
| **Sunny** | Active healthy progress — features landing, morale visible in commit messages |
| **Overcast** | Something feels off but no fire yet; energy is lower than usual |
| **Storm** | Incident in flight, mass failure, deploy crisis |
| **After-storm** | Recent post-mortem energy, fixes landing, lessons captured |
| **Drought** | No movement, no maintenance, area abandoned |
| **Flood** | Too many changes at once — diff fatigue, risk concentration, refactors mid-feature |
| **Fog** | Investigation phase — nobody's sure what's happening; the herd should slow and listen |

Weather affects the herd's reading. Don't trust suricate chirps in a storm — they'll hear the storm, not the local noise. Wait for calm; then scan.

## Tracks

Traces of past activity. Reading them is how the elephant works.

| Wilderness | Codebase |
|---|---|
| Footprints | `git log` |
| Old paths | Code-history (`session code-history <file>:<line>`) |
| Bones | Dead code, removed-but-not-deleted comments, abandoned migrations |
| Carved trees | Comments that explain the *why* |
| Worn-down grass | Code that's been touched a hundred times — the floods left a path |
| Scat | Linear closed-issue trail |

Tracks tell you what *happened*; the herd's senses tell you what's *happening*. Both matter.

## How ecology gets reported

Animals describe what they sense in the ecological vocabulary above. A suricate doesn't say "this file violates pattern X" — it says "the sound here changed last Thursday and nothing else in the patch chirped." An elephant doesn't say "this code is legacy" — it says "I remember when this was a stream; it's a swamp now." A wolf doesn't say "I traced the bug" — it says "the scent leads from `auth/` to `billing/webhook.ts:88` and stops there."

Ecology is the *grammar* of the wild glass.
