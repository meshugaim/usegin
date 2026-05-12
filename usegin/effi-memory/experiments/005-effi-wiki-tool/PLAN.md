---
status: scaffolding underway (Worker 1 dispatched 2026-05-12)
authored: 2026-05-11
revised: 2026-05-12 — reframed from go/no-go to iterative-learning; implementation spec extracted to SPEC.md
authored-by: claude (effi-memory R&D)
references:
  - SPEC.md (sibling) — implementation spec for workers (file paths, signatures, charter steps)
  - usegin/effi-memory/DESIGN.md (§4 — runtime, §3 — storage progression)
  - usegin/effi-memory/askeffi-app-really/_architecture.md (Architecture B)
  - usegin/effi-memory/askeffi-app-really/MEMORY.md (the MOC the prompt preloads)
---

# Experiment 005 — Effi wiki tool + eval

## What we want to learn

This experiment is a learning loop, not a binary go/no-go. By giving Effi a curated wiki and a tool to read it, we want to learn:

- **Behavior** — when does Effi reach for the wiki, when does she skip it, when does she fall through to raw data? The per-question tool-call trace is the primary artifact.
- **Coverage** — which note shapes hold up under Effi's interpretation, which confuse her, which need rewording. The MOC framing is itself under test.
- **Cost/benefit** — wiki-on vs wiki-off, side by side: TTFT delta, quality delta, citation fidelity. Data that feeds back into wiki content, conventions, and v1 design — not a pass/fail gate.
- **Where the wiki is wrong** — eval exposes notes whose framing is misleading, citations that don't propagate, gaps Effi tripped over. Each finding is a wiki edit, not a verdict on the mechanism.

The v1 mechanism (DB-as-SoT per DESIGN.md §3) proceeds in parallel, informed by this experiment but not blocked on it.

## Why both arms (004 + 005) in parallel

- **004** — *can we keep the wiki fresh automatically?* (reconciler prototype)
- **005** — *what happens when Effi actually uses the wiki?* (runtime + eval)

The questions are independent. 005 can run against the manually-authored wiki we already have; it doesn't depend on 004.

## Scope (high-level)

**Does:** wire `memory_lookup(topic)` MCP tool gated by env var; preload MOC + conventions into Effi's system prompt for the dogfooding project; bundle wiki into python-services build context; add `--trace-jsonl` to the `effi` CLI for structured tool-call capture; build an eval harness; smoke-run end-to-end with 2-3 obviously-covered questions.

**Does NOT:** touch Supabase (storage is intentionally throwaway per DESIGN.md §3); add `memory_search` (MOC pre-load is the index); support multiple wikis (one project hardcoded); wire the offline reconciler (exp 004); implement absence-detection or conflict-detection mechanism; score the real eval (Lihu reviews question set first).

See SPEC.md for the implementation detail.

## Eval set (draft — Lihu reviews before real run)

15 questions across 6 shapes. The set has known issues: Q12 (SOC2) is mis-classified as absence-probing — `compliance.md` likely covers it; Q11 (security posture) is borderline — `compliance.md` is adjacent. Treat as a starting point; revise against actual wiki coverage before the real eval. Smoke-run uses a 2-3 question subset of obviously-covered Qs to prove the harness end-to-end.

**Factual / single-topic:**

1. Who funded the MFN round?
2. What's our current burn rate?
3. Who are the design partners?
4. What's the AskEffi team size?

**Interpretive / multi-topic:**

5. How is the Hudson deployment going?
6. Are we on track to close a seed round?
7. Which design partner is the closest to paid?

**Cross-cutting / synthesis:**

8. What are the biggest risks to the business right now?
9. Who's been the most active contributor in the last month?
10. What's the relationship between Cleverly and our GTM motion?

**Absence-probing (revise — see notes above):**

11. What's our security posture?
12. What's our compliance status with SOC2?

**Episode-level (should fall through to raw-data):**

13. What did Phil Lau say in his last call with us?
14. What was discussed in the Tuesday production review?

**Adversarial / known-conflict:**

15. Is Hudson a marquee customer?

Per question: run twice via CLI (`--trace-jsonl --profile agent-dev`) once with `EFFI_WIKI_PROJECT_ID` set, once unset. Capture TTFT + final-token time + transcript + tool-call trace.

## Scoring rubric

Two judges per pair (real eval, after Lihu revises the set):

- **Human (Lihu + Gin together)** — read both answers side by side. Mark wiki-on as "better / equal / worse / regression" + one-line note. Track citation correctness manually.
- **LLM judge (Claude Opus)** — same rubric, separate prompt, blinded to which answer came from which condition.

Disagreement between judges → flag for discussion. Per-question result: consensus or unresolved disagreement.

## Output artifact

`experiments/005-effi-wiki-tool/runs/<timestamp>/RESULTS.md` per run:

- **Per-question section** — both transcripts side by side. Above each, a one-line tool-call summary: `memory_lookup(design-partners) → canon_search("Hudson") → memory_lookup(customer-outcomes)`. The tool-call trace is the primary signal; the prose answer is secondary.
- **Aggregate** — mean TTFT delta, mean final-token delta, win-rate, citation fidelity rate.
- **"What we learned about the wiki"** — which notes held up, which confused Effi, which gaps got surfaced honestly, where the wiki was wrong.
- **"What we learned about Effi"** — when she skipped the wiki and why, where she over-relied on it, citation-propagation behavior.
- **"Next iteration"** — concrete edits to wiki content, conventions, MOC framing, prompt instructions.

The tool-call trace is what makes this a learning loop rather than a benchmark.

## Cost estimate

~$0.50 per full eval at Opus pricing. Negligible.

## The seam to v1

When the eval informs the v1 design (DB-as-SoT, RLS, per-project rows), the v0 code that survives:

- `memory_lookup` tool name + return shape (only the storage adapter swaps in).
- The system-prompt block structure (data source swaps file-read → SQL).
- The MOC pre-load model (data source swaps).
- `AgentConfig.project_id` (already needed for other features anyway).

The v0 code that goes away:

- File-system reads in `wiki_tool.py` (replaced by SQL).
- `EFFI_WIKI_PROJECT_ID` env-var gate (replaced by RLS).
- Bundling script + `python-services/wiki/` (no longer needed).
- Single-project assumption (replaced by per-project rows + per-membership rows).

DESIGN.md §3 "v0→v1 transition mechanic" has the import sequence.

## Out of scope

- Multi-project wiki.
- Live wiki updates without restart (markdown loaded at module init).
- Absence-detection / gap-flagging mechanism.
- Conflict-detection mechanism.
- Offline reconciler (exp 004).
- Authoring UI for project members.
- LLM-as-auditor for missing topics.
- Scoring the eval (Lihu reviews set first).
