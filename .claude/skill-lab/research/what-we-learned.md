# What We Learned — Research Skill Audit (2026-03-17)

Comprehensive analysis of all 15 research directories under `.claude/research/`, the research skill lab, and 1 retro. Written to preserve institutional knowledge before cleaning up whiteboards and phase artifacts.

**Audit scope:** 9 research-skill sessions + 6 build-orchestrate sessions whose whiteboards live in `.claude/research/`. Build-orchestrate process learnings are in the [build-orchestrate what-we-learned](../build-orchestrate/what-we-learned.md) — this document covers the research artifacts themselves and the research skill's process.

---

## Research Skill: Process Observations

Only 1 formal retro exists (VAIS reliability experiment, 2026-02-26). Cross-session patterns inferred from whiteboard structure and agent reports.

### What worked

- **Director delegation discipline was strong across all sessions.** Whiteboards show clean director-level summaries (39–232 lines). Phase files contain the detail. Separation held.
- **Judgment model produced real value.** 4 of 9 research sessions triggered dual judges (process + answer). In every case, judges caught gaps: GFS upload matrix (data presentation conflation), network incident (48% failure rate was methodology error → corrected to 10/14d), reproduce-mode-b (confidence calibrated from PROVEN to SUPPORTED), vais-metadata-update (filter syntax corrections).
- **Experiment weight worked well.** GFS upload matrix (8 phases, 162+ uploads), vertex-rag-reliability (6 phases, 68 uploads), vertex-ai-search-reliability (5 phases, 40+ uploads) all used experiment weight effectively. Experiment State sections on whiteboards provided strategic memory between iterations.
- **Adaptive phasing was the norm.** Sessions routinely split phases (2a/2b), added unplanned phases, or dropped planned ones based on findings. No session rigidly followed its initial plan.
- **Pre-registered success criteria (when used) improved rigor.** VAIS reliability and reproduce-mode-b both pre-registered criteria. Both had honest post-judgment reassessment of whether criteria were met. Sessions without pre-registration had fuzzier convergence.

### What could improve

- **Judgment was triggered in only 4/9 sessions.** The 5 sessions without judgment (effi-voice-poc, eng-2204, vais-gdrive-connector, admin-usage-rebuild-related research, gfs-store-shared-overhead) either converged informally or treated QA as judgment. The skill says to trigger judgment when converging — this was followed ~44% of the time.
- **Skill re-read was skipped in the one retroed session.** Same pattern as build-orchestrate: directors read the skill at session start and never re-read. The retro recommended making re-read conditional on compaction or phase count.
- **Entry mode not discussed.** The retroed session noted the user's prompt was directive enough to skip the entry mode question. But the skill says to ask. Suggestion from retro: "If the user's prompt specifies the mode, adopt it."
- **Bash for session management (git, Linear CLI) technically violates Hard Rules.** The retro suggested clarifying that git/Linear CLI operations are acceptable — they're not research actions.

---

## Directory-by-Directory Summaries

### Research-Skill Sessions (9 directories)

#### 1. `gfs-upload-failure-matrix/` — When and why does GFS upload fail?

**Phases:** 8 (heavy experiment). 162+ uploads with variable isolation.
**Judgment:** Triggered. Process judge flagged data presentation issues; resolved.
**Verdict:** PROVEN (small/medium immunity, per-project scope, key age irrelevance). MODERATE for ≥750p failure rate (N=12).

**Key findings:**
- **Two independent failure modes:** (1) per-project concurrency bottleneck (~1500 concurrent pages), (2) probabilistic server-side processing failure for files ≥750 pages (~17% rate)
- **Text extraction volume (not page count or MB) is the cost driver.** Formula: ~7.5s base + upload_time(MB) + text_extraction(volume). Dense-text 2000p files: ~55% failure. Image-only 2000p files: 0% failure.
- **importFile is worse than uploadFile for PDFs** (0/48 success rate)
- **Key age is irrelevant** — fresh and old keys fail at same rates
- **Production tier policy:** Safe (≤500p), Standard (500-750p), Careful (750-1500p), Consider-splitting (>1500p)

**Artifacts:** whiteboard.md (232 lines), 6 phase files, judgment.md

#### 2. `vertex-rag-reliability/` — Does Vertex RAG Engine share GFS's failure modes? (ENG-2060)

**Phases:** 6 (heavy experiment). 68 upload operations.
**Judgment:** Triggered. Both judges returned.
**Verdict:** PROVEN for 4/5 failure modes absent. PARTIAL for chunk visibility (100-chunk cap).

**Key findings:**
- **Vertex RAG Engine does NOT share GFS's 5 failure modes.** 40/40 concurrent uploads succeeded (vs GFS silent hangs). 0% failure at 6M chars (vs GFS 20-60%).
- **Uses Document AI Layout Parser** (enterprise-grade) vs GFS's opaque pipeline — explains reliability gap
- **Metadata is broken on SDK** (write path not wired despite proto support, GitHub #4008 closed prematurely)
- **`rag_file_ids` Supabase pre-filter workaround works.** No ID limit found (tested 1000). Invalid IDs silently ignored. Scoping and deduplication both work.
- **Queue model instead of silent hangs** — honest operation status

**Artifacts:** whiteboard.md (225 lines), 6 phase files, judgment.md

#### 3. `vertex-ai-search-reliability/` — Does VAIS share GFS's failure modes?

**Phases:** 5 (heavy experiment). 40+ uploads.
**Judgment:** Triggered. Process judge flagged narrow concurrent window; answer judge noted Q2 criterion technically failed but reframing valid.
**Verdict:** PROVEN for 4/5 failure modes absent. MEDIUM for chunk ceiling (deterministic, not silent).

**Key findings:**
- **40/40 concurrent uploads succeeded.** Deterministic (not silent) failure at ~2.7MB/1000-chunk ceiling.
- **`list_chunks()` retrieves ALL chunks** — no ceiling. Surpasses both RAG Engine (100-chunk cap) and GFS (no chunk access).
- **.xlsx works** (vs GFS/RAG failures)
- **Metadata works under load** with ~30-60s eventual consistency (not load-dependent)
- **1,000-chunk limit may be configurable** — needs investigation

**Artifacts:** whiteboard.md (128 lines), 5 phase files, judgment.md

#### 4. `gfs-store-shared-overhead/` — GFS capacity sharing topology

**Phases:** 7 (medium experiment).
**Judgment:** Triggered.
**Verdict:** HIGH for pool independence. Note: per-key finding later SUPERSEDED by upload-failure-matrix (actually per-project, not per-key — cross-key test used different GCP projects).

**Key findings:**
- **Queries and deletes are fully independent from upload contention** — zero latency degradation during upload saturation
- **`pendingDocumentsCount` is a usable gate signal** for upload health
- **Small files (≤50p) get higher concurrency capacity**
- **GEMINI_API_KEY_DEV is throttled** — should be replaced
- Partially superseded by upload-failure-matrix research (per-project scope proven there)

**Artifacts:** whiteboard.md (177 lines), 5+ phase files, judgment.md

#### 5. `network-incident/` — What killed Phil's SSE streams? (Feb 20 incident)

**Phases:** 4 + retro (forensic investigation).
**Judgment:** Triggered. Verdict: RIGOROUS with self-correction.
**Verdict:** PROVEN: Railway proxy killed at TCP level. STRONG INFERENCE: DDoS rollout was trigger.

**Key findings:**
- **TCP-level kill signature:** 6-9ms NJS→Python death propagation delta. Consistent fingerprint.
- **Railway's L4 DDoS protection rollout (Changelog #0278, Feb 20) is most likely trigger.** Same day, Layer 4 matches observed behavior.
- **Original "48% failure rate" was methodology error** — corrected to 10 failures in 14 days after process judge review
- **70% of stream deaths (7/10) have no documented external cause** — suggests internal Railway rollout
- **SSE failure patterns invisible in DB** — both tables gated on completion. Need observability post-GFS.
- Railway's documented 60s keep-alive may now be ~10s (possible DDoS-related change)

**Artifacts:** whiteboard.md (101 lines), 4 phase files, judgment.md, retro.md

#### 6. `reproduce-mode-b/` — Can we reproduce mid-stream SSE death?

**Phases:** 2 (forensics + reproduction). 1800+ test connections.
**Judgment:** Triggered. Dual judges. Process: ADEQUATE. Answer: SUPPORTED.
**Verdict:** PARTIALLY REPRODUCED — caught real infrastructure event matching signature (9 simultaneous two-hop failures at single timestamp, 0 direct failures). Single event, two-hop ≠ production topology.

**Key findings:**
- **Phil's streams died during active token flow (6.2-8.1s), not idle** — rules out 10s idle timeout
- **Two-hop vulnerability is event-correlated, not baseline** — failures cluster at specific timestamps
- **Upgrade path: Railway proxy logs (ENG-1939)**

**Artifacts:** whiteboard.md (131 lines), 2 phase files, judgment.md

#### 7. `effi-voice-poc/` — Standalone voice assistant POC

**Phases:** 5 (research → QA). No judgment triggered.
**Verdict:** Implementation complete. 32/32 tests pass. Spec-faithful.

**Key findings:**
- **Deepgram v6 SDK adaptations documented** — async iterator patterns, context-manager STT
- **pvrecorder → asyncio.Queue → async orchestrator architecture** validated
- 4-state machine design (idle/listening/thinking/speaking)

**Artifacts:** whiteboard.md (48 lines), 4+ phase files

#### 8. `eng-2204/` — VAIS unified upload + heading extraction

**Phases:** 6 (research → final push + follow-up fixes). 47 unit tests.
**Verdict:** PROVEN. Unified GCS→JSONL pipeline working. Heading chain extraction verified.

**Key findings:**
- **`heading_chain: list[str]` field extraction** from VAIS chunk content via regex
- **structData not returned in CHUNKS mode** but heading info injected at ingestion time
- **Parallel Discovery Engine queries are thread-safe** with 2.76x speedup
- **Single-step JSONL import** eliminated GCS metadata cascading failures

**Artifacts:** whiteboard.md (58 lines), 6+ phase files

#### 9. `vais-gdrive-connector/` — Google Drive OAuth connector design

**Phases:** 5 (research → spec). Implementation not started.
**Verdict:** READY-TO-BUILD. Design complete, 8 slices specified.

**Key findings:**
- **`UnifiedClient` reusable 100%** for Drive connector
- **Unified.to OAuth middleware** — 3 env vars only
- **`success_redirect` localhost for dev**, need `VAIS_PUBLIC_URL` for deployed
- `entity_type` metadata supports filtering

**Artifacts:** whiteboard.md (60 lines), 2 phase files

### Build-Orchestrate Sessions (6 directories)

These used build-orchestrate, not research. Whiteboards live under `.claude/research/` by convention. Process learnings are in the [build-orchestrate what-we-learned](../build-orchestrate/what-we-learned.md).

#### 10. `admin-usage-rebuild/` — Conversation-first /admin/usage redesign

**Phases:** 5. **Status:** COMPLETE.
**Whiteboard:** 41 lines. UUID classification bugs caught during QA.
**Artifacts:** 6 phase files

#### 11. `vais-prototype/` — Standalone VAIS exploration platform (ENG-2096)

**Phases:** 7 (including date filter fix). **Status:** COMPLETE. 9/9 sanity checks.
**Whiteboard:** 80 lines. Port allocation table, access control notes.
**Key finding worth preserving:** GCS metadata import had cascading failures — (1) metadata not indexed post-import, (2) `allow_missing` kwarg bug, (3) blob deleted before metadata update. Fix: single-step JSONL import with `data_schema="document"`.
**Artifacts:** 9 phase files

#### 12. `vrag-prototype/` — Standalone VRAG exploration platform (ENG-2098)

**Phases:** 10. **Status:** IN PROGRESS (Phase 10 — date_epoch filtering bug).
**Whiteboard:** 39 lines.
**Key finding:** UI-uploaded files have NULL `date_epoch` — SQL comparisons exclude NULLs.
**Artifacts:** 12 phase files

#### 13. `gfs-sync-unification/` — GFS event table consolidation (ENG-2030)

**Phases:** 11. **Status:** COMPLETE. 3→1 event tables, 4 trigger bugs fixed, 28 string literals→enums.
**Whiteboard:** 41 lines. Commit hashes in phase map. Migration surface for Vertex AI transition documented.
**Artifacts:** 12 phase files

#### 14. `vais-metadata-update/` — VAIS product assessment for GFS migration

**Phases:** 4 + judgment. **Status:** COMPLETE.
**Whiteboard:** 216 lines. Comprehensive VAIS vs GFS comparison.
**Judgment:** Triggered. Both judges passed.
**Key findings:** Already captured in MEMORY.md (comprehensive, updated 2026-03-12). List membership is ONLY structural migration blocker. `update_mask=["struct_data"]` works for metadata updates. Two-hop Supabase workaround viable (ANY() size limit ~262K). boost_spec works. Cross-field OR works (earlier assessment was wrong).
**Artifacts:** 4 phase files, judgment.md

#### 15. `action-items-build/` — Action Items feature (ENG-2764)

**ALREADY DELETED.** Learnings preserved in [build-orchestrate what-we-learned](../build-orchestrate/what-we-learned.md).

---

## Cross-Cutting Patterns

### 1. The judgment model is the research skill's strongest differentiator

When triggered, judges caught real issues every time:
- **GFS upload matrix:** Data presentation conflation flagged by process judge
- **Network incident:** 48% failure rate was methodology error — corrected to 10/14d
- **Reproduce-mode-b:** Confidence calibrated from PROVEN to SUPPORTED
- **VAIS metadata update:** Filter syntax corrections (cross-field OR works, earlier assessment wrong)

But judgment was only triggered in 4/9 research sessions (44%). The other 5 converged informally. **Suggestion:** Make judgment mandatory for experiment-weight sessions (where data interpretation is most error-prone).

### 2. Experiment weight produced the most rigorous findings

The 4 experiment-weight sessions (GFS upload matrix, vertex-rag-reliability, vertex-ai-search-reliability, gfs-store-shared-overhead) all produced quantified, reproducible findings with controlled variables. Research-weight sessions produced good answers but with less confidence grounding.

### 3. Pre-registered success criteria correlated with honest verdicts

Sessions that pre-registered criteria (VAIS reliability, reproduce-mode-b) had clearer verdict reasoning. Sessions without pre-registration had fuzzier "we feel done" convergence. **Suggestion:** Make pre-registration mandatory for experiment-weight phases.

### 4. Whiteboards scale well

Across 15 directories, whiteboards ranged from 39 to 232 lines. All remained readable as standalone documents. The dual-purpose design (anchor + living record) works. The longest whiteboard (GFS upload matrix, 232 lines) is the one with the most empirical data — appropriate density.

### 5. Phase file naming conventions are consistent

Regular phases: `phase-01.md`, `phase-02.md`. Experiment iterations: `phase-02a-setup.md`, `phase-02b-baseline.md`. This convention appeared organically and works well. The skill documents it.

### 6. Research → build transition is undocumented but happens

`vais-gdrive-connector/` ended at "READY-TO-BUILD" with 8 slices specified. `eng-2204/` started as research and became implementation. The skill's Known Limitations notes this gap: "When research concludes 'we should build this,' the transition to build-orchestrate isn't documented."

### 7. Supersession happens and should be tracked

`gfs-store-shared-overhead/` finding (per-key bottleneck) was superseded by `gfs-upload-failure-matrix/` (actually per-project). The overhead whiteboard doesn't note this. **Suggestion:** When later research supersedes earlier findings, update the earlier whiteboard with a "Superseded by" note — or at minimum document it in the what-we-learned.

---

## Findings Not Yet in MEMORY

Three clusters of findings from research directories aren't captured in project MEMORY:

### 1. GFS Upload Cost Model
Text extraction volume (not page count or MB) drives cost and failure rate. Dense-text 2000p: ~55% failure. Image-only 2000p: 0% failure. Production tier policy: Safe ≤500p, Standard 500-750p, Careful 750-1500p, Consider-splitting >1500p. `importFile` is worse than `uploadFile` for PDFs.

### 2. Railway SSE Stream Death Forensics
TCP-level kill signature (6-9ms propagation delta). Railway L4 DDoS rollout (Feb 20) most likely cause. 70% of stream deaths have no documented external cause. SSE failures invisible in DB (both tables gated on completion). Railway 60s keep-alive may now be ~10s.

### 3. GFS Capacity Topology
Queries and deletes fully independent from upload contention. `pendingDocumentsCount` is usable gate signal. Small files (≤50p) get higher concurrency. Per-key finding superseded (actually per-project). GEMINI_API_KEY_DEV is throttled.

---

## Open Suggestions for the Research Skill

| Suggestion | Source | Status |
|---|---|---|
| Make skill re-read conditional (compaction or >3 phases) | Retro 1 | Not implemented |
| Clarify Bash for git/Linear is acceptable in Hard Rules | Retro 1 | Not implemented |
| Skip entry mode check when user prompt is clearly directive | Retro 1 | Not implemented |
| Make judgment mandatory for experiment-weight sessions | Cross-session pattern | New suggestion |
| Make pre-registered success criteria mandatory for experiments | Cross-session pattern | New suggestion |
| Document research → build-orchestrate transition | Known Limitation #6 | Not implemented |
| Add hard phase limit (e.g., 8 phases then converge or escalate) | Lab Ideas | Not implemented |
| Add supersession tracking (later research invalidates earlier) | Cross-session pattern | New suggestion |
