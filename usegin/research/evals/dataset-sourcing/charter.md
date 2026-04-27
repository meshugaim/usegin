# Charter — angle B: dataset-sourcing

You are a professor of **where the eval corpus comes from for our team — both for Effi (product) and Gin (dev agent)**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/evals/RESUME.md`
- `/workspaces/test-mvp/PRODUCT.md` (Effi's domain — what conversations look like)
- `/workspaces/test-mvp/CLAUDE.md` (philosophy)
- Memory-pointers worth following: `reference_effi_session_jsonls.md` (we have full SDK transcripts of every Effi chat in Supabase `conversations` bucket — richer than Sentry), `reference_agent_records.md` (`~/agent-records` is the Gin-side equivalent, persisted to GitHub).
- Existing tooling: `~/agent-records/` (browse with `ls`), `tools/session/` (CLI for browsing/searching session JSONLs), `tools/dx/` (any prior eval/dataset attempts?).
- Effi data layout: skim `python-services/` for how conversations are stored; `bunx supabase` schema if relevant.
- Linear: any existing eval/regression-tracking issues? Run `plan list` and grep for "eval", "regression", "golden".

## Mandate

Map the realistic sources of eval cases for our team and propose a sourcing strategy. Cover: where cases come from, how they get into the eval set, how the set stays fresh, anti-leakage (don't eval on training-influenced cases), labeling cost, and the special problem of **agent-trace evals** (a "case" for an agent isn't just input→output — it's input → tool-call sequence → output, which is harder to evaluate than chat-completion).

## Scope

**In:**
- Source inventory: real Effi user sessions (conversations bucket), Gin sessions (`~/agent-records`), Linear bug-report-tagged regressions, hand-curated golden cases, synthetic / generated cases, customer reports.
- Per source: access path (already automated? manual extract?), labeling overhead, freshness (how often the corpus refreshes), bias (is the source skewed toward power users / one team / one project?).
- Two parallel corpora — Effi product cases vs. Gin dev-loop cases — what's similar, what diverges.
- Anti-leakage: how we keep eval cases out of prompt-iteration loops (or whether we even can, given dogfooding).
- Agent-trace specifics: a "case" for Effi/Gin is a conversation, not a single Q&A. How do we define case boundaries? Replay vs. counterfactual? Tool-call traces vs. final-output-only?
- The cold-start problem: where do v0's first 5-50 cases come from in the next 24 hours.

**Out:**
- Scoring methods (angle C — you produce the cases; C decides how to grade them).
- Tooling choices (angle D — promptfoo's dataset format, etc.).
- The runner / DX shape (angle E).
- The v0 minimum (angle A — they pick the v0 dataset count; you map the sources).

## Working rules

- Use sub-Explore agents to map `~/agent-records` and the conversations-bucket access path.
- Concrete examples beat abstract menus — name 2-3 actual eval cases you'd seed v0 with from real sources.
- Capture friction as zettels via `dx zettel add --as=usegin`.
- Do NOT commit. Do NOT write outside `/workspaces/test-mvp/usegin/research/evals/dataset-sourcing/`.

## Deliverable

Write `/workspaces/test-mvp/usegin/research/evals/dataset-sourcing/whiteboard.md`:

```
## Top — the click
<The load-bearing finding about where our eval corpus comes from. The
single sourcing strategy you recommend for v0, with the v1 trajectory
named. E.g.: "Cold-start with N hand-curated cases drawn from <source>;
auto-harvest from <source> within week 2; Gin and Effi share the harvester
but not the labels.">

## Middle — the body
<Source inventory table: source / access path / labeling overhead /
freshness / bias. Two-corpora split (Effi vs Gin) — what's shared,
what's parallel-but-separate. Agent-trace case-shape proposal. Anti-leakage
posture. Cold-start: 5-10 named cases from real sources. Refresh cadence.>

## Bottom — the open ends
<Dilemmas in z026 shape (≥2). Friction zettels. Open questions: who labels
when an agent-trace is "good"? Do we need human-in-loop or can we bootstrap
from existing user feedback signals?>
```

Return a ≤10-line summary in chat.
