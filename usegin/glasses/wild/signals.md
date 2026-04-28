# Signals

The unified vocabulary every animal speaks when reporting. A signal is a single sensory observation — short, specific, located.

## Signal shape

Every signal has the same skeleton:

```
<animal> @ <location> — <signal-word>: <one-line description>
  <optional why>
```

- **animal** — who saw it (suricate, eagle, owl, hyena, elephant, wolf)
- **location** — file path + line, or directory, or service name. Specific enough to act on.
- **signal-word** — from the vocabulary below
- **description** — one line. The flinch, named.
- **why** — optional; only if non-obvious

Example:
```
suricate @ python-services/agents/effi/tools/calendar.py:88 — chirp: pattern says use ToolResult; this returns a raw dict
eagle @ nextjs-app/lib/auth/ — circling: vultures, three Sentry clusters in 48h around session refresh
hyena @ python-services/migrations/ — bones: 0042_add_orgs.sql references org table that no longer exists
elephant @ nextjs-app/lib/billing/legacy.ts — old-path: this was the v1 billing flow; replaced 2025-11; kept for historical reads
wolf @ auth → billing/webhook.ts:88 — trail: scent leads here and stops; the bug lives at this line
owl @ cron/nightly-aggregate — quiet-failure: succeeded with 0 rows three nights running; previously 10k+
```

## Signal vocabulary

### Suricate signals

- **chirp** — noise; pattern deviation. The default suricate signal.
- **silence** — expected sound is absent (drought, dead patch).
- **echo** — same sound twice in adjacent patches (duplication smell).
- **smell-bad** — sour / stale / rot / smoke / iron / wet-wool / sulfur (see `ecology.md`)
- **smell-good** — fresh / pine / bread / petrichor

### Eagle signals

- **shape** — a macro pattern visible from above. Cluster, hole, asymmetry.
- **circling** — vultures sighted (failure cluster around an area).
- **storm-front** — weather change visible at altitude — refactor wave incoming, fire-fighting concentration.
- **mismatch** — the shape of a region doesn't match its neighbors.

### Owl signals

- **night-call** — something woke the system at night (cron, alert, deploy).
- **quiet-failure** — a sleeping system failed without anyone noticing (zero-row run, retry storm).
- **moonlight** — a system that ran successfully but used unexpected resources (cost spike, slow query).

### Hyena signals

- **bones** — dead code / unused export / orphaned migration / abandoned config.
- **carrion** — recently-dead, not yet cleaned (revert without follow-up cleanup).
- **picked-clean** — area that *was* alive once; now there's nothing left.

### Elephant signals

- **old-path** — surfaces *why* a thing exists; historical context.
- **graveyard** — area where many things died historically — high failure / revert / abandonment density.
- **scar** — code shape that's the visible mark of a past incident.
- **forgotten** — known information that was once held by the team but isn't surfaced anywhere current.

### Wolf signals

- **trail** — a scent followed end-to-end; here's where it leads.
- **scent-lost** — the trail went cold (bug stops being reproducible mid-chase).
- **fork** — the scent splits; multiple suspect locations.
- **den** — the source — where the bug lives.

### Predator-sighting signals (any animal)

Any animal that crosses a predator reports it the same way:

- **lion** — live bug, visible damage. Escalate immediately.
- **snake** — silent vulnerability suspected. Security label.
- **vulture** — failure cluster circling.
- **trap** — hidden hazard / foot-gun / lying name.
- **mirage** — looks like signal; isn't. Test that doesn't assert, dashboard that can't go red.
- **fire / crocodile / wasp-nest / quicksand** — see `predators.md`.

## Signal aggregation

Father-Suricate consolidates all signals from a scan into `scans/<YYYY-MM-DD>-<trigger>.md`. The shape:

```markdown
# Scan: <trigger> — <date>

## Predators sighted

(any lion / snake / fire signals, top of file, escalation-ready)

## Sightings by patch

### <patch-1>

<animal>: <signal-word>: <description>
<animal>: <signal-word>: <description>

### <patch-2>

...

## Drift since last scan

<comparison to prior scan, if any>
```

Predators top of file. Patches grouped. Drift section if a prior scan exists for the same trigger.

## Signals are not findings

A signal is what an animal *senses*. A finding is what the human / Zisser decides the signal *means*. The herd does not produce findings — they produce signals. Triage is the human's slot (or a downstream agent like Cal for direction calls, John for failure modes).

This is on purpose. The herd's job is to *notice*; the human's job is to *judge*. Mixing the two collapses the glass.
