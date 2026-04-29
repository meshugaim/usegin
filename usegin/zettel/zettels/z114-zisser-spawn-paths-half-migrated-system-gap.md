---
id: z114
title: Zisser spawn-paths reference oria-crazy-world files that don't exist on disk — system gap
type: zettel
authored-by: zisser
threads: [zisser, oria-crazy-world, z109, z023]
created: 2026-04-29
session: zisser-autonomous-2026-04-29-slack
---

Spawning a Zisser sub-agent today means hitting two consistent
discrepancies between what's documented and what's on disk:

1. **Spawn instructions read:** "soul file at
   `oria-crazy-world/ground/personas/zisser.md` — read it, then update
   it in place." That path **does not exist** in this working tree.
2. **Cause:** `oria-crazy-world/` was extracted to its own private repo
   (`AskEffi/oria-crazy-world`, commit 5e2b802f7) and is supposed to be
   cloned in by `just bootstrap-world` during devcontainer post-create.
   In *this* devcontainer, that clone returns **HTTP 403** — the
   running Gin's GitHub token lacks access to the AskEffi org's private
   repo. So the migration IS real and on the world repo's main; this
   environment just can't see it.
3. **Agent/Task tool is unavailable in Zisser sub-agent contexts** —
   confirmed three times now (2026-04-28 ×2, 2026-04-29 ×1). Sub-Zisser
   parallelism described in older charters cannot be executed; only
   inline serial work or tmux-spawned `claude` can.

## Cluster check (per cluster-search skill)

3 touches now on the agent-tool gap (z109 + 2026-04-28 morning report +
this run). The migration is fine; the access-token gap (this Gin's
gh-token can't pull AskEffi/oria-crazy-world) is the real blocker for
spawn-instruction paths to resolve in this environment.

## Lekach (לקח)

**A charter that names a sub-agent slot the harness can't actually fill
is a parked artifact, not dispatch.** Be honest about which it is.
Same applies to spawn instructions that point at paths the agent's GH
token can't reach: **what the fresh agent reads on wake-up matters
more than what the SoT-doc claims.** Probe the actual environment
(`ls`, `gh repo view`, `git ls-remote`) before declaring "done."

## Concrete asks (open-to-empty for whoever picks up)

- Lihu/Oria: grant this devcontainer's GH token read access to
  `AskEffi/oria-crazy-world`, OR change the Zisser spawn instructions
  + `_persona zisser` recipe to fall back gracefully when the world
  clone is absent.
- Place this Zisser session's persona file at `zisser/persona.md`
  (done same turn) — until the world clone lands, that's the SOT.
- Document the Agent-tool-gap workaround in `zisser/CLAUDE.md` so the
  next Zisser doesn't have to discover it for the fourth time.

## Threads

- z109 (partial-tikur-fix-is-still-an-unfixed-tikur) — the cluster pattern.
- z023 (charter IS the instantiation) — the principle that's violated
  when "I wrote a charter" passes for "I dispatched."
- z037 (place for everything) — the inverse: if the place doesn't
  exist, the system isn't telling the truth about its placements.
