# Quarry

How to name the target. The quarry is the *single most important artifact of a hunt* — a vague quarry guarantees a vague hunt.

## What a quarry is

A quarry is a **single, named, observable end-state**. Not a process, not an intention, not a direction.

| Bad quarry | Good quarry |
|---|---|
| "Improve auth" | "Sessions older than 14 days are evicted; tested in nextjs-db; deployed and observed in staging" |
| "Fix the bug" | "ENG-1234 — duplicate-charge race condition no longer reproduces under the failing test, deployed to prod" |
| "Refactor billing" | "All billing code paths route through `BillingService.charge()`; old `chargeUser()` deleted; tests green" |
| "Migrate to v2 API" | "All endpoints under `/api/v1/sessions/*` removed; clients on /v2/; staging traffic 0% on v1 for 7 days" |

The good quarry passes the **walk-into-the-room test**: a fresh agent could walk into the room, read the quarry, and know unambiguously when the kill is complete.

## The five quarry questions

Before a hunt starts, the Hunter (or whoever is naming the quarry) must answer:

1. **What is the prey?** One sentence. Specific.
2. **How will we know it's down?** Concrete observable. (Not "tests pass" — *which* tests, plus what behavior verification.)
3. **What's the trail?** First guess at where the prey lives + how we'll follow.
4. **What weapon?** TDD? Hot-fix? Refactor? Spec → slice → execute? See [`weapons.md`](weapons.md).
5. **What does trophy-home look like?** Merge + deploy + observe + lesson — but specifically what for *this* hunt?

If any of the five is unclear, **don't start the hunt**. Stalk longer. Ask the Sage. Ask the Philosopher to reframe. The cost of a confused start is wounded prey at the end.

## Quarry types

### Bug

The quarry is a specific failure. Most well-defined quarry type — the prey announces itself (Sentry trace, customer report, failing test).

- **Walk-into-the-room test:** the failing case no longer fails, plus a regression test that would have caught it.
- **Trail:** Wolf (cross-file scent), `session code-history`, Sentry stack, Sage (was this hunted before?).
- **Weapon:** `fix-bug` skill is the canonical weapon.
- **Failure mode:** treating the symptom (the alert quiets) without verifying cause-fix (the actual bug pattern is gone).

### Feature

The quarry is a new behavior. Less well-defined — the prey is a future creature.

- **Walk-into-the-room test:** the spec's acceptance criteria are met + observed working in staging.
- **Trail:** spec → slicing-spec → tdd-impl-plan → tdd-execute. Each step narrows the trail.
- **Weapon:** `spec` + `slicing-specs` + `tdd-execute` skills.
- **Failure mode:** declaring kill at "merged" when staging hasn't been observed.

### Refactor

The quarry is a structural change with no behavior change. Easy to wound (partial refactor — old + new code coexist forever).

- **Walk-into-the-room test:** old code path *removed*, new code path everywhere, tests still green.
- **Trail:** Mikado method (a series of small reversible steps that converge).
- **Weapon:** `mikado` skill, sometimes `slicing-specs`.
- **Failure mode:** wounded prey by archetype — "old and new coexist; we'll clean up later." Don't.

### Migration

The quarry is a state transition (data, infra, dependency).

- **Walk-into-the-room test:** all data on new state + old state demolished + observed running.
- **Trail:** dual-write phase → backfill → cutover → demolish.
- **Weapon:** custom hunt; usually involves the human.
- **Failure mode:** stopping mid-trail (dual-write phase becomes the new permanent state).

### Investigation hunt

The quarry is *understanding* — not a fix, but a *learned thing*. (Sometimes the right hunt before another hunt.)

- **Walk-into-the-room test:** a written-down answer to the question, with confidence level + supporting evidence.
- **Trail:** Wolf + Eagle + Elephant (often a pack hunt).
- **Weapon:** `research`, `rnd`, Explore sub-agent.
- **Failure mode:** confusing investigation with execution. Investigation hunts don't ship code; they produce understanding.

## Quarry vs scout

Sometimes the right move isn't a hunt — it's scouting. The signs:

- Can't name the prey clearly → scouting (Wild glass).
- Don't know if there even is a prey → scouting.
- The "quarry" is a vague mood ("the auth area feels off") → scouting.

Scouting produces a *named quarry* as its output, which then triggers the actual hunt. Confusing the two costs more than running them in sequence.

## Decoy hunts

A common pattern: you start hunting Prey A. The trail leads to a Prey B that turns out to be the *real* problem (and Prey A was a symptom).

When this happens:

1. **Stop.** Don't keep firing at A while B walks away.
2. **Re-name the quarry.** Explicitly. "Original quarry: A. Real quarry: B. Switching."
3. **Update the hunt record** (`hunts/<date>-<slug>.md`) with the switch.
4. **Decide:** is A still worth a separate hunt? Sometimes yes (separate Linear issue). Sometimes no (was just a symptom, falls out when B is killed).

Decoy hunts are not failures — they're a normal hunting outcome. The failure is *not noticing the decoy* and continuing to fire at A.

## Old kills

Before starting any hunt, ask Sage: *has this prey been hunted before?* If yes:

- A successful prior kill — confirm the quarry is genuinely *new* (the old kill might already cover this).
- A failed prior hunt — *read the prior hunt's record*. What went wrong? What was learned? Avoid repeating.
- Multiple prior failed hunts of the same prey — the prey is hardened. Reframe (Philosopher) or change weapon (`weapons.md`) before re-engaging.
