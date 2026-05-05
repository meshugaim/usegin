# P4 — Alternatives to Pinecone Nexus

Angle: map the option space honestly. Nexus is one answer to "how should
Effi do agent-grounded retrieval"; what are the others, and when does
buy beat build?

## Top — the click

The option space splits cleanly into three strategic postures: **finish
the in-flight migration (VAIS)**, **buy a hosted knowledge engine
(Nexus, Glean, Sana, Vectara)**, or **own the substrate (poc-knowledge-
store, JSONB, vanilla Pinecone vector DB)**. Nexus is *not* a hosted
version of `poc-knowledge-store` — they answer different questions.
Nexus compiles structured task-specific artifacts ahead of time
(KnowQL, typed outputs, field-level citations); the PoC keeps the
artifact (the file) as the record and derives the index. **Same
intuition (one bag, citations as first-class), opposite axis (Nexus
pre-computes structured answers; PoC keeps unstructured-but-rich
artifacts and retrieves at read time).** The buy-vs-build call comes
down to one question Lihu has to answer: is Effi's competitive surface
(a) the agent + retrieval quality, or (b) the project-tenanted
knowledge graph itself? If (a), buy. If (b), the bag-of-files instinct
is telling the truth and Nexus would replace the wrong layer.

## Middle — the body

### Comparison table

One row per option. "Fit-Effi" rates fit with our two-tier access
(internal/external) + project tenancy.

| Option | What it is (1 sentence) | Wins | Loses | Fit-Effi | Posture |
|---|---|---|---|---|---|
| **1. Stay-the-course (VAIS)** | Finish the GFS→VAIS migration; Vertex AI Search is the retrieval layer behind the agent. | Already in production code (`python-services/agent_api/vais/`); Google-hosted; access-level filter at query time works; team has cycles invested. | Re-creates GFS friction #8 (DB+index dual store) on a different vendor; per-kind ingestion plumbing untouched; Google's processing has the 60% dense-text-failure cliff documented in `GFS_FINDINGS.md` — **assumed-but-unproven** that VAIS is immune. | Medium. Solves retrieval, NOT the heterogeneity / per-kind-migration tax. | Build (continue) |
| **2. Pinecone Nexus** | Hosted "knowledge engine" — compiles ingested data into structured task-specific artifacts (KnowQL: ask/where/ground/shape/confidence/budget); typed outputs with field-level citations. | Pre-compiled artifacts = cheap query-time tokens; field-level citations align with Effi's citation contract; managed; "Contexts" map to project/role/team. | Early access (timeline + maturity unknown); compiles to a structured shape *Pinecone defines*, not ours; lock-in to KnowQL semantics; pre-compile assumes a known question shape — agent open-ended chat may not benefit; pricing unknown. | Medium-high *if* tenancy works. Two-tier (internal/external) maps onto Contexts but unverified. | Buy |
| **3. Pinecone vanilla vector DB** | Just the vector store + filters; we BYO chunking, ingestion, citation-stitching, knowledge layer on top. | Mature, predictable, scales; we keep full control of the shape; cheap if we already have ingestion. | Doesn't remove any of the 10 friction points — it's a peer to LanceDB, not to Nexus; we still hand-build everything `poc-knowledge-store` already builds. | Low marginal value over LanceDB-embedded. | Build |
| **4. `poc-knowledge-store`** | Markdown-on-disk + frontmatter + LanceDB-embedded; one file per data item; index is derived state. | Collapses 9 of 10 frictions in `0-friction.md`; team's instinct converged on this shape three times; PoC green at 7 demo checks; aligns with `usegin/zettel/` substrate. | RLS-at-scale unproven; multi-writer concurrency unproven; production migration cost unwritten; embedded LanceDB at 10⁵+ items unmeasured. | High in posture, **unverified at production-scale**. Folder-scoping covers demo; two-tier access needs design. | Build (iterate) |
| **5. JSONB-on-Postgres** | All data items as `jsonb` rows in one Postgres table; pgvector for retrieval; RLS on the row. | Zero new infra; RLS-for-free at the row-level (covers two-tier); team knows the tooling; "boring-correct". | Loses on LLM-read-fit (hand-build pgvector retrieval = re-creates GFS friction #8); `jsonb_path` clumsy; doesn't deliver on the artifact-IS-the-record claim. | High on access-control fit, low on substrate claim. | Build |
| **6a. Glean** | Enterprise search/AI-assistant platform — connectors to ~100 SaaS apps, semantic search + agentic chat. | Mature, multi-tenant, SOC2; "permissions mirroring" copies source-system ACLs; large connector library. | Built for the *enterprise IT* shape (one company's whole knowledge), not the *Effi* shape (multi-customer, project-scoped, two-tier). Wrong axis. Pricing ~$40/seat/month. | Low — wrong tenant shape. | Buy (off-axis) |
| **6b. Sana AI** | Knowledge + learning platform; enterprise copilot; integrations + chat. | Polished UX; enterprise positioning. | Same axis problem as Glean — built around employee-facing knowledge, not white-label customer-project knowledge. | Low. | Buy (off-axis) |
| **6c. Vectara** | Hosted RAG-as-a-service: ingest docs → semantic search + grounded generation with citations. | Closer fit to Effi than Glean/Sana — it's the retrieval+citation layer Effi already has, hosted. Mature. | Doesn't solve heterogeneity or per-kind ingestion; replaces VAIS but not the data-item-shape problem. Adds a vendor. | Medium — VAIS-shape replacement, not a Nexus competitor. | Buy |

### Per-option commentary

**1. VAIS (stay the course).** The honest read: VAIS solves *retrieval
fan-out*, not *heterogeneity*. The 112 plumbing-migrations debt sits
under VAIS just like it sat under GFS. If we finish VAIS and stop, we
have a faster index over the same per-kind-table substrate. Wins:
nothing new to buy or learn; cycles already spent. Loses: the friction
that made the team reach for `poc-knowledge-store` in the first place
is still there.

**2. Pinecone Nexus.** The most interesting buy option. Three real
wins map onto Effi's pain: (a) field-level citations match our
citation contract; (b) Contexts are a tenancy primitive that *might*
absorb internal/external + project; (c) pre-compiling artifacts is
exactly what Effi does badly today (per-call agentic search burns
tokens). Three real risks: (a) early access — timeline / SLA / pricing
unknowns; (b) KnowQL is a *shape Pinecone defines* — if our agent is
open-ended chat against project knowledge, the pre-compile may miss;
(c) lock-in is real once retrieval moves into KnowQL. Worth a
wire-probe before committing.

**3. Pinecone vanilla vector DB.** Honestly: not the right comparison.
Vanilla Pinecone is a peer to embedded LanceDB — it's the index, not
the knowledge layer. If we already trust LanceDB-embedded (as the PoC
does), there's no marginal reason to switch to a hosted-paid vector
DB. Useful only if we're forced off LanceDB by scale.

**4. `poc-knowledge-store` — iterate.** The PoC's strongest signal is
*convergence*: `usegin/zettel/`, slack-ingest-poc, and `get_data_summary`
all routed around SQL toward the same shape. The PoC's weakest claim
is *production*: 1 project, 3 fixtures, mock embeddings, no real RLS.
Iterating means picking one corner (suggest email per VERDICT.md),
wiring a real embedder, wiring app-layer access checks, re-running the
demo at ~10³ items. That converts "heterogeneity proven" → "production-
shape proven on one corner."

**5. JSONB-on-Postgres.** The runner-up. Wins on the access-control
axis (RLS-for-free, two-tier propagates), loses on the substrate axis
(we still hand-build retrieval, citations, cross-kind merges). Best fit
if we needed a substrate *this quarter for a feature already in
flight*. We don't.

**6. Other commercial knowledge engines.** Glean and Sana are off-
axis — they target the *one-company-many-employees* shape. Effi is
*one-platform-many-customer-projects-each-with-internal-and-external-
users*. Connector-rich enterprise-search platforms don't model that
tenancy and would have to be hammered to fit. Vectara is on-axis but
serves the VAIS slot, not the Nexus slot.

### Nexus vs `poc-knowledge-store` — feature-by-feature

The most-load-bearing question. Treating both as candidates for the
"how Effi remembers a project" layer.

| Feature | Pinecone Nexus | `poc-knowledge-store` | Same axis? |
|---|---|---|---|
| **What's stored** | Compiled, structured task-artifacts (the result of pre-running KnowQL queries against ingested sources). | The artifact itself (`.md` with frontmatter); the index is derived. | **No** — Nexus stores answers; PoC stores questions' raw material. |
| **Heterogeneity** | Connectors per source (warehouse / CRM / Slack / docs); shape converges on Pinecone's KnowQL types. | Per-kind frontmatter; shape stays the kind's natural shape. | Both kill per-kind-table tax; Nexus kills it by hosted connectors, PoC by `mkdir <kind>/`. |
| **Citations** | Field-level, with confidence tiers and provenance. | File-path + line-range; chat layer assembles; demo-proven. | **Same intuition.** Nexus is more advanced (field-level beats file-level). |
| **Read path** | KnowQL declarative query → typed output. | One `search()` over LanceDB → raw passages → LLM synthesis. | **Different.** Nexus pre-compiles for known question shapes; PoC retrieves at read time and lets the LLM compose. |
| **Tenancy** | Contexts (per team/role). | Folder-per-project; access enforced app-layer (PoC scope only). | Both viable; Nexus is hosted, PoC is BYO. |
| **Two-tier (internal/external) fit** | Likely encodable in Contexts; unverified. | Encodable in frontmatter + filter; unverified at scale. | Both unverified; both require design. |
| **Open-ended agent chat** | Pre-compile assumes the agent's questions cluster around known shapes. | Open-ended retrieval is the design point. | **PoC wins this axis** if Effi's agent is genuinely open-ended. |
| **Lock-in** | Vendor — KnowQL semantics, hosted infra, early-access pricing. | None — `.md` files + LanceDB; rebuildable. | PoC wins. |
| **Time-to-value** | Hours to ingest if connectors fit; days if they don't. | Days to wire one corner; weeks for production-shape on one provider. | Nexus wins on the happy path. |
| **Maturity** | Early access. | PoC at 7 demo checks; not production. | Both immature; Nexus has Pinecone behind it. |

**The intuition match, the axis miss.** Nexus and the PoC both honor
the team's instinct: heterogeneous data, one bag, citations as first-
class, no per-kind table tax. They differ on *what they pre-compute*.
Nexus pre-computes structured artifacts (an answer cache shaped by
KnowQL). The PoC pre-computes nothing — the file IS the artifact, the
index is derived, retrieval is at read time. Effi's actual workload
(agentic chat over a project) is closer to the PoC's posture than to
Nexus's. **Nexus serves the instinct on a different axis than the team
has been reaching for.**

## Bottom — the open ends

### Dilemmas (z026 shape)

**D-1 — buy retrieval or own the substrate.** The strategic call
underneath every option. *If Effi's competitive surface is the agent +
retrieval quality*, Nexus / Vectara are appealing — pay someone to
make retrieval excellent. *If Effi's competitive surface is the
project-tenanted knowledge graph itself* (two-tier access + project +
heterogeneous integrations are differentiators), then owning the
substrate is the right call and Nexus would replace the wrong layer.
This needs Lihu's input — it's a *positioning* call, not a tech call.
Cost-of-wrong: high either way (vendor lock-in vs. months of
iteration). Lean: ambiguous; depends on positioning.

**D-2 — VAIS-finish vs. PoC-iterate vs. Nexus-probe.** Three valid
next moves, all defensible. (a) Finish VAIS — known, in flight, cheap;
doesn't address heterogeneity. (b) PoC-iterate one corner (email) —
converts "heterogeneity proven" to "production-shape proven on one
corner"; ~weeks; doesn't ship customer value directly. (c) Nexus
wire-probe — joins early access, ingests one project, measures
KnowQL-fit; unblocks the buy-vs-build call empirically. *These are
not mutually exclusive in time.* Lean: do (c) cheap (a few hours of
sign-up + one project's worth of data) before deciding (a) vs (b).

**D-3 — what to do about VAIS in flight.** Independent of the buy-vs-
build call: VAIS is partway done. If we adopt Nexus, VAIS work is
sunk; if we iterate the PoC, VAIS is still the current production
search and stays. Don't conflate "should we buy Nexus" with "should
we stop VAIS today."

### Open questions

- **Q1.** Does Nexus accept `.md` + frontmatter directly, or does
  ingestion require source-system connectors? (If it accepts raw
  artifacts, the migration story changes.)
- **Q2.** Is KnowQL a query layer over Nexus, or is it the only way
  to query? (i.e. is there an open-ended retrieval mode?)
- **Q3.** Pricing tier for Effi-shape usage (many small projects, each
  with two access tiers, mostly text+meeting-transcript volume).
- **Q4.** What's the SLA on early-access? Production-readiness window?
- **Q5.** Do Nexus Contexts support nested tenancy
  (workspace → project → access-tier)? P3's job to map.
- **Q6.** At LanceDB-embedded ~10⁵ items, what's P95 search latency?
  PoC didn't measure — would need a wire-probe before betting on
  iterate.

### Gaps that need a wire-probe

- **WP-1 (Nexus).** Sign up for early access, ingest one fixture
  project (use the PoC's fixtures: 1 fathom transcript + 2 emails +
  1 note), run the same 5 demo questions. Does Nexus answer them with
  citations? How does answer quality compare to LanceDB-hybrid? Time-
  box: 4 hours.
- **WP-2 (PoC at scale).** Embedded LanceDB with ~10⁴ real items
  (suggest: dump of one team email box). Measure P95 search, index
  rebuild time, disk footprint. Time-box: 1 day.
- **WP-3 (VAIS dense-text immunity).** GFS findings show 60%
  failure on dense-text 2000p PDFs. Has anyone reproduced this on
  VAIS? Or is it assumed-better? P2's slot but worth flagging.

### Friction zettel candidates

- The "buy or build the knowledge layer" question has now surfaced
  three times in the team's history (slack-ingest-poc, PoC verdict,
  this round). Worth a z026 dilemma capture.
- "Effi's competitive surface = retrieval-quality vs. tenancy-shape" —
  positioning question that affects every infra decision; under-stated
  in `PRODUCT.md` as written.
