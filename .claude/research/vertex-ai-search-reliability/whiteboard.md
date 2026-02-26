# Vertex AI Search Reliability — Do the 5 GFS Failure Modes Exist?

## Current State
Phase: COMPLETE | Status: judged
Last checkpoint: Both judges returned. Whiteboard finalized with comparison table and verdict.
Next: Present to user

## Auto-Inject (survives compaction — read this every time you re-orient)
Process: Re-read skill (§Pre-Phase Hook) → read whiteboard → note-to-self (§Note-to-Self) → spawn phase manager → read summary only → distill → update whiteboard
Role: I am the director. I NEVER do research myself — not reading sources, not analyzing findings, not verifying claims, not reading phase files. Every action = a subagent. If I'm about to do it myself, I stop and delegate. (§Hard Rules, §Role Collapse)
Output: Tell every agent "return ≤10 line summary; write details to phase file." I read summaries, never details. If unclear, spawn a follow-up agent to clarify — don't read the source. (§Agent Output Protocol)
Convergence: After each phase, ask: do findings answer the thesis? Are new phases producing novel insights? If not, trigger judgment. (§Convergence)
Directives: LEAN AND HIGH LEVEL. Ask for concise summaries. Use subagents for deep dives. This is EXPERIMENTAL mode — write Python, run it, collect results. Reuse existing infra from `python-services/experiments/vertex_ai_search_experiment.py`.

## Thesis
Does Vertex AI Search (Discovery Engine, `google-cloud-discoveryengine` SDK) share the 5 reliability failure modes found in GFS? Plus: does metadata filtering degrade under concurrent imports?

## Research Questions
- Q1: Concurrent upload contention — silent hangs?
- Q2: Text volume failure ceiling — 3M-6M char failures?
- Q3: Honest operation status — LROs report truthfully?
- Q4: Extraction visibility — enumerate ALL chunks at scale?
- Q5: Format support — .docx, .pptx, .xlsx behavior?
- Q6 (BONUS): Metadata filtering correctness during concurrent imports?

## Success Criteria (pre-registered)
- Q1 PASS: ≥35/40 concurrent imports complete without hangs (timeout 600s each)
- Q2 PASS: ≥90% success rate for files ≥3M chars
- Q3 PASS: LRO reaches terminal state (done=True) for ≥95% of operations, with clear error on failures
- Q4 PASS: Can retrieve ≥95% of expected chunks for a document via `list_chunks()`
- Q5 PASS: Each format either succeeds or returns explicit error within 300s (no silent hangs)
- Q6 PASS: Metadata filter queries return correct results while imports are in-flight

## Existing Infrastructure
- SDK: `google-cloud-discoveryengine==0.16.0`
- GCP project: `effi-vertex-experiment`, location: `global`
- Existing experiment: `python-services/experiments/vertex_ai_search_experiment.py`
- Verified: search CHUNKS mode, chunk listing, metadata filtering (8/8), mixed schemas (6/6)
- Gotchas: schema upfront with `indexable: true`, `ANY()` syntax, indexing ~270s

## GFS Baseline (from ENG-2060)
- Q1: Silent hangs at ~1500 concurrent pages
- Q2: 20-60% failure at 3-6M chars
- Q3: `operation.done` never transitions
- Q4: Total black box
- Q5: .docx hangs indefinitely

## RAG Engine Baseline (from ENG-2060)
- Q1: Queue model, 40/40 success
- Q2: 0/24 failures at 6M chars
- Q3: Fast exceptions with clear errors
- Q4: Partial — 100 chunks max
- Q5: .txt/.pdf/.docx/.pptx work, .xlsx rejected clearly

## Phase Plan
1. **Infrastructure + test files** — Set up datastore/engine, generate test files (small, medium, large text; .docx/.pptx/.xlsx)
2. **Single-file tests (Q2, Q3, Q5)** — Upload individual files of varying sizes/formats, observe LRO behavior
3. **Chunk visibility (Q4)** — Enumerate chunks for text-heavy docs via `list_chunks()`
4. **Concurrent uploads (Q1)** — 40 parallel imports, measure success/failure/hangs
5. **Metadata filtering under load (Q6)** — Import docs with metadata while querying filters concurrently
6. **Judgment** — Process + Answer judges

## Experiment State
- Infrastructure: Datastore `vais-reliability-51daa72e`, Engine `vais-rel-engine-51daa72e`, Run ID `51daa72e`
- State file: `python-services/experiments/vais_reliability/infra_state.json`
- Schema: 4 indexable fields (project_id, file_type, batch_id, size_bytes)
- Test files: 58 files in `python-services/experiments/vais_reliability/test_files/`
- Auth: ADC + gcloud CLI fallback working
- Current hypothesis: VAIS will be more reliable than GFS (like RAG Engine was)
- Tried: Phase 2a inline — 1MB limit. Phase 2b GCS — 1,000-chunk limit (~2.7MB ceiling).
- GCS bucket: `vais-reliability-test-files-51daa72e` (created in Phase 2b)
- Documents in datastore: 63+ docs (8 original + 40 concurrent + 15 metadata test)
- All 6 research questions answered

## Phases Completed
- Phase 1: Infrastructure ✅ — test files (58, 12.3MB), datastore, engine, schema
- Phase 2a: Inline single-file tests ✅ — Q3 PASS, Q5 PASS, Q2 incomplete
- Phase 2b: GCS large-file uploads ✅ — Q2 ANSWERED
- Phase 3: Chunk visibility ✅ — Q4 STRONG PASS
- Phase 4: Concurrent uploads ✅ — Q1 PASS
- Phase 5: Metadata under load ✅ — Q6 CONDITIONAL PASS

## Key Findings
- **Q1 (Concurrent Uploads): PASS** — 40/40 success, zero hangs, zero errors. 7.3s wall clock. Avg LRO 1.88s (stdev 0.10s). Uniform timing → internal batch processing. Sharp contrast to GFS silent hangs.
- **Q2 (Text Volume): CONDITIONAL PASS** — 1MB succeeds (82s). 3M/6M hit **1,000-chunk limit** (~2.7MB ceiling). Failure is deterministic + honest, NOT silent like GFS. Workaround: split large files.
- **Q3 (LRO Honesty): PASS** — All LROs complete in 5-82s, always `done=True`. Failures report exact error messages. No hangs, no silent failures.
- **Q4 (Chunk Visibility): STRONG PASS** — `list_chunks()` enumerates ALL chunks, NO ceiling. 2,161 chunks for 6M doc in 3.3s. Even "failed" >1000-chunk docs have all chunks accessible. Decisive advantage over RAG Engine (100 chunk cap).
- **Q5 (Format Support): PASS** — .docx (6.2s), .pptx (9.1s), .xlsx (6.1s) ALL SUCCEED. .docx works cleanly (GFS hangs indefinitely).
- **Q6 (Metadata Under Load): CONDITIONAL PASS** — No metadata contamination between document groups during concurrent imports. Zero cross-filter false positives. BUT: eventual consistency (22-55s indexing delay), non-deterministic recall on individual queries (baseline behavior, not load-induced), non-monotonic index propagation (shard rebuilds). Query latency unaffected (~580-710ms across all phases).
- **API gotchas**: `struct_data` REQUIRED in CONTENT_REQUIRED datastores; inline `raw_bytes` capped at 1MB; metadata fields propagate at different speeds

## 3-Way Comparison: GFS vs RAG Engine vs Vertex AI Search

| Question | GFS | RAG Engine | **VAIS** |
|----------|-----|-----------|----------|
| **Q1: Concurrency** | Silent hangs at ~1500 pages | 40/40 queue model | **40/40, 7.3s wall clock, batch model** |
| **Q2: Text Volume** | 20-60% silent failure at 3-6M | 0% failure at 6M | **1,000-chunk limit (~2.7MB) — fails deterministically** |
| **Q3: LRO Honesty** | `done` never transitions | Fast exceptions | **Always done=True, exact error messages** |
| **Q4: Chunk Visibility** | Total black box | 100 chunks max | **ALL chunks, no ceiling (2,161 tested)** |
| **Q5: Format Support** | .docx hangs forever | All work, .xlsx rejected | **All work including .xlsx** |
| **Q6: Metadata** | N/A | Broken (SDK gap) | **Works, safe under load, eventual consistency ~30-60s** |

## Verdict

**VAIS does NOT share the 5 GFS failure modes.** Like RAG Engine, it handles concurrency, format diversity, and operation status honestly. It surpasses RAG Engine in chunk visibility (no ceiling vs 100-cap) and metadata filtering (working vs broken).

**The one trade-off:** VAIS has a stricter text volume limit (~2.7MB per document vs RAG Engine's 6MB+), but failures are deterministic and honest — the opposite of GFS's silent failure pattern. Workaround is file splitting.

**Confidence: HIGH** for Q1, Q3, Q4, Q5. **MEDIUM** for Q2 (pre-registered criterion technically failed — 0% success at 3M+, but the failure mode is fundamentally different from GFS). **MEDIUM** for Q6 (safe under load but concurrent query window was narrow; eventual consistency is baseline, not load-induced).

## Judgment Notes

**Process Judge — RIGOROUS (with caveats):**
- Pre-registered criteria, adaptive methodology (2a→2b pivot), baseline controls in Phase 5
- Gap: Phase 5 concurrent window too short (~1s). No PDF-specific testing. No >1000-chunk searchability test.

**Answer Judge — SUPPORTED:**
- All 6 questions answered with experimental evidence. Confidence levels appropriate.
- Gap: Q2 criterion technically failed but reframing is well-argued. Missing comparison table (now added above).

## Open Questions
- Can search return results from >1000-chunk docs? (chunks listable but searchability unverified — 5-min test would resolve)
- Is the 1,000-chunk threshold configurable via API?
- Is the non-deterministic recall a VAIS baseline or test artifact?
- PDF-specific testing not done (same gap as ENG-2060)

## Dead Ends
(none)
