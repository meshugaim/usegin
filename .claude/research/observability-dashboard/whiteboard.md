# Observability Dashboard — Build Whiteboard

> Invoke /build-orchestrate before each phase.

## Current State
Phase: COMPLETE | Status: done
Last checkpoint: QA passed. Both pages render with real data. KPI cards, conversations table, waterfall timeline all functional.

## Goal
Build a standalone admin-only usage dashboard that surfaces all MCP tool usage, per-turn timing, and conversation analytics. Simple, readable, flexible in scope.

## Scope & Constraints
- **2 pages**: `/admin/usage` (overview + conversations + tool breakdown) and `/admin/usage/[id]` (waterfall detail)
- **Admin-only**: behind auth, not visible to regular users
- **Data sources**: agent_usage + turns + tool_observations tables (direct Supabase queries, admin RLS)
- **Don't touch DB**: use existing tables. No new migrations.
- **No new dependencies**: waterfall uses pure CSS/Tailwind (no recharts)
- **Standalone vertical**: separate route, separate server actions, separate components. Touch admin hub + FAB only.

## Phase Map
1. ~~Orient~~ — done
2. ~~Research~~ — done (3 agents: data structures, UI patterns, external concepts)
3. ~~Design~~ — done (3 divergent concepts: minimal, langfuse, ops → converged design)
4. ~~Recap~~ — merged into design convergence
5. ~~Spec~~ — done (2070-line spec in phase-05-spec.md)
6. ~~Review spec~~ — done (quality gate PASS, no scope creep, faithful to design)
7. ~~Implement~~ — done (8 commits, 17 components, liaison orchestrated)
8. ~~Review implementation~~ — done (2 bugs fixed, 2 perf improvements, TSC+lint clean)
9. ~~QA~~ — done (visual sanity PASS on both pages with real data)

## Design Decisions (Final)
1. **2-page structure** — merged overview + list on one page. Minimal was right: separate overview wastes a click.
2. **"Usage" naming** — matches existing admin naming convention. "Observability" is jargon.
3. **Waterfall timeline** — the hero component. Langfuse-inspired proportional timing bars. Pure CSS, no charting library.
4. **KPI cards with deltas** — 4 cards (exchanges, error rate, median latency, cost) + comparison to previous period. From ops concept.
5. **Status dots + tool fractions + duration heat** — inline visual signals from Langfuse. Zero-cost information density.
6. **Tool breakdown table** — RED metrics per tool on main page. No dedicated tools page (minimal was right: <20 tools).
7. **No charts for v1** — numbers communicate the same data. Escalation triggers define when to add recharts.
8. **Copy buttons on IDs + errors** — from ops. Zero cost, high incident-response value.
9. **Sentry trace link** — on detail page, constructed from sentry_trace_id.
10. **Admin client (service-role) for user email** — simplest approach for auth.users join.

## Quality Log
- Phase 2 Research, Iteration 1: **PASS**. 3 agents returned comprehensive findings.
- Phase 3 Design, Iteration 1: **PASS**. 3 divergent concepts + convergence agent → clean, buildable design.
- Phase 4 Recap: Merged into design convergence document.
- Phase 5 Spec, Iteration 1: **PASS**. Comprehensive 2070-line spec.
- Phase 6 Review, Iteration 1: **PASS**. Spec faithful to converged design, no scope creep, all edge cases covered.
