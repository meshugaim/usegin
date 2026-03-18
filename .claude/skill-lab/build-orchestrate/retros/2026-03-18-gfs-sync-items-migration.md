### 2026-03-18 — gfs_sync_items files migration (Slices 1-4 + vocab fix attempt)
**Verdict:** partially followed
**Collapse events:** 1 (director did vocab fix directly after liaison failed)
**Key observations:**

**What worked (Slices 1-4):**
- Full cycle ran for each slice: baseline → seed → spec → 2 reviewers → liaison → 4 post-reviewers → retro
- 16 reviews across 4 slices, all returned CLEAN
- Slice reordering (1→2→4→3) caught correctly by spec writer
- Test count grew from 208 → 484 with zero regressions through Slices 1-4

**What the reviews missed:**
- **Schema compatibility gap.** Slice 1 audit trigger wrote `NEW.gfs_sync_status::TEXT` as event_type (status names: `synced`, `upload_failed`). The entire existing system expected action names (`sync_succeeded`, `sync_failed`). The same migration recreated `invariant_event_violations` view using the old vocabulary. Neither spec reviewer (positive or negative) connected the two vocabularies in the same migration. 16 subsequent reviews (4 per slice) also missed it. **This led to adding a 4th review type: schema compatibility audit.**

**Interstitial fix outside the cycle (cd776432):**
- Between Slice 2 and 4, a leaf agent wrote a 677-line migration rewriting all 9 old per-entity RPCs to write `retry_exhausted` to `gfs_sync_items`. No spec, no review, no cycle.
- The fix was based on a false premise ("old trigger has no retry_exhausted branch" — it did).
- It contaminated old RPCs (email, attachment, drive) with `gfs_sync_items` knowledge — violating the scope boundary that every slice spec carefully maintained.
- The contamination survived through Slices 4 and 3 before being identified 10 hours later.

**"Pre-existing" label carried without verification:**
- 4 claim RPC test failures appeared at Slice 2 baseline. Labeled "pre-existing" without running the tests at the pre-work commit to verify. The label propagated through every subsequent baseline for 4 slices. Rule #10 of the skill ("'Pre-existing' is a claim, not a fact") was already written — from the previous GFS migration retro — and was ignored.

**CI signal silenced:**
- The db-checks trigger liveness check correctly flagged orphaned trigger branches after Slices 2+4. A CI investigation agent allowlisted them (9b155833) instead of investigating why they were orphaned. The orphaning was a direct consequence of the vocabulary split (issue #1). Silencing the signal delayed discovery.

**Suggestions:**
- Schema compatibility audit added to skill (done — 4th review type in Test-Integrity Review section)
- Rule: "No migration can be created outside the slice cycle. If a test fails between slices, it goes on the whiteboard as a blocker for the next slice. Leaf agents MUST NOT write fix migrations for shared infrastructure."
- Rule: "No test failure is 'pre-existing' without a verified check at the pre-work commit."
- The investigate-ci skill should have a rule: "CI investigation agents MUST NOT allowlist/silence check failures without explicit user approval."
