# 2026 graph-DB shortlist — one-paragraph each

A scratch reference. The whiteboard §3 is the source of truth; this is the
"if I just need to remember which one is which" cheat sheet.

| Engine | Model | Embedded? | Cypher? | Vector? | Status | Use it when |
|---|---|---|---|---|---|---|
| **Postgres + pgvector + CTEs** | RDBMS | yes (it's just Postgres) | no | yes (pgvector) | rock solid | <100k nodes, <4-hop traversal, you already have Postgres |
| **Apache AGE** | PG + Cypher | yes (PG extension) | yes | via pgvector | active, PG18 supported 2025 | you outgrow CTEs but want to stay in Postgres |
| **Neo4j** | property graph | no (server) | yes (de facto) | yes (HNSW since 2024) | mature, dominant | 1M+ nodes, deep traversal, mature ops budget |
| **Memgraph** | property graph | no (server) | yes | yes | growing fast | real-time, in-memory, sub-second writes matter |
| **FalkorDB** | property graph (Redis module) | semi | yes | yes | production-stable, SSPL-ish license | inference-time GraphRAG, low cold-start, single-tenant fine |
| **Kuzu** | property graph | yes | yes | yes | **archived Oct 2025** | don't pick for new work |
| **DuckPGQ** | SQL/PGQ in DuckDB | yes | no (PGQ syntax) | via DuckDB | community extension, research-prototype origin | offline analytics over an exported graph |
| **TigerGraph** | property graph | no | GSQL | yes | enterprise | huge graphs, distributed, you have a budget |
| **Amazon Neptune** | both PG and RDF | no (managed) | yes (openCypher) | yes | mature | already on AWS, want managed |
| **CozoDB** | datalog | yes | no (datalog) | yes | slowed | you actively want datalog |
| **SurrealDB** | multi-model | yes & server | own SurrealQL | yes | maturing | greenfield where multi-model wins |
| **Dgraph** | GraphQL-native | no | no (DQL) | partial | maintained but quieter | GraphQL-first product surface |
| **Jena / GraphDB / Blazegraph** | RDF triplestore | varies | no (SPARQL) | uneven | mature in their niche | you actually need RDF/OWL/SPARQL |
| **Graphiti** | framework, not a DB | depends on backend | depends | yes | actively developed | you want a temporal-fact KG framework with batteries |

## Quick decision tree

- *Are we already on Postgres?* → Yes. Default to plain Postgres.
- *Is the graph >1M nodes or >5-hop traversal hot path?* → No (and won't be).
  Stay on Postgres.
- *Do we need an off-the-shelf graph algorithm library at runtime?* → No.
  Stay on Postgres.
- *Do we need Cypher's ergonomics for complex multi-pattern queries?* →
  Not for the queries in the whiteboard's §2. If/when yes → Apache AGE.
- *Are we doing global ontology integration / SPARQL federation?* → No. Skip RDF.

→ Plain Postgres + pgvector + recursive CTEs. Promote to Apache AGE when
queries get hard, not before.
