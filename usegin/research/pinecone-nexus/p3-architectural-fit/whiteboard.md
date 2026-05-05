# P3 — Architectural Fit between Pinecone Nexus and Effi

Angle: how Nexus would slot into Effi if we adopted it. Three flavors:
Replace, Sit-alongside, Specific-surface. Paper-sketch only — no
implementation cost or vendor comparison.

## Top — the click

**Specific-surface is the only flavor that fits today; Replace is
disqualified by a single missing piece — server-enforced
per-row access predicates we control end-to-end.** Pinecone's marketing
calls `where` an "access-control enforcement" primitive, but the
product page is silent on whether predicates are server-trusted vs
caller-supplied. In Effi the access-control story is two-layered
and load-bearing (RLS floor + tool-layer ceiling, see
[`project_rls_floor_tool_ceiling.md`](/home/vscode/.claude/projects/-workspaces-test-mvp/memory/project_rls_floor_tool_ceiling.md))
and our VAIS path treats the access filter as construction-time
immutable that the agent cannot widen
([`agent_api/vais/query_service.py:117-167`](/workspaces/test-mvp/python-services/agent_api/vais/query_service.py)).
Until we wire-probe Nexus and confirm `where` is enforced server-side
under a per-session signed token (or equivalent), Replace is unsafe —
external users would be one prompt-injection away from internal data.
**Sit-alongside is plausible but expensive** (two indexing pipelines,
two citation shapes, dual ingest). **Specific-surface is the
right first bet** — pick one read-mostly question that Effi answers
badly today (e.g., "what's the status of project X across emails +
meetings + Linear?" — a structured-knowledge query with `shape`-able
output) and stand Nexus up next to VAIS on that surface only.

## Middle — the body

### What Nexus is, in our vocabulary

KnowQL = a query DSL with six primitives that our agent (or our
backend) would compose into a single call:

| Primitive | What it does | Effi analog today |
|---|---|---|
| `ask` | goal + output schema + which contexts | system prompt + `search_files` query |
| `where` | deterministic predicates, "access-control enforcement" | `access_filter` injected in `VaisQueryService.__init__` + RLS |
| `ground` | field-level citations w/ confidence tiers | VAIS chunk → frontend citation chip |
| `shape` | typed fields returned exactly | not present — Claude free-forms the answer |
| `confidence` | grounded vs inferred separation | not present — Claude says "I think" or doesn't |
| `budget` | depth tier + latency + tokens | implicit (Haiku model + Claude's own budget) |

Tenancy unit = "context" — Pinecone's product page describes it as a
curated artifact set "for one team, role, or workflow" (Sales /
Finance / Support / Marketing examples). Status = early access only.
Ingestion = "Push/Fetch" but no connector list published.

### Flavor 1 — Replace (Nexus replaces VAIS end-to-end)

**What changes**

- `python-services/agent_api/vais/` is deleted in spirit. The
  `search_files` MCP tool is replaced by a `knowql_ask` tool, or
  removed entirely if we move KnowQL composition into the backend
  (Claude calls `chat`, backend composes the KnowQL on its behalf).
- Per-project VAIS DataStore + Engine ([`store_lifecycle.py`](/workspaces/test-mvp/python-services/agent_api/vais/store_lifecycle.py))
  → per-project Nexus "context".
- `metadata.py`'s 24-field `METADATA_SCHEMA` ([`config.py:54-94`](/workspaces/test-mvp/python-services/agent_api/vais/config.py))
  → Nexus context schema (presumably their `shape` definitions).
- `upload.py`'s GCS-staging + JSONL + LRO pipeline →
  Nexus push API (or pull, if they support reading from GCS / Drive
  natively).
- Frontend citation rendering shifts from chunk-with-text to
  field-level — UI work in `nextjs-app/`.

**What breaks (or needs proving)**

1. **Access control parity.** This is the bet. Today
   `AccessContext.for_role` builds a fail-closed
   `access_level: ANY("external")` filter that the agent cannot
   widen ([`query_service.py:131-143`](/workspaces/test-mvp/python-services/agent_api/vais/query_service.py)).
   For Nexus to replace this, the `where` clause has to be either
   (a) injected into a session-bound token Pinecone validates, or
   (b) stripped/overridden if the caller tries to widen, or
   (c) we put a Python proxy in front of every Nexus call that
   re-injects the predicate — at which point we still own the
   ceiling and Nexus only owns the floor. Worst case (b)/(c) is
   livable; (a) would actually move the trust boundary.
2. **RLS floor.** RLS today isn't just for Effi — it lets curators
   open `is_excluded=true` rows in management UIs
   ([`project_rls_floor_tool_ceiling.md`](/home/vscode/.claude/projects/-workspaces-test-mvp/memory/project_rls_floor_tool_ceiling.md)).
   Nexus does *not* replace RLS; it replaces only the search ceiling.
   So "Replace VAIS" still leaves Postgres + RLS in place, and we
   keep all `is_excluded` / curator-UI plumbing. Nexus replaces ~one
   layer, not two.
3. **The schema coupling.** Our VAIS schema has email-specific,
   meeting-specific, attachment-specific fields baked in
   ([`config.py:60-93`](/workspaces/test-mvp/python-services/agent_api/vais/config.py)).
   Nexus contexts presumably have their own schema model; mapping
   `entity_type` ∈ {file, email, meeting, attachment} into Nexus's
   context model is non-trivial — do we get one context per project,
   or one context per (project × entity_type)? Product page does not
   say.
4. **The agent loop.** Replace simplifies the loop *if* `knowql_ask`
   subsumes search + synthesis ("knowledge engine, not retrieval
   system"). But that's also where it gets risky — Claude today does
   the synthesis, with our prompts, our tone, our refusal patterns.
   Handing synthesis to Nexus means we lose direct control over how
   Effi sounds. For a service-company product where voice matters,
   that's a real cost.
5. **In-flight migration trauma.** We're already mid-migration GFS →
   VAIS ([`PRODUCT.md:13`](/workspaces/test-mvp/PRODUCT.md)).
   Stacking another retrieval migration on top of an unfinished one
   is a known-bad pattern.

**What stays**

- Supabase + RLS + curator UIs.
- Sync workers, OAuth flows, Unified.to integrations — Nexus is
  downstream of all of them.
- Chat session model, conversation history.

**Migration cost**: large. Re-index every project, dual-write window,
retire VAIS only after confidence — months, not weeks.

**Citation flow today vs Replace**

```
TODAY:    sync → VAIS chunk (struct_data + content) → search_files
          → AccessContext-filtered chunks → Claude → "Source: X.pdf, p.3"
REPLACE:  sync → Nexus context push → knowql_ask(ask, where, ground, shape)
          → field-level citation tuples → Claude (or no Claude) → UI renders
            "field=status, value=blocked, source=email-id-42"
```

The Replace citation is *richer* (field-level beats chunk-level for
factual questions) but *less narrative* (chunks let Claude quote;
field tuples invite tabular UIs). Both have a place. Today's Effi UI
is conversational, not tabular — Replace would force UI work to make
field-level citations feel native.

### Flavor 2 — Sit alongside (Nexus for structured Q, VAIS for chunks)

**What changes**

- New tool `knowql_ask` registered next to `search_files`. Agent
  picks based on question shape — "what's the status of X" →
  `knowql_ask`, "summarize this meeting" → `search_files`.
- Sync worker dual-writes: every data item that lands in VAIS also
  lands in a Nexus context. Push or pull.
- Two access-control implementations to maintain — the AIP-160 →
  VAIS ANY() translator ([`query_service.py:46-113`](/workspaces/test-mvp/python-services/agent_api/vais/query_service.py))
  and a parallel KnowQL `where` builder.

**What breaks**

1. **Two truths.** When Nexus and VAIS disagree about a fact (Nexus
   says "status=blocked" with field-citation, VAIS says "this email
   says they unblocked it"), which does Effi believe? The agent
   needs a tiebreaker policy. Likely: trust the structured answer,
   surface the chunk as caveat. Needs designing.
2. **Doubled ingest cost.** Every Drive sync, every Fathom transcript,
   every email — pushed to two indices. Doubles GCS egress, doubles
   sync-worker-side time-to-searchable.
3. **Schema drift.** VAIS schema and Nexus schema evolve
   independently. ENG-3030's "two-hop filtering" workaround ([`config.py:46-52`](/workspaces/test-mvp/python-services/agent_api/vais/config.py))
   would need a Nexus equivalent or a divergent capability matrix.
4. **Agent confusion.** Two retrieval tools means Claude must choose
   correctly. Empirically (from `feedback_be_laconic` lineage), tool
   choice is a known foot-gun — Claude tends to hammer one tool.

**What stays**

- Everything VAIS does today still works; this is purely additive.
- Citation-flow for chunk-style answers unchanged.

**Migration cost**: medium. Build the second pipeline, keep both
running, accept dual cost indefinitely.

### Flavor 3 — Specific surface (Nexus powers one feature)

**Concrete pick**: structured-status queries — "what's the status of
project X" / "who's blocking Y" — composed as a single
`knowql_ask({ask: "status of <project>", shape: {status: string,
blockers: list, last_update: date}, where: project_id=X AND
access_level IN ($role-allowed)})`. Today this question routes
through `search_files` which returns chunks; Effi must read every
chunk and synthesize. Nexus's `shape` + `confidence` + field-level
`ground` is genuinely a better fit for this shape of question.

**What changes**

- One new endpoint: `POST /api/v1/status-query`. Backend composes
  KnowQL, calls Nexus, returns shaped JSON to Next.js. Bypass Claude
  entirely for this surface, or have Claude *route* to it.
- One small Nexus context per project, populated from a Postgres
  view (status table joined with email / meeting / Linear sources).
  Ingest is a periodic Postgres → Nexus job, not the full sync.
- Frontend gets a structured-status panel.

**What breaks**

- Almost nothing, because this is greenfield. The only risk is
  scope creep — "if status works, why not summary, why not search."
  Discipline: ship status, learn, then re-evaluate Sit-alongside.

**What stays**

- VAIS + chunk retrieval untouched.
- Agent loop untouched (status route is non-agent).

**Migration cost**: small. One new context, one new endpoint, one
new UI panel. Reversible — if Nexus disappoints, delete the panel.

### Cross-cutting answers to the in-scope questions

**Workspace/project tenancy → Nexus contexts.** Map = one Nexus
context per project (not per workspace). Reason: today's per-project
VAIS DataStore ([`store_lifecycle.py`](/workspaces/test-mvp/python-services/agent_api/vais/store_lifecycle.py))
is the working unit; same shape moves cleanly. Workspace-level
contexts would re-introduce a cross-project leak risk we don't have
today. Per-user contexts are wrong (would explode N×M with project
membership). Per (project × entity_type) is possible but doubles
tenant count for unclear gain.

**`access_level` as `where` predicate — safe?** Marketing says
"access-control enforcement"; product page does not say
"server-trusted". This is the load-bearing unknown. Three regimes,
in increasing order of trust:

1. *Advisory* — caller can omit / widen the predicate. Unsafe;
   needs proxy in front.
2. *Required field, caller-supplied* — Nexus rejects queries
   without a `where`, but the caller picks the value. Same as
   advisory in adversarial cases.
3. *Token-bound* — caller's session token includes role claims;
   Nexus injects the predicate server-side regardless of what the
   caller writes. This is what we'd need.

**Wire-probe required** before adoption. Send a query as "external"
that *omits* the access predicate; if results include
internal-labeled rows, regime is (1) or (2) and we proxy.

**RLS floor / tool ceiling — does Nexus respect or replace?**
Replaces ceiling, not floor. Nexus has no view of Postgres rows —
it sees what we push. So curator UIs (Postgres + RLS) are
untouched. The `is_excluded=true` pattern needs re-implementing as a
Nexus push-time filter (don't push excluded rows) or a runtime
`where` clause. Push-time filter is cleaner; runtime `where` is more
flexible (curator can flip a flag and the Nexus index doesn't need
re-ingest).

**Ingestion — push, pull, both?** Push fits our shape better. Our
sync workers already exist, already authenticate, already normalize.
Pull would mean Nexus needs OAuth into Drive/SharePoint/Fathom
itself — duplicative and a security headache (more keys, more
consent screens). Push from sync-worker is a one-line addition per
connector if Nexus has a clean push API.

**Citation flow change for the user.** Today: chunk preview text +
filename. Replace/Alongside: field-level tuple + confidence tier.
Visible UX shift — for "what's the status" questions, the new shape
is *better* (the answer IS a field). For "summarize the meeting",
the new shape is *worse* (no narrative, no quote). Mixed picture →
Specific-surface again wins.

**Agent loop — `search_files` vs `knowql_ask`.** Replace can go two
ways: either (a) keep an `mcp__knowql__ask` tool and let Claude
compose KnowQL — Claude is good at this, but tool surface gets fat,
or (b) Claude calls a high-level `query` tool, backend composes
KnowQL deterministically — simpler tool surface, less flexible.
Sit-alongside forces (a). Specific-surface can avoid the agent loop
entirely (route from Next.js direct to backend).

**Failure modes by example.**

1. *Nexus disagrees with RLS.* Curator deletes a project membership
   in Postgres. RLS immediately blocks the user from SELECT. Nexus
   index is stale — until the next sync, the user can still get
   results from the deleted project. Mitigation: sync membership
   deltas to Nexus; until then, gate `knowql_ask` calls behind a
   live Postgres membership check (re-introducing the floor at the
   tool layer).
2. *Access predicate wrong.* External user gets `where:
   access_level: "external"` injected; an upload was mis-labeled as
   "external" in the metadata pipeline ([`metadata.py:80-85`](/workspaces/test-mvp/python-services/agent_api/vais/metadata.py)).
   User sees a leaked field. Same class of bug as today — leak
   surface is metadata-correctness, not query-time. No new exposure
   from Nexus per se.
3. *Schema doesn't fit the question.* User asks "did we send the
   contract?" Nexus context schema doesn't have a "contract sent"
   field; `shape: {contract_sent: bool}` returns
   `confidence=low, value=null`. Effi has to fall back to chunk
   search. Sit-alongside handles this naturally; Replace forces a
   schema sprawl problem.

## Bottom — the open ends

### Dilemmas (z026 shape)

**D1 — Access-control trust model.**
Decision needed: regime under which we'd trust Nexus's `where`.
Options: (a) server-trusted, token-bound (adopt freely); (b) caller-
supplied + we proxy (adopt with extra layer); (c) advisory only
(disqualifies Replace, OK for Specific-surface where blast radius is
one feature).
Lean: (b) is the realistic middle and acceptable for Specific-
surface; we'd need (a) before considering Replace.
Why: matches how we already bind `access_filter` at construction
time in [`build_vais_query_service`](/workspaces/test-mvp/python-services/agent_api/vais/query_service.py).
Price: a Python proxy on every Nexus call ≈ 30-50 lines + tests.
Risk: proxy is bypassable if Nexus exposes a direct SDK path that
isn't the proxy. Mitigation: lock the API key behind the proxy
service, never ship to client.

**D2 — Tenancy granularity.**
Decision needed: one Nexus context per project, per (project×entity_type),
or per workspace.
Options: (i) per project (matches VAIS); (ii) per (project,
entity_type) (closer to KnowQL's "context = role/workflow" framing);
(iii) per workspace (cheaper, riskier).
Lean: (i). Matches existing mental model and per-project
DataStore lifecycle.
Why: minimum-surprise; the "context = workflow" framing in Nexus
docs is a Pinecone metaphor, not a tenancy boundary.
Price: N contexts where N = #projects. Per Pinecone pricing
unclear at early-access stage.
Risk: if Nexus charges per-context, this scales linearly with
project count. Wire-probe pricing before commit.

**D3 — Ingestion direction.**
Decision needed: push from sync-worker, or let Nexus pull.
Options: (a) push; (b) pull (Nexus authenticates to Drive/SharePoint
directly); (c) both for redundancy.
Lean: (a) push.
Why: re-uses our existing OAuth, our existing normalization, our
existing entity-type model. Pull = duplicate auth surface + new
attack surface.
Price: one push call per data item, fan-out from existing sync
worker.
Risk: if Nexus's pull connectors are materially smarter (e.g.,
better Drive permission inheritance), we leave value on the table.
Worth surveying once early-access docs land.

**D4 — Where Nexus enters first.**
Decision needed: Replace, Alongside, or Specific-surface.
Options: enumerated above.
Lean: Specific-surface, on a structured-status query.
Why: smallest blast radius; tests Nexus's actual product claim
(`shape`+`confidence`+`ground` for structured questions) without
betting the retrieval stack on it.
Price: ~1 sprint of work for one feature; throwaway-able.
Risk: feature is too narrow to learn from. Mitigation: pick a
question we already get user complaints about, so we can measure
delta.

### Open questions Nexus's docs don't answer

1. Is `where` server-enforced under a session-bound token, or
   caller-supplied? (D1, blocks Replace.)
2. Pricing per context vs per query vs per row indexed? (Affects
   D2 tenancy choice.)
3. Connector list — is there a Drive / SharePoint / Email pull
   connector, or push-only? (Affects D3.)
4. Schema mutability — can context schema evolve in place
   (additive), or does schema-change require re-ingest? Our
   VAIS pipeline uses `update_schema(allow_missing)` ([`config.py:54`](/workspaces/test-mvp/python-services/agent_api/vais/config.py)).
5. Latency envelope of `budget` — what tiers, what numbers? "30×
   faster than RAG" is marketing, not an SLA.
6. Multi-region / data residency — does Nexus pin a context to a
   region? Matters for EU customers.
7. SDK availability — is there a Python SDK at early access, or
   REST only?
8. Field-level citation contract — what's the JSON shape, and
   does it include source-document URIs we can resolve to our
   Postgres `data_items`?

### Wire-probes needed before any adoption decision

1. **Predicate-tampering probe.** Send a KnowQL query as an
   "external" caller with the `where` clause omitted. Observe whether
   internal rows leak. (Settles D1.)
2. **Schema-evolution probe.** Push docs with schema v1, then push
   docs with schema v2 (new field). Confirm v1 docs are still
   queryable and that `shape` requesting the v2 field returns null
   (not an error).
3. **Membership-delta probe.** Push a doc, query and confirm hit;
   delete the doc via API; query and confirm immediate miss (vs
   eventual-consistency window). Settles failure-mode #1.
4. **Push-vs-pull throughput probe.** Measure end-to-end latency
   from "doc lands in our Postgres" to "doc returnable from KnowQL
   `ground`". Compare to today's VAIS ~few-minutes window.

### Friction zettels

None captured this round — the inputs were all reachable and the
charter was unambiguous.

### Gaps

- Did not read [`p1-product-and-risk`](/workspaces/test-mvp/usegin/research/pinecone-nexus/p1-product-and-risk/)
  or [`p2-effi-retrieval-reality`](/workspaces/test-mvp/usegin/research/pinecone-nexus/p2-effi-retrieval-reality/)
  whiteboards, per the rules of the round (synthesizer cross-cuts).
  This means cost claims and Effi-retrieval ground-truth here are
  best-effort and may be revised by Sam.
- The Pinecone product page is the only Nexus source I read. Their
  docs (separate URL) likely answer half the open questions above
  but were not in the read-first list.
