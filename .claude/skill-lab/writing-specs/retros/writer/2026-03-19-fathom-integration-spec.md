### 2026-03-19 — ENG-2821 Fathom Meeting Integration spec
**Verdict:** worked well
**Collapse events:** none
**Key observations:**
- **Problem framing is excellent.** Opens with a concrete gap (meetings in Fathom, Effi can't access them), grounded in spike findings (ENG-2811) with quantitative data from a real account (80 meetings, 22 speakers, 123 days). The spike findings table maps each finding to an implication — readers immediately understand *why* each architectural decision exists.
- **Structure is highly scannable.** Heavy use of tables throughout: scope (In/Out), feature toggle (per-layer), UI states, data model (per-table, per-column), sync states, tool params, VAIS metadata fields, decisions (with alternatives + rationale). Prose is minimal and purposeful.
- **Decision documentation is thorough.** Two separate decision tables (6 scoping decisions, 7 VAIS decisions) each with "Alternatives considered" and "Rationale" columns. Architecture choices are justified, not just stated.
- **AC coverage is comprehensive.** 42 numbered criteria across 7 categories (connection, scoping, sync, tools, search, prompt, errors, E2E). Each has a test level. Covers happy path, error cases (enrichment failure, API failure, disconnect during sync), and edge cases (0 meetings, 80+ meetings, unmatched speakers).
- **Reference files table is thorough.** 12 entries with specific file paths pointing implementers at exact code to follow. Includes spike experiment, production client, existing integration patterns, related specs.
- **Feature toggle section is unusually complete.** Per-layer table showing behavior when flag is off vs on (frontend, MCP tools, system prompt, API, sync worker). Both frontend and backend flag names specified.
- **VAIS integration section is detailed and well-structured.** Covers store sync via gfs_sync_items, architecture (one store, metadata filtering), access level convention (external-only tagging with fail-closed safety property), schema extension (v3 fields), upload pattern, workspace toggle interaction. Each with clear rationale.
- **Spec divergence is the one gap.** The on-disk spec (`docs/specs/fathom-integration.md`) evolved significantly from the Linear issue description. On-disk has general `meetings`/`meeting_connections` tables (not `fathom_*`), `gfs_sync_items` integration, full VAIS section, 42 AC (Linear has 39 with different content), and a Dependencies section. Anyone reading from Linear sees a stale, materially different version. The slices correctly reference the on-disk version, but the parent issue is misleading.
- **Dependencies section is valuable.** Lists 3 external dependencies (ENG-2765, ENG-2688, ENG-2687) with "Why" column. This is not common in specs but directly useful for slicing and scheduling.

**Suggestions:**
- When a spec is revised on disk, update the Linear issue description to match. The divergence creates confusion — slices reference AC numbers that don't exist in the Linear parent.
- Consider adding a "Revision history" note to the spec when significant changes are made (e.g., "v2: generalized from fathom_* to meetings/meeting_connections, added VAIS integration section").
