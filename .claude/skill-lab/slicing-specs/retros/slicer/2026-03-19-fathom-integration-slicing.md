### 2026-03-19 — ENG-2821 Fathom Meeting Integration slicing
**Verdict:** worked well (after revision)
**Collapse events:** none
**Key observations:**

**Initial slicing (10 slices):**
- AC coverage was complete from the start — 42/42 spec AC mapped to slices with no orphans. Strong.
- Slice descriptions were well-structured: each had What, AC, Verification, Seams, Context. AC were tightened per-slice (not copied from spec).
- **Sizing issues:** Slice 3 (scoping) carried 9 AC spanning UI + algorithm + state management. Slice 5 (enrichment + VAIS) spanned LLM pipeline + VAIS schema + upload + worker dispatch — multiple systems.
- **Horizontal tendencies:** Slices 7 (browse tools), 8 (search), 9 (prompt) were layer-specific. Tools weren't bundled with the slices that produce their data.
- **Slice 9 (prompt) too small** — just 2 AC for adding text to system prompt. Overhead exceeded value as a standalone issue.
- **Slice 10 bundled unrelated concerns** — error handling edge cases (unit tests) and E2E verification (integration testing) in one slice.
- **No slice map on parent issue.** Missing ordering rationale and cross-slice verification items.
- **External dependencies not surfaced.** Spec listed 3 external deps but slices didn't call them out.

**Revised slicing (11 slices) — all issues addressed:**
- Slice 3 split into 3a (ENG-3089: scoping algorithm, DB-only) + 3b (ENG-3090: config modal UI). Clean separation — algorithm testable without UI.
- Slice 5 split into 5a (ENG-3091: LLM enrichment) + 5b (ENG-3092: VAIS upload + tools). Separate failure modes, separate concerns.
- **Tools folded into vertical slices** — the biggest structural improvement. `browse_meetings` + `meeting_summary` moved into Phase 1 (ENG-3082) since they only need metadata. `get_meeting` + `list_action_items` moved into VAIS slice (ENG-3092) since they need enrichment data. Each slice now delivers a testable, demo-able capability.
- Search + prompt merged into ENG-3093. Right-sized — 7 AC, coherent concern (making meeting content discoverable).
- Error handling (ENG-3094) separated from E2E verification (ENG-3095). Different work, different verification approaches.
- Slice map added to parent issue with: AC coverage table, ordering rationale, external dependencies (ENG-2765 blocks slice 1, ENG-2688/ENG-2687 block slice 5b), canceled slice tracking.

**Minor issue in revised slicing:**
- ENG-3082's seam references say `ENG-3081a` and `ENG-3083a` — these aren't real issue IDs. Should reference ENG-3089 and ENG-3091. Copy-paste artifact from the renumbering.

**Suggestions:**
- The slicer's responsiveness to feedback was excellent — every concern was addressed with a well-motivated structural change. The pattern of "initial slice → review → revise" produced a better result than a single pass would have.
- For large specs (40+ AC), consider defaulting to the split approach for any slice exceeding ~6 AC. The original slicing had 2 slices with 8-9 AC; after revision, no slice exceeds 7.
- When renumbering slices, do a pass over all seam references to update cross-references. Stale seam IDs create confusion for implementers.
- The vertical integration pattern (data source + tools that consume it in one slice) should be the default for any integration feature. It produces slices that are independently demo-able.
