# Synthesis — Pinecone Nexus for Effi

Synthesizer: Sam. Inputs: P1 (product+risk), P2 (Effi-retrieval-reality),
P3 (architectural-fit), P4 (alternatives). Snapshot: 2026-05-05, day 2 of
Nexus EA.

## Top — the click

Nexus is a one-day-old early-access product that **answers a different
question than Effi is asking**. Nexus pre-compiles structured task
artifacts (KnowQL: `ask`/`where`/`shape`/`confidence`/`ground`) for known
question shapes; Effi's workload is open-ended agentic chat over project-
scoped, two-tiered (internal/external) heterogeneous data, mid-migration
GFS→VAIS. Replace is disqualified today by a single missing fact —
whether `where` is server-trusted under a session-bound token. Sit-
alongside doubles ingest cost without resolving heterogeneity. **The
only sane engagement now is a bounded EA wire-probe on one structured-
status surface, while we keep finishing VAIS and treat the deeper "buy
retrieval vs own substrate" call as the actual decision Lihu owns —
not the Nexus call.**

## Patterns across the four polls

**Convergences (all four polls land on these):**

- **Access control is the load-bearing unknown.** P1 flags the
  subprocessor + RBAC opacity; P2 documents the two-layer mental model
  Effi already runs (RLS floor, tool ceiling) with `tool_scope` doing
  load-bearing work RLS cannot; P3 names predicate-tampering as the
  blocker for Replace; P4 ranks Glean/Sana off-axis because they don't
  model Effi's internal/external × project tenancy. **One question to
  Pinecone settles three of these:** is `where` token-bound and
  server-injected, or caller-supplied?
- **Maturity gate is real.** P1: zero named Nexus customers, KRAFTBench
  methodology unpublished, no Nexus pricing, GA undated. P3: schema
  mutability, SDK availability, citation contract — all unanswered.
  P4: early-access SLA unknown. Engagement cost today is a form
  submission and a probe — not a roadmap commitment.
- **Lock-in via KnowQL is non-trivial.** P1: no spec, no second
  implementation. P3: would force a Python proxy layer if `where` is
  caller-supplied. P4: compiles to a *shape Pinecone defines*, not ours.
  Lean across all three: keep KnowQL behind an internal `Retriever`
  interface, never as the contract.

**Dialectic — preserve, don't average:**

- **P3 vs P4 disagree about which decision is load-bearing.** P3 frames
  it as *where Nexus enters first* (Replace / Alongside / Specific-
  surface) and leans Specific-surface. P4 frames the deeper call as
  *buy retrieval or own the substrate* — and explicitly notes Nexus
  isn't a hosted `poc-knowledge-store`; they answer different questions
  on different axes (Nexus pre-computes structured answers; PoC keeps
  the artifact and derives the index). **Both are right.** P3's frame
  is the right *engineering* call once we've decided to engage; P4's
  frame is the right *positioning* call that determines whether we
  engage at all. Lihu owns P4's call; the team owns P3's.
- **P2 vs P3 on what Nexus would actually replace.** P2 makes clear
  VAIS-side complexity is *write-side* (LRO-resume, GCS staging,
  per-project lifecycle) — VAIS reads are simple. P3 frames Nexus as
  replacing the *read ceiling*. So Replace would replace ~one layer
  out of two, leaving Postgres + RLS + curator UIs + sync workers +
  ingestion all in place. The "Nexus replaces VAIS" mental model is
  generous to Nexus.

**Cluster signal (P4 names this explicitly, worth elevating):**

The team's instinct has converged on the *same* substrate shape three
times — `slack-ingest-poc`, `poc-knowledge-store`, and now this round's
read of the field. One bag, citations as first-class, no per-kind table
tax. **This is the third+ touch and is itself the finding** (per
cluster-search discipline). The recurring instinct is real product
intuition — but P4's axis-miss observation is the disciplining footnote:
Nexus *honors* the instinct on a different axis (pre-compute structured
answers) than the team has been reaching for (keep raw artifacts,
derive index). Don't conflate "this feels right" with "this matches our
shape."

## Decisions Lihu needs to make

Distilled from D1–D3 (P1) + D1–D4 (P3) + D-1–D-3 (P4) + P2's implicit
calls, into the load-bearing four.

**DL1 — Buy retrieval, or own the substrate? (positioning, Lihu only)**
- Decision: Is Effi's competitive surface (a) agent + retrieval
  quality, or (b) the project-tenanted heterogeneous knowledge graph?
- Options: (a) buy direction → Nexus / Vectara are on the table;
  (b) own direction → finish VAIS, iterate poc-knowledge-store, Nexus
  is replacing the wrong layer.
- Lean: **ambiguous — this is a positioning call, not a tech call.**
  Sam refuses to lean. P4 names it correctly.
- Why: every downstream infra decision flows from this; getting it
  wrong is months of rework either direction.
- Price: hours of Lihu's thought; nothing else changes until decided.
- Risk: deciding too quickly bakes lock-in (a) or sunk-cost into a
  pre-production substrate (b); deciding too slowly leaves the team
  shipping under both hypotheses.
- For Lihu to weigh: where is Effi's moat? With (a), Nexus is a
  hedge worth probing; with (b), Nexus is a distraction.

**DL2 — Engagement posture for Nexus EA (independent of DL1)**
- Decision: do we engage with Nexus EA *now* or wait for GA + first
  external benchmark reproductions?
- Options: (i) sign up for EA, treat as a strict research probe, hard
  cap at one wire-probe + bounded eval; (ii) wait 3–6 months for
  KRAFTBench methodology + GA + independent reproductions; (iii) skip.
- Lean: **(i)**, regardless of DL1. Cost is a form + ~1 engineer-week
  + one project's data (synthetic or fixtures). Gives us the only
  meaningful read available today and unblocks DL1 empirically.
- Why: P1 is right that public information is insufficient for build-
  vs-buy; P3 is right that without a wire-probe on `where`, every
  larger decision is speculation; P4 is right that EA gives us the
  one thing it gives us — actual measurement.
- Price: ~1 engineer-week + Pinecone-side compute (likely waived in
  EA). Plus reputational signal — Pinecone learns we're shopping;
  send a junior under "research" framing.
- Risk: scope creep ("if status works, why not summary"). Mitigation:
  hard cap and a written disengagement criterion.

**DL3 — KnowQL as portable target vs Pinecone-internal API**
- Decision: if we engage at all, do we bind retrieval-side code to
  KnowQL, or wrap behind our own `Retriever` interface?
- Options: (a) KnowQL is our retrieval contract (low glue, high
  lock-in); (b) thin internal interface, KnowQL one possible
  backend (more glue, low lock-in).
- Lean: **(b).** Convergent across P1, P3, P4 — KnowQL has no spec,
  no second implementation, no portability story. Cost of (b) is
  ~50 lines of adapter; cost of (a) if Nexus stalls or prices badly
  is a full retrieval-path rewrite.
- Why: matches how we already bind `access_filter` at construction
  time in `build_vais_query_service`; Nexus is one more backend
  behind the same seam.
- Price: small adapter layer + a flatness penalty (we may not get the
  full ergonomic benefit of declarative `confidence`/`budget`).
- Risk: the abstraction lies — if KnowQL's value is the declarative
  composition itself, wrapping it removes the thing we'd be paying
  for. Mitigation: only wrap once we've measured the un-wrapped
  ergonomic delta in the wire-probe.

**DL4 — VAIS in flight: continue, pause, or accelerate?**
- Decision: independent of DL1/DL2, what happens to the GFS→VAIS
  migration *this quarter*?
- Options: (a) continue at current pace — VAIS is current production,
  finish it; (b) pause new VAIS rollout, hold workspaces on GFS until
  DL1 resolves; (c) accelerate VAIS (it's the safer bet across all
  DL1 outcomes).
- Lean: **(c) — accelerate.** P2 is unambiguous: GFS-side complexity
  is the dominant pain (162-experiment hardening saga, 6× fan-out
  cost, 100-char preview citation truncation, 6 known production
  bugs); VAIS replaces almost all of it with a single search call.
  VAIS-finishing is *also* the path of least regret under any DL1
  outcome — including (b) own-substrate, because VAIS buys time
  while poc-knowledge-store iterates to production-shape.
- Why: even if DL1 lands on (b), VAIS is the production retrieval
  layer between now and then. Even if DL1 lands on Nexus (a), VAIS
  is the migration target Nexus would *itself* replace — making it
  the realistic baseline to measure against.
- Price: continued investment in code we may retire. P4 calls this
  "sunk if we adopt Nexus" — accept that price; the alternative is
  staying on a structurally broken upload path.
- Risk: VAIS write-side has its own unverified claims (P2 + P4: dense-
  text PDF immunity is *assumed*, not proven). Wire-probe WP-3 below.

## Wire-probes

Prioritized. (i) and (ii) are small enough to do this week.

1. **Predicate-tampering probe (settles DL1+DL2+DL3 floor).** Send a
   KnowQL query as "external" with `where` omitted. If internal rows
   leak, regime is advisory and Replace is permanently off the table;
   we'd proxy. **~1 day** once EA is granted.
2. **Subprocessor question (P1 D3).** Email Pinecone EA team: "does
   Nexus add an LLM subprocessor (Anthropic?) on top of vanilla
   Pinecone, and what's the DPA delta?" **~1 hour.** Do *before*
   any data touches Nexus.
3. **Specific-surface probe (P3 D4 + P4 WP-1).** Pick one structured-
   status question Effi answers badly today; ingest one fixture
   project (1 fathom transcript + 2 emails + 1 note); run the same
   5 demo questions. Compare answer quality + citation grain to
   VAIS. **~1 engineer-week.** This is the actual EA engagement.
4. **VAIS dense-text immunity (P2 + P4 WP-3).** GFS shows 60% failure
   on 2000-page dense PDFs. Has anyone reproduced this on VAIS, or
   is "VAIS is immune" assumed? **~½ day.** Independent of Nexus —
   this is hygiene on DL4.
5. **PoC at scale (P4 WP-2).** Embedded LanceDB at ~10⁴ real items
   (one team email box). P95 search, index rebuild, disk footprint.
   **~1 day.** Only matters if DL1 leans (b).

## Open ends

- **DL1 is unresolved and Sam refuses to lean.** Surfacing it as a
  decision is the synthesis; resolving it is Lihu's. Every other
  decision in this round is downstream of it.
- **KRAFTBench methodology** — "coming in the coming weeks" per
  Pinecone. Until it publishes, performance numbers are unverifiable.
- **Nexus pricing shape** — completely opaque (per-artifact?
  per-compile? per-context? per-query? platform fee?). Compile-time
  LLM cost almost certainly hides somewhere.
- **`tool_scope` retraction is its own lesson.** P2 surfaces that
  the long block-comment in `mcp_builder.py:128-146` retracts an
  earlier "transitional" framing — `tool_scope` is now permanent
  infrastructure because RLS cannot cover internal-creator-external-
  audience. This is a zettel candidate independent of Nexus.
- **Cluster of three** — slack-ingest-poc + poc-knowledge-store +
  this round all converge on bag-of-files. P4 names it; we should
  capture it as a z026/z028 cluster zettel rather than re-discover
  it a fourth time.

## Source pointers

- `usegin/research/pinecone-nexus/p1-product-and-risk/whiteboard.md`
  — product surface, risk, comparable products, EA gating
- `usegin/research/pinecone-nexus/p2-effi-retrieval-reality/whiteboard.md`
  — what Effi does today: GFS multi-store fan-out, VAIS path,
  two-layer access control, sync pipeline pain
- `usegin/research/pinecone-nexus/p3-architectural-fit/whiteboard.md`
  — Replace/Alongside/Specific-surface flavors, access-control
  regimes, citation-flow shift
- `usegin/research/pinecone-nexus/p4-alternatives/whiteboard.md`
  — buy-vs-build option space, Nexus vs poc-knowledge-store axis
  miss, Glean/Sana off-axis, cluster-of-three signal
