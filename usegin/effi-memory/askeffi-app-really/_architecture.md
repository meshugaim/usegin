---
status: v0 design decision; v1 unbuilt
decided: 2026-05-08
decided-by: lihu + claude (handoff session, post-experiment-001)
---

# Effi-memory — retrieval & latency architecture

How an agent should *use* this wiki at runtime. The note shape and conflict
rules are in [_conventions.md](_conventions.md); this file covers retrieval,
latency, and where the substrate plugs into Effi (deferred to v1).

## Decision (one line)

**Architecture B**: preload `MEMORY.md` + every `moc/*.md` into the agent's
system-prompt prefix; fetch individual `notes/<topic>.md` on-demand in a single
batched round-trip per question. Optimise for **TTFT** (time-to-first-token),
not TTC (time-to-complete).

## Why TTFT

Once the user starts reading the streamed response, they're not waiting any
more — generation overlaps with reading. The metric the user perceives as
"slow" is the silence before the first token. So the optimisation target is
**round-trips before generation starts**, not total wall-clock.

In experiment 001 the wiki-grounded Gin took ~48s end-to-end; almost all of it
was 9 sequential file reads with reasoning between each. Wiki I/O itself was
1–2s. The fix is to remove the round-trips, not to make the files faster.

## Architecture B vs A (the path not taken)

| | A — eager preload all | **B — preloaded index + on-demand notes** |
|---|---|---|
| What loads in system prompt | every `notes/*.md` | `MEMORY.md` + every `moc/*.md` only |
| Per-question retrieval | none | one batched read of the topics the question routes to |
| Cache fit (Anthropic prompt cache) | borderline (grows with note count) | clean (index is small + stable) |
| Stale-claim risk | high (cache holds yesterday's `Current`) | low (notes fetched fresh per question) |
| TTFT estimate | sub-second | ~5s (one batched read) |
| Cost at scale | every session pays for every note | session pays for the topics it touched |

A loses on stale-claim risk: prompt caches don't invalidate when a note's
`Current` line changes, so cached agents would happily quote yesterday. B
treats the index as semi-stable (slugs don't change) and the notes as live.

## Routing — index → notes

The MOC files are the routing index. An agent answering a topical question:

1. Has `MEMORY.md` + MOCs already in its prefix.
2. Picks the relevant `notes/<topic>.md` paths from the MOC's see-also web.
3. Reads them in one batched call (parallel `Read`s in a single tool turn).
4. Generates. First token streams as soon as step 3 returns.

If the question doesn't map to a topic in the MOC, the agent answers from
the prefix alone (fact-of-absence is itself useful: "wiki doesn't cover that
yet") rather than guessing.

## Reconciler — when does the wiki update

Offline; never inline with a user question. Two trigger families, hybrid:

- **Event-triggered** — new raw datum lands (Gmail / Drive / Fathom / Linear),
  user → Effi question, **Effi conversation end**. The third one is the
  highest-signal source: user corrections in chat history are validated
  ground truth. Cheaper to subscribe than to scan.
- **Scheduled sweep** — periodic full pass to catch what events missed and
  to re-verify `Last verified` timestamps drifting past a threshold.

v0 is manual one-shot extraction (current state). v1 is a scheduled agent
running extract → reconcile against the dogfooding project, with chat-history
JSONLs prioritised. We have the `schedule` skill for the cron half.

## Where Effi reads the wiki — deferred (v1)

v0 consumer is Gin (any agent reading the repo). Two candidate runtime paths
for Effi itself when we get there:

- **Supabase table** — `memory_notes(topic, current_claim, citations jsonb,
  history jsonb, updated_at, conflict_pending)`. Effi calls a
  `memory_lookup(topic)` tool. Reconciler is the only writer.
- **Pre-built bundle** — same data flattened to a TEXT column, pulled once
  at session start. Cheaper at lookup, staler within a session.

In both, **repo markdown stays the source of truth and audit surface**;
Supabase is a derived index. Don't write to Supabase from anywhere except
the reconciler.

Choosing between them needs latency + freshness data we don't have yet. Open
until we measure.

## Measurement

Experiments live in `usegin/effi-memory/experiments/`. To compare wiki
versions or architectures meaningfully, every run records:

- `t0` — prompt sent to the model
- `t1` — first content token streamed back
- `t2` — stream complete

`t1 − t0` is TTFT (the metric). `t2 − t0` is wall-time (informational).

Experiment 001 has only wall-time (~48s Gin / ~62s Effi). Future runs
should instrument TTFT directly.

## Non-goals at v0

- Cron / scheduled reconciler.
- Effi runtime access to the wiki.
- Supabase index.
- A `wiki_lookup` tool wrapper. Direct file-read works for B and is the
  cheapest probe of the architecture.
