# Terrain

Biomes of the codebase. Each patch is one biome. Patches don't have to be directories — they can be artifact classes, test surfaces, pattern beds. The biome shapes which animals belong there and what their natural sound is.

## Biomes

### Jungle

Dense, complex, high-cardinality. You can't see far. The canopy is thick — abstractions stacked on abstractions. Every step might surprise you. The natural sound is *loud and varied*; pattern detection here is hard because there's so much going on.

**Where:** `python-services/agents/effi/`, the deeper parts of `nextjs-app/lib/`, the SDK-using surfaces.

**Animals that thrive:** Suricates (small patches inside the jungle). Wolves (chase a single scent through the density). Eagles (need to look from above to see anything at all).

**Hazards:** Snakes hide well here. Mirages are common.

### Savannah

Open, mature, well-trodden. Boring on purpose — the same shape repeats predictably. Easy to spot the off-note because the pattern is loud.

**Where:** Mature CRUD code, the well-tested parts of `nextjs-app/app/api/`, established service modules.

**Animals that thrive:** Suricates (the sound is clear here, deviations chirp themselves).

**Hazards:** Complacency. The pattern is so uniform you stop *listening* — and the one off-note slips by.

### River

Major flows that carry life through the system. Auth requests. Billing events. The request path. If it stops, the system dies.

**Where:** Auth middleware, request handlers, payment flows, the agent loop.

**Animals that thrive:** Wolves (follow the flow). Owls (watch when it runs at night).

**Hazards:** Storms upstream become floods downstream. Snakes in a river hurt everyone.

### Stream

Small healthy flow. Self-contained. A tight lib that one thing depends on.

**Where:** A focused utility module, a small CLI tool.

**Animals that thrive:** A single suricate is usually enough.

**Hazards:** Drought (nobody touches it; rots quietly).

### Quiet field

Stable, rarely-touched, mature. Hasn't moved in months. Could be perfectly fine. Could be abandoned.

**Where:** Old migrations, legacy helpers, "we never look at that" code.

**Animals that thrive:** Hyenas (sniff for actual death vs healthy stillness). Elephants (remember why it's still there).

**Hazards:** Mistaking abandonment for stability. Drought.

### Swamp

Sticky. Resists change. Old, tangled, knees-deep. Each step costs effort. You leave tracks, but the swamp closes over them.

**Where:** Code that's been patched a hundred times. Areas where every PR adds one more conditional. Things people *don't volunteer* to touch.

**Animals that thrive:** Elephants (they remember when it wasn't a swamp). Hyenas (find what's already dead in there).

**Hazards:** Snakes love swamps. Rewriting the swamp is its own kind of cliff.

### Cliff

Dangerous edges. Irreversible operations. Migrations applied to prod. Deploys. Destructive defaults. One step wrong and you fall.

**Where:** Migration files. Deploy scripts. Destructive CLI flags. Anything talking to production state.

**Animals that thrive:** Owls (watching when these run). Eagles (verify shape from above before stepping).

**Hazards:** Traps left by hurried hands. The cliff doesn't warn you.

### Watering hole

Shared resources. Everyone needs them. They concentrate risk.

**Where:** Database. Auth tokens. Secrets store. Shared infra. The Sentry org. The Linear workspace.

**Animals that thrive:** Owls (they watch who drinks at night).

**Hazards:** Snakes coil here because the herd has to come. Vultures circle if it's poisoned.

## Reading the terrain

When dispatching a wild scan, name the biome first. The biome determines which animals get sent and what their charter looks like. Don't send a suricate to a cliff — that's owl territory. Don't send an owl to a savannah — there's nothing nocturnal happening there.

A patch can shift biome over time. A stream can dry into drought. A savannah can grow into jungle. An elephant remembers the previous biome; that's diagnostic.
