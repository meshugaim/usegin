---
id: z103
title: COP for sub-Gins — pull-on-demand surface, never default-on stream-watching
type: zettel
authored-by: usegin
threads: [~z040, ~z029]
created: 2026-04-27
session: a2f5af80-303b-4c26-957b-ddb5bfeb61e3
---

## Human side

War research SYNTHESIS D3: PO"SH wants a Common Operating Picture (`dx agents status`) so multiple in-flight sub-Gins are visible. Mission Command warns: real-time stream-watching is the temptation that broke US Army Mission Command in network-centric C2 — defaults to micromanagement.

## UseGin side

Both are right about *different things*. Build the COP as a **pull-on-demand surface**; do not make the stream the default view.

**Pull-on-demand is right** (PO"SH C2): the parent becomes the bottleneck without any visibility into in-flight sub-Gins. When two professors race in `rnd`, when a `cell` worker has been quiet for 20 minutes, when `tdd-execute` is mid-cycle and Lihu walks in — there must be a single surface to query. Not seeing the state is C2 doctrine's failure mode.

**Default-on stream-watching is wrong** (Mission Command #10): if Lihu's habit becomes "watch the sub-Gin streams," the temptation to interrupt and steer kills the Selbständigkeit (principle 5/aharai-adjacent: charter, release, read the deliverable). The same sin that made McChrystal's network-centric C2 collapse to Befehlstaktik.

**Synthesis**: build `dx agents status` (or the equivalent surface) as a *queryable, low-cognitive-cost* view — Lihu reaches for it when he wants to know; the harness does not push it into his face. Same shape as `morning-brief` (DL1 lean B): the artifact is the value; the cadence is for humans to choose.

What the surface should answer:
- Which sub-Gins are in flight, with charters reachable.
- Which are waiting on input vs. running vs. crashed.
- Which produced an artifact since last check.
- *No* live token streams; *no* scrolling output. Pull, summarize, link to artifact.

What the surface should *not* do:
- Auto-open during a session (that's stream-watching with extra steps).
- Dump raw transcripts (that's evidence, not status).
- Try to be a debugger — those are separate skills.

The architectural gap that PO"SH flagged about *self-synchronization between sub-agents* (Alberts/Garstka tenet 3) stays unsolved here — multiple in-flight sub-Gins still won't see each other's state, only Lihu will. That's a real follow-on track.

## Threading

↑z040 (clusters emerge) · ~z029 (sub-Gins lack Agent tool) · ~principle 05 #5 (orient) · ~principle 05 #6 (Lihu's attention is COG) · ~principle 05 #11 (blameless + ordered) · ~`morning-brief` skill · ~`usegin/research/war-management/SYNTHESIS.md` D3.

## Source

War research SYNTHESIS §2 D3.
