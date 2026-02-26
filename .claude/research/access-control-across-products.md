# Access Control Across GFS, VRAG, and VAIS

Cross-cutting analysis of how access control works (and should work) across the three search products. Born from a review session on 2026-02-26 that traced how isolation decisions were made in each prototype.

## Context

We have three search backends, each with different native capabilities:
- **GFS** (Google File Search) — production, in `project_file_search_service.py`
- **VRAG** (Vertex RAG Engine) — prototype, in `agent_api/vrag/`
- **VAIS** (Vertex AI Search) — prototype, in `agent_api/vais/`

All three serve the same product need: project-scoped document search with internal/external access control.

---

## How GFS Does It (Production Baseline)

GFS uses **physical separation** — up to 6 stores per project:

| | internal | external |
|---|---|---|
| files | store | store |
| email | store | store |
| drive | store | store |

Access control is enforced at three layers:
1. **RLS** on `project_files` — external users can only SELECT rows where `access_level = 'external'`
2. **Python service** — `ProjectStoreService.get_accessible_stores()` nulls out internal store IDs for external users
3. **Physical isolation** — internal content is in a different Google store; even a bug in layers 1-2 can't leak it

The key property: **defense-in-depth through physical separation**. The query engine literally cannot see internal content when querying external stores.

---

## What Each Product Natively Offers for Access Control

### Vertex RAG Engine

| Mechanism | Works? | Useful? |
|---|---|---|
| GCP IAM (project-level) | Yes | No — too coarse, controls API access not document access |
| `rag_file_ids` on `RagResource` | **Yes** — verified zero leakage, no ID limit to 1K, no perf penalty | Yes — sole working sub-corpus scoping mechanism |
| Metadata filtering (`Filter` on `RagRetrievalConfig`) | **Broken** — write path never indexes. SDK 1.136.0 + 1.139.0 tested. Google: "not technically released yet" (Feb 2026) | No |
| Corpus-level ACLs | Does not exist | N/A |
| Document-level ACLs | Does not exist | N/A |
| Per-user query scoping | Does not exist | N/A |

**No documented limit on corpora per project.** Quotas page only lists RPM limits (60 RPM data management, 600 RPM retrieval). Corpus creation takes ~15s.

Sources: [RAG quotas](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/rag-quotas), [RAG API ref](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/rag-api-v1), community threads [Jan 2026](https://discuss.google.dev/t/vertex-ai-rag-engine-file-metadata-and-metadata-filtering/324534), [Feb 2026](https://discuss.google.dev/t/vertex-ai-rag-engine-metadata-filtering-not-working/327263)

### Vertex AI Search

| Mechanism | Works? | Useful? |
|---|---|---|
| GCP IAM (project-level) | Yes | No — too coarse |
| Document ACLs (`acl_info`) | Yes | Impractical — requires Workforce Identity Federation or Google Identity for every end user. Immutable at DataStore creation. Preview feature. 3K reader limit. |
| Metadata filtering (`struct_data` + `filter`) | **Yes** — `ANY()` syntax, compound AND/OR, numeric ranges. 50 indexable fields max. | Yes — this is what the prototype uses |
| DataStore isolation | Yes — separate indexes | Yes — 100 DataStores/project default, 500 max |

**Key constraint:** 300 search RPM per GCP project. Eventual consistency on metadata (22-55s indexing delay for new docs).

Sources: [VAIS access control](https://docs.cloud.google.com/generative-ai-app-builder/docs/data-source-access-control), [VAIS filter docs](https://docs.cloud.google.com/generative-ai-app-builder/docs/filter-search-metadata), [VAIS quotas](https://docs.cloud.google.com/generative-ai-app-builder/quotas)

---

## How the Prototypes Currently Do It

### VRAG: 1 Corpus Per Project + `rag_file_ids`

- `vrag_prototype.corpora` has `UNIQUE(project_id)` — enforces 1 corpus per project
- Internal/external separation via Supabase pre-filter on `access_level` column → filtered `rag_file_ids` passed to `retrieval_query()`
- No RLS (admin-only prototype, service-role access)

### VAIS: 1 DataStore Per Project + Metadata Filtering

- `vais_stores` has `UNIQUE(project_id)` — enforces 1 DataStore per project
- Internal/external separation via `access_level: ANY("internal")` filter in `SearchRequest`
- Has RLS policies (member read, owner write)

---

## The "1 Container Per Project" Decision — How It Was Made

Traced through the research chronology (2026-02-26 review):

### Phase 01 (GFS research)
The GFS researcher documented the multi-store pattern and explicitly noted:
> **VRAG equivalent:** Each project gets a VAIS DataStore + Engine **per access level**

At this point, the plan was to mirror GFS's physical separation.

### Phase 01 (VRAG research)
Metadata filtering was discovered to be **broken**. The researcher pivoted to `rag_file_ids` as a workaround and validated it experimentally.

### ENG-2060 (reliability experiment, Phase 06)
`rag_file_ids` was proven safe: zero leakage, no perf penalty, no ID limits. The researcher then made the critical leap:
> "**No need to create separate corpora per project.** A single corpus can serve all projects with file-level scoping."

This insight was about **filtering correctness** but was applied to **isolation architecture**.

### Phase 02 (design)
The decision appeared fully baked with no deliberation:
> **9.1 One Corpus Per Project (not per entity_type/access_level)** — This is simpler and validated by the ENG-2060 experiments.

The GFS researcher's own suggestion ("per access level") was silently dropped.

### What happened
Two concerns were conflated:
1. **Filtering** — "does the user see the right results?" → `rag_file_ids` solves this ✓
2. **Isolation** — "does internal content exist in the same container as external content?" → never discussed

The reasoning chain: metadata broken → `rag_file_ids` works → can replace store separation → 1 corpus is enough → simpler.

Each step is logical for *functionality*, but skips from "filtering works" to "physical isolation is unnecessary" without examining the security trade-off. In GFS, a query-layer bug can't leak internal content (different store). In 1-corpus VRAG, a missing WHERE clause in the Supabase pre-filter returns internal `rag_file_ids` to an external user.

**This was a design shortcut born from a correct but narrow experimental finding, not a product limitation.**

---

## Comparison: What We Can Do in Each Product

| Dimension | GFS (current) | VRAG (can do) | VAIS (can do) |
|---|---|---|---|
| **Project isolation** | Separate Google stores | Separate corpora (no quota limit found) | Separate DataStores (100/project default, 500 max) |
| **Internal/external** | Separate physical stores | **Can** use separate corpora per access level | **Can** use separate DataStores per access level, OR metadata filter |
| **Entity type** | Separate physical stores | **Can** use separate corpora per entity type | **Can** use metadata filter (`entity_type: ANY("file")`) |
| **Within-type filtering** | GFS `custom_metadata` (`key = "value"`) | `rag_file_ids` (application pre-filter) | `struct_data` metadata filter (50 fields, `ANY()` syntax) |
| **Native doc-level ACLs** | No | No | Yes (`acl_info`) — but requires Google Identity federation |

### VRAG: Options for Access Control

**Option A: 1 corpus per project (current prototype)**
- Filtering via Supabase SQL → `rag_file_ids`
- Pro: simplest, fewest GCP resources, cross-entity search in one call
- Con: no physical isolation between internal/external; application bug = potential leakage within corpus

**Option B: N corpora per project (mirror GFS)**
- e.g., 2 corpora (internal + external) or 6 corpora (internal/external × file/email/drive)
- Pro: physical isolation — internal corpus is unreachable from external queries
- Con: more setup cost (~15s × N, lazy), parallel queries needed, more GCP resources
- No known quota limit blocking this

**Option C: Hybrid — 2 corpora (internal + external) per project**
- Physical separation for the security-critical dimension (access level)
- `rag_file_ids` for the non-security dimension (entity type filtering within a corpus)
- Balances defense-in-depth with simplicity

### VAIS: Options for Access Control

**Option A: 1 DataStore per project (current prototype)**
- Filtering via `struct_data` metadata (`access_level: ANY("internal")`)
- Pro: simplest, cross-entity search, fewer resources
- Con: no physical isolation; filter is caller-controlled (app must inject it correctly); eventual consistency (22-55s)

**Option B: N DataStores per project (mirror GFS)**
- Same trade-offs as VRAG Option B
- Additional con: 300 RPM per GCP project shared across all DataStores; 100 DataStore default limit

**Option C: Hybrid — 2 DataStores (internal + external) per project**
- Physical separation for access level, metadata filtering for entity type
- Pro: defense-in-depth where it matters most
- Con: doubles DataStore count; two search calls needed for owner/internal users who see both

**Option D: Native ACLs (`acl_info`)**
- Requires Workforce Identity Federation setup (Azure AD, Okta, etc.)
- Impractical for Supabase Auth users without significant identity infrastructure
- Would provide true per-document access control enforced by the product

---

## Open Questions

1. **Should we adopt Option C (hybrid) for both prototypes?** It mirrors GFS's security property for the critical dimension (internal/external) without the full 6-store complexity.
2. **What's the actual corpus limit in VRAG?** Google doesn't publish it. Worth testing at scale before committing to multi-corpus architecture.
3. **For VAIS, does the 300 RPM limit make multi-DataStore untenable?** Owner users querying 2 DataStores doubles the RPM cost.
4. **Should this be a production requirement or a prototype concern?** The prototypes are admin-only. Physical isolation may only matter when external users can trigger searches.

---

## Related Documents

- `vrag-prototype/phase-01-research-gfs.md` — GFS patterns (Pattern 3: Store-per-Project-per-Access-Level)
- `vrag-prototype/phase-01-research-vrag.md` — VRAG capabilities, broken metadata finding
- `vrag-prototype/phase-02-design.md` — Section 9.1: "One Corpus Per Project" decision
- `vertex-rag-reliability/phase-06-file-id-filtering.md` — ENG-2060 experiment where the leap happened
- `vais-prototype/phase-02-design.md` — VAIS "ONE DataStore per project" decision
- `vertex-ai-search-reliability/phase-05-metadata-load.md` — VAIS metadata isolation verification
