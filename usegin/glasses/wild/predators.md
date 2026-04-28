# Predators

The enemies. They live in the wild too. The herd's job is to spot them — fast, before they bite. Each has a profile: how it shows up, where it hides, what to do when sighted.

The herd does not hunt predators. **Sightings hand off** to Zisser / Mark / the human, who dispatch a fix. A wild scan that surfaces a predator stops there — escalation is downstream.

## Lion

A live, dangerous bug. Visible damage. Roars.

**How it shows up:** Sentry incident, customer-reported failure, prod alert, error rate spike. Loud, by nature.
**Where it hides:** Rivers (request paths). Watering holes (shared infra). The places everyone has to go.
**Hunting it:** Wolves (track the scent across services). Owl, if it strikes at night.
**On sighting:** Escalate. The human / Zisser triggers `fix-bug` skill. Stop the scan; lions take priority.

## Snake

Silent corruption. Auth holes, RLS gaps, race conditions, off-by-one in security-relevant code. Doesn't bite until something specific happens.

**How it shows up:** It doesn't, until it does. Static analysis won't catch it. Tests pass. Looks fine on the eye.
**Where it hides:** Swamps. Cliffs (irreversible operations where a snake bite can't be undone). Watering holes.
**Hunting it:** Hard. Snakes are why the wild glass exists at all — the suricate's flinch when something *almost* matches the pattern is often a snake. Eagles see the shape that doesn't match from above. Elephants remember when a similar snake bit before.
**On sighting:** Escalate immediately. Snake findings get a `security` label — see `.claude/skills/security/`.

## Vulture

Circles failing systems. Doesn't kill — but its presence means something *else* is dying.

**How it shows up:** Sentry alert clusters that won't quiet. Repeated retries in logs. Flapping CI. The same error filed three times this week.
**Where it hides:** Above the river when the river is sick. Above the watering hole when the water is poisoned.
**Hunting it:** Owl (notices the night calls). Eagle (sees the circling pattern). Hyena (finds the corpse the vultures are circling).
**On sighting:** Find what's dying. The vulture is a symptom; find the lion or the trap nearby.

## Trap

A hidden hazard left behind. A foot-gun. A destructive default. A function whose name lies. A `--force` that's the default flag. A migration that drops a table.

**How it shows up:** Looks normal. Often: looks *helpful*. Bites the next person who steps in.
**Where it hides:** Cliffs (where one wrong step is irreversible). Shared utilities. CLI defaults.
**Hunting it:** Eagle (sees the shape — "why is this destructive thing the default?"). Elephant (remembers who set it and why; sometimes the answer is "they were tired and meant to fix it"). Suricate (notices when a function name doesn't sound like its behavior).
**On sighting:** Don't disarm in a scan. Report. Disarming is a careful operation — wrong order, you fall in the trap yourself.

## Mirage

Looks like water; isn't. A test that passes but doesn't assert. A type that's `any` in disguise. A "monitoring dashboard" that's never red because it can't go red. A log line that says "success" before the operation completed.

**How it shows up:** It doesn't show up at all — that's the problem. The herd thinks it drank.
**Where it hides:** Anywhere the team relies on a signal. Tests. Dashboards. Alerting.
**Hunting it:** Suricate (the test that's slightly off — pattern says assert, this one doesn't). Wolf (try to follow the scent the test claims to track — if there's no scent at the end, mirage). Eagle (looks at the test surface from above — "all green" is suspicious if the surface is large and the change rate is high).
**On sighting:** Mirages are higher-priority than they feel. A mirage means the herd's *senses* are unreliable in that patch. Fix the mirage before trusting any other reading from there.

## Phantom

A test that fails sometimes and passes sometimes — *not* because production code is broken, but because the test itself has a race, a timer dance, a mock-ordering assumption, an environment dependency. **The flake**. It's a predator because it costs the herd's attention every time it appears, and worse — it *desensitizes*. Once the herd learns to ignore the phantom in patch X, a real predator that bites in patch X will be ignored too. Phantoms eat trust in signals.

Distinct from mirage: a mirage NEVER reads. A phantom reads correctly *most* of the time and wrong *some* of the time. That's what makes it dangerous — the herd updates its mental model based on the wrong reading without realizing.

**How it shows up:** "the test failed in CI but passes locally." A failure with no stack trace, or a failure that disappears on rerun. A test whose pass/fail rate correlates with CI load, time of day, or worker-shard count more than with code state. A diff that "shouldn't have broken anything" turning a green suite red on one workflow only.
**Where it hides:** Tests that combine fake timers with async render / streaming SSE / observable state. Tests that mock setTimeout / setInterval but rely on real microtask ordering. Tests with `await render(...)` immediately followed by a state assertion without an `act()` wrap. Browser-integration tests that depend on network timing not pinned to deterministic events.
**Hunting it:** Suricate (spots the structural markers — see below). Eagle (counts CI re-runs in a window — clusters mean phantom-rich patch). Wolf (chases one phantom failure to its mechanism — race vs hook vs mock).
**On sighting:** Resolve, root-cause, and *make the same shape detectable* — phantoms are systemic. A single phantom is a finding; three phantoms in adjacent patches is a *cluster* and the patch's test-rhythm itself is wrong.

**Structural markers** a phantom-hunting suricate should chirp on:

- `vi.useFakeTimers()` (or `jest.useFakeTimers()`) in a test that also calls `render(...)` with components that use `setInterval`/`setTimeout` internally.
- Cleanup order risk: `useRealTimers()` called before `cleanup()` (causes the React-Testing-Library cleanup to run with real timers while the component still has fake-timer-scheduled work).
- `await fetchMock(...)` immediately followed by `expect(state)...` without an explicit `act(async () => { await tick; })` wrap.
- Streaming/SSE mocks resolved without an explicit microtask flush before assertion.
- Tests skipped in CI but green locally (already-known phantom, undetonated).

When a phantom is sighted: write a tikur record in `.claude/tikur-records/`, fix the *test* (not the production code) per the structural fix, and update this section if the marker is novel.

## Other predators (open-to-empty)

Add as we name them. Candidates we haven't profiled yet:

- **Crocodile** — looks like a log; isn't. Code that looks like a no-op but has side effects.
- **Wasp nest** — touch one cell, the whole thing comes for you. Tightly coupled module that punishes any change.
- **Quicksand** — every fix sinks deeper. The bug whose fix introduces two more.
- **Fire** — already-spreading damage. A bad commit on main, a leaking secret, a runaway cost.

When a sighting matches no profile above, name a new one and add it. The bestiary of predators is open — the codebase keeps inventing new ones.

## Predator vs noise

Noise (the enemy from `usegin/Gin.md` "Friends and enemies") is a *category*. Predators are *instances*. Every predator is a form of noise; not every noise is a predator. A suricate hears noise; the human / Zisser decides whether the noise is a snake (escalate) or just a stylistic deviation (queue, fix later).
