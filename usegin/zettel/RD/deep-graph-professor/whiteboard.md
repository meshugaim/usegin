# Deep Graph Professor — whiteboard (ENG-5381)

Audience: a developer who is going to build the Effi team's shared 2nd brain. You'll
read this top-to-bottom and then start cutting code.

The mandate the parent issue (ENG-5379) gave us isn't "build a knowledge graph
because they're cool". It's: **make associative recall feel like pulling a wire and
finding the rope**, with very-low-friction capture, threaded over time, eventually
self-managed by Effi. Everything below is held against that single requirement.

---

## 1. Recommendation (for *us*, at *our* scale)

**Use Postgres on Supabase. One table for zettels, one table for typed edges,
`pgvector` for the embedding column. That's it for v1.**

Don't reach for Neo4j / Memgraph / FalkorDB / Kuzu / DuckPGQ / Apache AGE. Not yet,
maybe never. Reasoning:

1. **Our scale is tiny by graph-DB standards.** A dev team's 2nd brain runs from
   hundreds to (optimistically) tens of thousands of zettels with maybe 5-10x as
   many edges. At <10k nodes with 2-3 hop traversal, Postgres recursive CTEs
   answer in *microseconds* — the performance argument for a graph engine simply
   doesn't kick in until ~1M nodes and/or >5-hop traversals. ([sheshbabu — Graph
   Retrieval using Postgres Recursive CTEs](https://www.sheshbabu.com/posts/graph-retrieval-using-postgres-recursive-ctes/),
   [pgbench — Postgres vs Neo4j](https://pgbench.com/comparisons/postgres-vs-neo4j/))

2. **The hard requirement here is associative recall, not graph analytics.** We
   don't need PageRank-on-the-whole-graph or community detection at runtime. We
   need "given these few seed zettels, surface the neighborhood, ranked by a
   blend of explicit-link distance and embedding similarity." That's a 2-3 hop
   walk plus a vector top-k, both of which Postgres does natively today.

3. **Effi already runs Supabase.** A dedicated graph DB is a new operational
   surface (backups, RLS story, auth bridge, deploy pipe) for a feature whose
   whole point is *low friction*. Adding ops weight to the substrate of a
   low-friction tool is exactly the wrong-shaped tradeoff.

4. **Vector and graph have to be queried together.** The killer query is
   "semantically-similar AND graph-reachable", not either alone — see
   the EcphoryRAG / spreading-activation literature in §3. Putting them in two
   stores forces a network-hop join in the hot path of every retrieval. With
   pgvector + a recursive CTE in one Postgres transaction, the planner does it
   in one shot. ([Microsoft — Combining pgvector and Apache AGE](https://techcommunity.microsoft.com/blog/adforpostgresql/combining-pgvector-and-apache-age---knowledge-graph--semantic-intelligence-in-a-/4508781)
   makes this same argument, just one rung up the complexity ladder.)

5. **Kuzu, the obvious "embedded fast graph" choice for this size, was archived
   in October 2025.** ([BigGo News](https://biggo.com/news/202510130126_KuzuDB-embedded-graph-database-archived))
   The next-best embedded option (DuckPGQ) is still a research-prototype
   community extension, not production-blessed. ([DuckPGQ docs](https://duckpgq.org/)).
   Picking either now would saddle the project with substrate risk before we
   even know what queries we run.

### When to actually graduate to a real graph DB

Promote off Postgres only if **at least two** of these become true:

- Recursive CTEs over the edge table consistently exceed ~50ms p95 on real
  retrievals. (At our projected scale: very unlikely in year 1.)
- We need >4-hop traversals on the hot path. (We almost certainly won't —
  human associative recall plateaus around 2-3 hops; "pull a wire" is one
  hop plus its similarity neighborhood, not breadth-first to depth 7.)
- We need real graph algorithms at runtime — community detection, PageRank,
  shortest-path on a graph too large to materialize.
- Effi-managing-her-own-2nd-brain matures to where the agent is doing
  programmatic graph rewriting at high QPS.

In that future, the cleanest jump is **Apache AGE** (Cypher inside Postgres,
keeps everything else intact) — *not* a separate Neo4j cluster. The schema in
§2 is designed to make that promotion mechanical: rename the edges table,
load it into AGE as labeled edges, keep the same node table. No remodeling.

### Why not the alternatives, briefly

| Option | Why not (now) |
|---|---|
| **Neo4j** | Right answer at 1M+ nodes. At our size: a separate cluster, separate auth/RLS story, separate backup, ~10x ops weight for a query speed advantage we can't measure. Cypher is lovely; we don't need it badly enough yet. |
| **Memgraph** | In-memory, C++, very fast — but same "separate service" cost as Neo4j with weaker ecosystem and a memory-bound graph. Solves a problem we don't have. |
| **FalkorDB** | Excellent latency for GraphRAG, single-threaded Redis-module ceiling, source-available license. Watch-list, not foundation. |
| **Kuzu** | Was the right answer for embedded. Archived Oct 2025. Dead. |
| **DuckPGQ** | Research-prototype community extension. Watch-list. Will be interesting if it stabilizes and someone wants offline analytics over an exported graph. |
| **Apache AGE** | The real graduation path from Postgres. Skip for v1, keep schema AGE-compatible. |
| **RDF triplestore (Jena, GraphDB, Blazegraph)** | RDF wins for global integration / formal ontology / SPARQL federation. None of those are our problems. Property-graph model fits a 2nd brain better. ([Neo4j — RDF vs Property Graphs](https://neo4j.com/blog/knowledge-graph/rdf-vs-property-graphs-knowledge-graphs/)) |
| **Graphiti as a managed layer** | It's a real option (Neo4j/FalkorDB/Kuzu backends, temporal edges, hybrid search baked in). For a tiny team it's overkill *and* it locks us into one of those backends. Borrow ideas from its schema (§2), don't adopt the framework. ([getzep/graphiti](https://github.com/getzep/graphiti)) |

### Stack, concretely

- **Substrate:** Postgres (Supabase). Use `pgvector` for the embedding column.
- **Indexes:** `HNSW` on the embedding column, btree on edge `(src, kind)` and
  `(dst, kind)`, GIN on tags / full-text.
- **Embeddings:** whatever Effi already uses for retrieval (we are not opening
  that question here). 1536-dim or smaller is fine; HNSW handles it.
- **Query layer:** plain SQL + recursive CTEs. One stored function for the
  associative-recall query (§2 has the sketch).
- **Optional, later:** Apache AGE for first-class Cypher when the queries get
  hairy enough that CTEs feel cramped.
- **Not here:** no separate vector DB (Pinecone/Qdrant/Weaviate), no Neo4j, no
  Memgraph, no Kuzu, no triplestore.

---

## 2. The modeling sketch — schema for "pull a wire, find the rope"

### Node — `zettel`

A zettel is one atomic thought. Append-mostly. Updates are new revisions
linked back via a `supersedes` edge — never silent overwrites
(principle 2 — preserve trajectory).

```
zettel
  id              uuid pk
  kind            enum('lesson','idea','decision','frustration','observation',
                       'id_ref','question','retro','structure_note', ...)
  title           text       -- short handle, optional, for surface listing
  body            text       -- the actual atomic thought, 1 paragraph-ish
  body_embedding  vector     -- pgvector, generated from body
  author          text       -- 'lihu', 'oria', 'claude:<session_id>', ...
  origin_kind     enum('chat','code','retro','manual','effi_emit')
  origin_ref      jsonb      -- session id, file:line, linear issue, etc.
  created_at      timestamptz
  superseded_by   uuid null  -- denorm of the supersedes edge for fast filter
  retired         bool       -- never delete; mark, keep visible to traversal
                             -- with a flag so consumers can dim/filter
```

Notes on this:

- **No `tags` array.** Tags become typed edges to `topic` zettels. Keeps one
  way of doing things; tags become first-class threadable nodes.
- **`origin_ref` is jsonb on purpose.** A zettel can be born from a chat
  message, a code line, a Linear issue, a retro — each with a different
  shape of provenance. Don't normalize prematurely.
- **`body_embedding` lives on the row, not in a sidecar.** This is what makes
  the hybrid query in §2.3 a single SQL statement.
- **`retired`, not `deleted`.** Principle 2 again. A reverted decision still
  carries its reasoning and must remain reachable when its neighbors are
  pulled.

### Edge — `zettel_edge`

One typed-edge table, **not** one table per edge type. Edge type is a column.
This is the AGE-promotion-friendly shape.

```
zettel_edge
  src        uuid references zettel(id)
  dst        uuid references zettel(id)
  kind       enum(
               -- explicit, human/agent-asserted
               'links_to',          -- generic [[wikilink]]
               'thread_continues',  -- next slip in a thread
               'thread_branches',   -- divergent branch from same parent
               'supersedes',        -- revision; pairs with `superseded_by`
               'contradicts',       -- decision now contradicts that one
               'tagged',            -- zettel --tagged--> topic-zettel
               'authored_by',       -- zettel --authored_by--> person-zettel
               'about_artifact',    -- zettel --about--> file/issue/session
               -- derived, machine-asserted, cheap to recompute
               'similar_to',        -- embedding-similarity, has weight
               'co_occurred_with',  -- mentioned in same chat/session/window
               'temporally_near'    -- created within a small window
             )
  weight     real        -- meaningful for similar_to / co_occurred_with;
                         -- 1.0 for explicit kinds
  asserted_by text       -- 'human:lihu', 'claude:session_xyz', 'job:nightly_similarity'
  created_at  timestamptz
  evidence    jsonb null -- for derived edges: what triggered it
                         -- (chunk overlap, session id, similarity score)
  primary key (src, dst, kind)
```

Notes:

- **`similar_to` is a *materialized* edge, not a runtime ANN call from inside
  the CTE.** Run a nightly (or on-write) job that, for each zettel, writes
  the top-K similar edges with weight = cosine similarity. This is how
  Microsoft's [pgvector + AGE pattern](https://techcommunity.microsoft.com/blog/adforpostgresql/combining-pgvector-and-apache-age---knowledge-graph--semantic-intelligence-in-a-/4508781)
  bridges vector → graph; we do the same in plain Postgres. Keeps the hot-path
  retrieval as pure graph traversal — fast, deterministic, debuggable.
- **`co_occurred_with` is the secret sauce for the "we were fighting that area"
  detection** (principle 4). Frustration zettels emitted in the same session
  edge to each other; clusters become visible without needing semantic
  understanding.
- **`temporally_near` is cheap and powerful** for recall: "what else was on
  our mind that week?" is a great associative bridge that has nothing to do
  with content similarity.
- **`asserted_by` matters.** When the team eventually disagrees with a derived
  edge ("no, those aren't really related"), they need to be able to see who
  said so and either retract or strengthen — without that field you can't
  evolve the inference rules.

### The associative-recall query — "pull a wire, find the rope"

This is the canonical retrieval. Given a few seed zettels (or a query that
gets embedded into a synthetic seed), return the surrounding neighborhood
ranked by a blend of graph distance and embedding similarity. It is one SQL
statement.

```sql
-- pseudo-SQL, intent over syntax
WITH RECURSIVE
  seeds AS (
    -- top-k by vector similarity to the query embedding
    SELECT id, 0 AS hop, 1.0::real AS edge_weight
    FROM zettel
    ORDER BY body_embedding <=> :query_embedding
    LIMIT 10
  ),
  walk AS (
    SELECT id, hop, edge_weight FROM seeds
    UNION
    SELECT e.dst, w.hop + 1,
           -- decay by hop, multiply by edge weight (similar_to is weighted,
           -- explicit edges carry weight 1)
           w.edge_weight * e.weight * 0.6
    FROM walk w
    JOIN zettel_edge e ON e.src = w.id
    WHERE w.hop < 3                       -- 2-3 hop ceiling; this is enough
      AND e.kind IN ('links_to','thread_continues','thread_branches',
                     'supersedes','contradicts','tagged',
                     'similar_to','co_occurred_with')
  )
SELECT z.*, max(walk.edge_weight) AS activation
FROM walk
JOIN zettel z ON z.id = walk.id
WHERE NOT z.retired                       -- or include with a dim flag
GROUP BY z.id
ORDER BY activation DESC
LIMIT 25;
```

This is **spreading activation** in disguise — the same algorithm cognitive-
science-flavored RAG papers like EcphoryRAG and the spreading-activation
GraphRAG paper from 2025 use to model human associative memory.
([alphaXiv — Spreading Activation for KG-RAG](https://www.alphaxiv.org/overview/2512.15922),
[arXiv — EcphoryRAG](https://arxiv.org/html/2510.08958v1)) The decay factor
(`0.6` here) rescales activation so a single rich seed doesn't drown
everything; tune empirically.

The query gives "pull a wire, find the rope" literally:
- the *wire* is the seed (or the embedded user query),
- the *rope* is the activated subgraph,
- the *order* is activation = depth-decayed product of edge weights.

### The "why does this cluster of frustration zettels exist" query

Principle 4 ("fighting vs asking") wants this lookup to feel native:

```sql
-- find areas of the graph that are dense in frustration zettels
SELECT topic_zettel.id, count(*) AS frustration_density
FROM zettel f
JOIN zettel_edge e ON e.src = f.id AND e.kind = 'tagged'
JOIN zettel topic_zettel ON topic_zettel.id = e.dst
WHERE f.kind = 'frustration'
  AND f.created_at > now() - interval '30 days'
GROUP BY topic_zettel.id
HAVING count(*) >= 3
ORDER BY frustration_density DESC;
```

The schema makes this a one-liner. That's the bar — if a question that
maps cleanly onto the principles isn't a one-liner against the schema, the
schema is wrong.

### The capture path — what "low friction" means in this schema

A capture is one INSERT into `zettel`, one embedding, and zero or more
INSERTs into `zettel_edge`. The producer doesn't need to think about edges
beyond explicit `[[links]]`:

- **Explicit edges** (`links_to`, `tagged`, `supersedes`, `contradicts`)
  come from the body's wikilink syntax or an explicit slash-command.
- **Derived edges** (`similar_to`, `co_occurred_with`, `temporally_near`)
  are written by background jobs or by an emit-time hook that knows the
  session id. The user/agent never thinks about them.

This is what unlocks principle 1 (intuitive workflows). The schema doesn't
make capture harder by demanding the producer pre-classify the relationship
network.

---

## 3. Landscape and source material

This section is the survey behind §1 and §2, organized by question. Read
selectively.

### 3.1 The 2025-2026 graph DB landscape, in one paragraph each

**Neo4j** — Still the reference property graph DB. Mature ecosystem, Cypher
is the de facto query language (and the basis for the new ISO GQL standard,
see §3.4), strong vector index support since 2024 (HNSW). Expensive ops
weight: it's a service. Right answer at scale; overkill for tiny teams.
([memgraph — Neo4j vs Memgraph](https://memgraph.com/blog/neo4j-vs-memgraph),
[neo4j — vector search](https://neo4j.com/developer/genai-ecosystem/vector-search/))

**Memgraph** — In-memory, C++, Cypher-compatible, ~3-8x faster than Neo4j on
mixed workloads, up to 41x lower latency on writes. Great for real-time;
graph must fit in RAM. Smaller community than Neo4j. Same "separate service"
ops cost.
([memgraph — performance benchmark](https://memgraph.com/blog/memgraph-vs-neo4j-performance-benchmark-comparison))

**FalkorDB** — Property graph as a Redis module. Sparse-matrix linear-algebra
implementation, very fast for GraphRAG-style retrieval (sub-140ms p99 on
expansions). Cold start ~1ms. Single-threaded ceiling, source-available
license. Built for inference-time context assembly more than long-lived
state.
([FalkorDB vs Neo4j](https://www.puppygraph.com/blog/falkordb-vs-neo4j))

**Kuzu** — *Was* the embedded property graph DB to beat: columnar storage,
Cypher, vector search and full-text built in, used by Graphiti and many
others. **Archived October 2025.** Founders are "working on something new",
no concrete successor. Don't pick it for new work.
([BigGo News on archival](https://biggo.com/news/202510130126_KuzuDB-embedded-graph-database-archived),
[kuzudb GitHub](https://github.com/kuzudb/kuzu))

**DuckPGQ** — DuckDB community extension implementing SQL/PGQ (the new ISO
graph extension to SQL). Embedded, analytical, competitive with Neo4j on
some benchmarks. Still labeled "research prototype" / "active development".
The natural successor to Kuzu in the embedded slot, but not yet
production-ready for a system you'd have to live with for years.
([duckpgq.org](https://duckpgq.org/), [DuckDB blog Oct 2025](https://duckdb.org/2025/10/22/duckdb-graph-queries-duckpgq))

**Apache AGE** — Postgres extension that adds Cypher to Postgres. Postgres 18
support landed in 2025; Azure offers it managed. The ideal graduation path
from a plain-Postgres start: same database, ACID, MVCC, can join graph
queries against pgvector in one CTE. Caveat: ecosystem is smaller than Neo4j,
some Cypher features lag.
([Apache AGE GitHub](https://github.com/apache/age),
[Combining pgvector and Apache AGE](https://techcommunity.microsoft.com/blog/adforpostgresql/combining-pgvector-and-apache-age---knowledge-graph--semantic-intelligence-in-a-/4508781))

**Plain Postgres + pgvector + recursive CTEs** — The boring, correct,
Effi-already-runs-it choice for our scale. <10k nodes / 50k edges, depth
2-3, microsecond response. The lower bound everyone benchmarks against.
([sheshbabu — Graph Retrieval using Postgres Recursive CTEs](https://www.sheshbabu.com/posts/graph-retrieval-using-postgres-recursive-ctes/),
[dev.to — Personal KG with just Postgres](https://dev.to/micelclaw/4o-building-a-personal-knowledge-graph-with-just-postgresql-no-neo4j-needed-22b2))

### 3.2 Property graphs vs RDF triplestores

Quick verdict for our use case: **property graph, not RDF**.

RDF (triplestores like GraphDB, Jena, Blazegraph) wins when:
- you must federate across many independently-curated knowledge sources via
  shared IRIs and W3C ontologies,
- regulatory/compliance demands strict semantic precision and inference,
- you're in pharma / life sciences / library science / linked open data.

Property graphs win when:
- relationships have rich attributes (weight, asserted_by, evidence) — RDF
  can't natively put properties on edges without reification gymnastics,
- you need fast multi-hop traversal and analytics,
- the team thinks in terms of nodes-and-edges, not triples.

Our 2nd brain is the second column all the way down: edges have weights
(similar_to), evidence (which session asserted this), provenance
(human/agent), and we want fast traversal. RDF would make us reify every
edge into a node just to attach a weight. ([Neo4j — RDF vs Property
Graphs](https://neo4j.com/blog/knowledge-graph/rdf-vs-property-graphs-knowledge-graphs/),
[Wisecube — RDF or PG](https://www.wisecube.ai/blog/knowledge-graphs-rdf-or-property-graphs-which-one-should-you-pick/))

### 3.3 Vector + graph hybrids — the actual research-led answer

The "pull a wire, find the rope" feel is **spreading activation**, not
similarity ranking. This matters and the literature now backs it up.

- **EcphoryRAG (Oct 2025)** explicitly frames knowledge-graph RAG as
  *ecphory* — partial cues activating complete memory traces. Edges include
  co-occurrence (entities in same chunk → undirected unweighted) and
  vector-similarity-derived associations. Activation propagates from cue
  entities outward, weighted by relevance. Anchoring re-rank prevents
  topic drift. This is exactly the model our schema implements.
  ([EcphoryRAG](https://arxiv.org/html/2510.08958v1))

- **Spreading-activation GraphRAG paper (alphaXiv, Dec 2025)** uses NPMI
  for genuine-association edge weights, GloVe-style power-law frequency
  scaling, and an Ebbinghaus-style decay (yes, the forgetting curve) on
  activation propagation. The takeaway: the algorithm we want has been
  studied for decades in cognitive psychology and is now being re-discovered
  in RAG.
  ([Spreading Activation for KG-RAG](https://www.alphaxiv.org/overview/2512.15922))

- **HybridRAG / Memgraph blog** — same instinct, less rigorous. Vector DB
  finds semantically similar entities; graph DB does the multi-hop reasoning
  on the result set. Two-stage retrieval. Our schema does this *in one
  query* by materializing similar_to as edges.
  ([memgraph — HybridRAG](https://memgraph.com/blog/why-hybridrag))

- **Graphiti** — production-grade temporal knowledge graph framework for AI
  agents. Edges are triplets with explicit validity windows; supersession
  invalidates rather than deletes (matches our principle 2). Hybrid search
  combines semantic + keyword + graph traversal for sub-second retrieval.
  Worth borrowing the **temporal-validity-window idea** for `supersedes`
  edges if/when we add time-bounded facts (decisions that were true Q1 but
  not Q3).
  ([getzep/graphiti](https://github.com/getzep/graphiti))

- **The Microsoft pgvector + Apache AGE post** is the engineering recipe
  closest to what we're proposing — vector similarity scores get written as
  graph edges, then everything is one graph query. Read it. We're doing the
  same thing one rung simpler (no AGE, just plain edge table).
  ([Microsoft — Combining pgvector and Apache AGE](https://techcommunity.microsoft.com/blog/adforpostgresql/combining-pgvector-and-apache-age---knowledge-graph--semantic-intelligence-in-a-/4508781))

### 3.4 Query languages: Cypher, GQL, SPARQL

- **Cypher** — Neo4j's language. ASCII-art pattern matching
  (`(a)-[:KNOWS]->(b)`). Best ergonomics in the property-graph world.
- **GQL** — ISO/IEC 39075:2024, published April 2024. *The* standard for
  property-graph querying, comparable in scope to SQL-92. Largely
  Cypher-compatible (MATCH/RETURN, ASCII art); diverges in keywords
  (INSERT vs CREATE) and adds quantified path patterns. Multiple vendors
  (Neo4j, TigerGraph, Memgraph, AWS Neptune) committing to GQL. Long-term
  bet: GQL displaces vendor-specific dialects the way SQL did.
  ([AWS — GQL ISO standard](https://aws.amazon.com/blogs/database/gql-the-iso-standard-for-graphs-has-arrived/),
  [Neo4j — Cypher in a GQL world](https://neo4j.com/blog/cypher-and-gql/cypher-gql-world/))
- **SPARQL** — RDF's query language. Federation-friendly, semantically
  precise, more verbose for traversal. Stays relevant for RDF; not the
  property-graph world's future.
- **SQL/PGQ** — graph-pattern extension to SQL itself, implemented by
  DuckPGQ. Promising for "graph queries inside the same SQL engine you
  already use". Watch.

For us in v1: write SQL recursive CTEs. If we ever go to AGE: write
Cypher (which we'll already be using if Effi grows tools that emit
Cypher). Don't invest in SPARQL.

### 3.5 What Roam / Obsidian / Logseq teach us

- **Obsidian** is page-level: notes are markdown files, links are
  `[[wikilinks]]`, backlinks are computed by scanning the vault. Graph view
  is a visualization, not a primary query surface. Storage: plain files.
- **Roam** is block-level: every paragraph is an addressable block, blocks
  reference and embed each other, structure is as much "this block is
  inside this outline" as "this block links to that one". Cloud-only.
- **Logseq** as of 2025 is mid-migration to a SQLite-backed *DB version*
  alongside the file-based version. Properties became first-class entities;
  loading 2,000+ pages went from minutes to instant. The lesson: even local
  tools end up needing a real DB once the graph passes a few thousand
  nodes. ([Logseq DB version docs](https://github.com/logseq/docs/blob/master/db-version.md),
  [How to install Logseq DB](https://preslav.me/2025/10/13/how-to-install-logseq-db-version-on-your-computer-sqlite/))

What we steal:
- **From Roam/Logseq**: blocks (atomic) with stable IDs and bidirectional
  references. Our `zettel` is the "block".
- **From Obsidian**: wikilink syntax in the body for explicit edges (low
  friction).
- **From Logseq's migration**: do not start on plain files. Start on a
  real DB. Files-as-source-of-truth is a trap once the graph grows.

### 3.6 Honest scale numbers

| Dataset | Postgres CTE depth-3 | Neo4j Cypher depth-3 |
|---|---|---|
| 1k nodes / 5k edges | sub-ms | sub-ms |
| 10k nodes / 50k edges | low ms | sub-ms |
| 100k nodes / 1M edges | tens of ms | low ms |
| 1M nodes / 10M edges | seconds, falls over | tens of ms |
| 10M+ / depth >5 | won't | linear |

(Assembled from the linked benchmarks; exact numbers depend on indexes and
query shape. Order of magnitude is the takeaway.)

A team's 2nd brain over 5 years optimistically projects to ~20k zettels
and ~100k edges. Solidly in the row where Postgres wins on operational
simplicity and Neo4j has no observable advantage.

### 3.7 Open questions / things to revisit

- **Embedding choice and dimension.** Out of scope here; whatever Effi uses
  for retrieval. The schema doesn't care.
- **Block-level vs page-level atomicity.** I've assumed page-level (one
  zettel = one body). If we want Roam-style block transclusion, we need
  zettel-fragments, which is real complexity. Defer until proven needed.
- **How the *capture* surface works.** The schema is independent of the
  capture UI. CLI / chat slash-command / VS Code extension / voice dump are
  all fine. That's a sibling track (probably the Modern-Tools Professor's
  domain, ENG-5382).
- **Effi's self-management interface.** The schema is friendly to it: every
  edge has `asserted_by`, every derived edge has `evidence`. When Effi
  starts emitting and rewriting edges, we already have audit. Concrete
  interface design: future work.
- **Temporal validity** (à la Graphiti). Not in v1 schema. If we need
  "this decision was true Q1, superseded Q3", add `valid_from` /
  `valid_to` to `zettel_edge`. Cheap to add later; not worth carrying now.
