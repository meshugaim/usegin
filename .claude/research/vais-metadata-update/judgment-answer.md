## Answer Assessment

### Verdict: PROVEN

### The Question
Can we update a file's custom metadata in Vertex AI Search (Discovery Engine) after it has already been uploaded, without deleting and re-uploading the file?

### The Answer
No. The `UpdateDocument` API exists and will store metadata changes on the document record, but VAIS never re-indexes the metadata for search filtering on unstructured stores. The only reliable paths are INCREMENTAL re-import (full document replacement via JSONL upsert) or delete-and-re-upload. The codebase discovered this empirically in Feb 2026 and removed `update_document()` entirely.

### Evidence Classification

1. **"`update_document()` stores metadata but does not index it for filtering"** -- PROVEN. Empirically discovered in the codebase (phase-07-date-filter-fix), verified through search filter tests returning 0 results on post-import metadata, and documented in production code warning at `document_service.py` lines 14-17. The method was subsequently removed in commit `4dbd5733`. (Phase 1, Section 2; Phase 2, Section 1)

2. **"The UpdateDocument API exists at REST and SDK level"** -- PROVEN. Proto definitions cited (`document_service.proto`), SDK class identified (`discoveryengine_v1.DocumentServiceClient`), field-level schema documented from proto source. (Phase 1, Section 1)

3. **"INCREMENTAL re-import with JSONL works as a workaround (upsert)"** -- STRONGLY SUPPORTED. Production code uses INCREMENTAL mode for all uploads (Phase 2, Section 3, line 214). Phase-07 confirmed the JSONL `data_schema="document"` approach indexes metadata correctly. However, nobody has tested re-importing specifically for a metadata-only change on an existing document -- the evidence that INCREMENTAL upserts work for metadata comes from the general import path, not a targeted update scenario. (Phase 1, Section 3; Phase 2, Section 3)

4. **"`update_mask` on `ImportDocumentsRequest` could enable metadata-only re-import"** -- BEST-GUESS. The field exists in the proto, and the research correctly flags this as untested. No public examples, no internal experiments. The whiteboard appropriately labels it "UNTESTED." (Phase 1, Section 3; Phase 2, Section 7)

5. **"This is a limitation of unstructured stores specifically (not structured stores)"** -- BEST-GUESS. The reasoning (structured stores ARE their struct_data, so update works; unstructured stores have a separate indexing pipeline) is plausible but not empirically tested. Phase 1, Section 4 acknowledges the docs make no explicit distinction. The whiteboard does not overclaim this, so it's acceptable.

6. **"No code path exists for metadata-only updates"** -- PROVEN. Grep evidence in Phase 2 Section 1 shows zero `update_document` SDK calls. Phase 2 Section 4 confirms 70+ experiments all test initial upload, none test post-upload metadata modification. (Phase 2, Sections 1, 4, 6)

**Overall verdict rationale:** The core claim -- that `update_document()` does not index metadata on unstructured stores -- is proven through empirical failure, code removal, and production warnings. The weakest links (the `update_mask` speculation and the structured-vs-unstructured distinction) are clearly labeled as untested/uncertain and do not affect the primary conclusion.

### Gaps

1. **No fresh experiment was run.** The evidence comes from prior work (Feb 2026), not from a purpose-built experiment during this research. This is adequate for the "does it work?" question but means the behavior hasn't been re-verified against any SDK/API updates in the intervening two weeks.

2. **The `update_mask` on `ImportDocumentsRequest` remains untested.** This is the most promising workaround lead and was correctly flagged but not pursued. If the original question's motivation was "how can we update metadata cheaply?", this gap matters.

3. **Behavior for structured stores is not verified.** The research focuses on unstructured stores (correct for our use case) but if someone asks "does UpdateDocument work?" without qualifier, the answer needs the caveat.

4. **Is this a bug or by design?** Phase 1 raises this question (Section 6, item 4) but the whiteboard doesn't carry it forward. The distinction matters: if it's a bug, Google might fix it; if by design, the re-import workaround is permanent.

### Clarity

The whiteboard is well-structured and self-explanatory. Key strengths:

- The "Answer" section gives the bottom line in one sentence, then four numbered supporting points with increasing detail.
- The workaround table is immediately useful for decision-making.
- Confidence level is stated explicitly and appropriately ("HIGH (proven empirically)").
- The "Untested Lead" section is clearly separated from confirmed findings.

One minor clarity issue: the whiteboard says "INCREMENTAL re-import via JSONL -- YES (upsert)" in the workaround table, but the body text acknowledges this hasn't been tested specifically for re-import of an existing document. The table could note "expected to work" rather than unqualified "YES" to match the evidence level (strongly supported, not proven for the re-import-for-update scenario).

### Recommendations

The verdict is PROVEN for the core question, so no strengthening is needed there. For completeness:

1. **Test the `update_mask` on `ImportDocumentsRequest`** -- a quick experiment would resolve the most actionable open question and could reveal a metadata-only update path that avoids re-uploading file content.
2. **Test INCREMENTAL re-import explicitly** -- re-import an existing document with same content but different `structData`, then verify the new metadata is filterable. This would upgrade the workaround from "strongly supported" to "proven."
3. **Downgrade the workaround table entry** from "YES" to "YES (expected, untested for re-import)" to match the actual evidence level.
