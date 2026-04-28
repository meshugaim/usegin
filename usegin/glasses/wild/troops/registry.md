# Troop registry — wild glass

The index of who watches what. Father-Suricate (`usegin/personas/father-suricate.md`) reads this on dispatch. Each animal (`usegin/personas/<species>.md`) instantiates against one row when the scope is theirs.

Open-to-empty (z003). Add a row the same turn a scope is claimed.

| Scope (slug) | Biome | Species | Baseline file | Last scan | Notes |
|---|---|---|---|---|---|
| _(open-to-empty)_ | | | | | |

## How to claim a scope

1. **Pick a patch.** Directory, test surface, artifact class, or pattern bed.
2. **Identify the biome.** Jungle / savannah / swamp / quiet field / river / stream / cliff / watering hole. (See `../terrain.md`.) The biome shapes which species belong.
3. **Pick the species.** Suricate for noise on a small patch. Eagle for macro shape. Owl for sleeping systems. Hyena for dead code in a quiet field. Elephant for a swamp's history. Wolf needs a specific scent — usually dispatched ad-hoc, not registered.
4. **Slug it.** `nextjs-auth`, `python-effi-agents`, `migrations`, `e2e-tests`, `cron-nightly`, etc.
5. **Create the baseline file** at `usegin/glasses/wild/troops/<species>/<slug>.md`. The animal writes its learn-the-sound baseline here on first dispatch.
6. **Add a row** to the table above.
7. **Dispatch the animal** in *learn* mode first; *scan* mode after the baseline lands.

## Maturity gate

Only register a scope **when it's mature enough to have a recognizable natural sound**. A patch in active flux has no stable rhythm — animals scanning it will report nothing but flux. Wait until the patch has settled (typically: stable for a couple of weeks of normal commit activity, or has a clear convention the team has converged on).

Half-formed patches → no baseline yet → don't register. Comes-and-goes patches → no baseline yet → don't register. The wild glass is for *noticing the off-note in an established song* — without a song, there's no off-note.

## Drift over time

Compare `../scans/<date>-<trigger>.md` files chronologically. Rising chirp / sighting count in a scope means the natural sound is being lost; that scope needs attention before the noise becomes the new baseline.

A scope that drifts repeatedly may need its baseline refreshed (the song genuinely changed) or may need fixes (the song is being lost). The human / Zisser decides.
