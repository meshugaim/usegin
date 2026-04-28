# Bestiary — the herd

Friendly animals that live in the wild and watch their patches. Each has one sense honed sharp; each lives in particular biomes. Persona files (Gin-side voice + biases) live at `usegin/personas/<animal>.md`.

The herd does not fix. They sense, they report, they hand off. Fixes are dispatched by Zisser/Mark to Wes.

## Suricate (meerkat)

**Sense:** Hearing — the natural sound of a small patch.
**Biomes:** Savannah (where pattern is loud), edges of jungle, streams.
**What it does:** Stands tall, learns the natural sound of *one* patch, chirps when something doesn't fit. Records baseline at `troops/suricates/<scope>.md`. Records chirps in the same file.
**What it doesn't:** Leave its scope. Argue itself out of a flinch.
**Persona:** `usegin/personas/suricate.md`

## Father-Suricate

**Sense:** Orchestration — knows which suricate watches what.
**Biomes:** Above-scope.
**What it does:** Holds the troop registry. Dispatches the herd in parallel when triggered. Consolidates findings. Hands off.
**What it doesn't:** Scan a patch himself. Curate chirps. Fix.
**Persona:** `usegin/personas/father-suricate.md`

## Eagle

**Sense:** Sight — high-altitude shape detection.
**Biomes:** All. Especially jungle (you can't see anything from the ground there).
**What it does:** Sweeps from above. Sees clusters, repeated shapes across patches, macro patterns the ground-dwellers miss. Reports shape, not detail. Pairs with suricates — eagle finds *which* patch deserves attention; suricates do the close listening.
**What it doesn't:** Read individual files closely. Chirp small details.
**Persona:** `usegin/personas/eagle.md`

## Owl

**Sense:** Night vision — what runs while everyone's asleep.
**Biomes:** Cliffs, watering holes, rivers.
**What it does:** Watches sleeping systems — cron jobs, scheduled tasks, background workers, CI runs, overnight deploys, automated migrations. Notices what failed quietly between dusk and dawn.
**What it doesn't:** Daytime synchronous code paths.
**Persona:** `usegin/personas/owl.md`

## Hyena

**Sense:** Smell of carrion — finds the dead.
**Biomes:** Quiet field, swamp.
**What it does:** Scavenges. Finds dead code, unused exports, orphaned migrations, abandoned config, references to things that no longer exist, files nobody imports. Reports bones with their location.
**What it doesn't:** Distinguish dead from intentionally-quiet on its own — pairs with elephant for that call.
**Persona:** `usegin/personas/hyena.md`

## Elephant

**Sense:** Memory — knows where the old paths went.
**Biomes:** Swamp (especially), quiet field, anywhere with deep history.
**What it does:** Remembers. Surfaces *why* a thing exists — what was tried before, what was decided when, what was rejected and why, who fought for what. Reads `session code-history`, zettels, decision docs, old PR threads. Pairs with hyena (alive-but-forgotten vs actually-dead) and wolf (history of a specific scent).
**What it doesn't:** Make new findings. Recommend fixes.
**Persona:** `usegin/personas/elephant.md`

## Wolf

**Sense:** Scent tracking — follows one thing across many places.
**Biomes:** River (flow-following), jungle (chase through density).
**What it does:** Pack hunts. Picks up a scent (one bug, one symbol, one error class) and follows it across files, services, layers. Coordinates — multiple wolves on one chase share findings as they run. Reports the trail end-to-end.
**What it doesn't:** Roam without a scent. Catalog things.
**Persona:** `usegin/personas/wolf.md`

## How animals work together

| Pairing | When |
|---|---|
| Eagle + suricate | Eagle finds the patch; suricate listens close. |
| Hyena + elephant | Hyena finds bones; elephant says whether they're actually dead or just quiet. |
| Wolf + elephant | Wolf is chasing a scent; elephant remembers when this scent was last followed. |
| Owl + suricate | Suricate hears noise that only happens at night; owl knows what was running. |
| Father-Suricate + everyone | Coordinates the dispatch. |
| Zisser + Father-Suricate | Zisser triggers the wild scan; Father-Suricate runs the troop. |

## Adding an animal

If a new sense is needed (e.g. *taste* — for input validation surfaces, *touch* — for haptic feedback flows, *temperature* — for hot/cold paths), add it:

1. Pick the animal whose real-world sense maps cleanly. Don't force it.
2. Create `usegin/personas/<animal>.md` with the persona shape (see existing files).
3. Add the bestiary entry above (sense / biomes / what it does / what it doesn't / persona link).
4. Update the bestiary table in `wild/README.md`.
5. If the animal has a complementary pairing, list it in "How animals work together".

The herd is not a closed set. New senses earn new animals.
