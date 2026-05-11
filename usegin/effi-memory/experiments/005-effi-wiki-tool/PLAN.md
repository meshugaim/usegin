---
status: proposal — needs Lihu green-light
authored: 2026-05-11
authored-by: claude (effi-memory R&D)
references:
  - usegin/effi-memory/DESIGN.md (§4 — runtime, §3 — storage progression)
  - usegin/effi-memory/askeffi-app-really/_architecture.md (Architecture B)
  - usegin/effi-memory/askeffi-app-really/MEMORY.md (the MOC the eval will preload)
---

# Experiment 005 — Effi wiki tool + eval

## Question

**On average, does giving Effi access to the curated wiki make answers
faster, with quality at least as good as wiki-off?**

That's the eval bar. Binary, decidable by side-by-side comparison on a
curated question set. If the answer is yes, we build the v1 storage
mechanism (DB-as-SoT per `DESIGN.md` §3). If no, we don't ship the
mechanism regardless of how good exp 004's reconciler turns out.

## Why this experiment now, alongside 004

The two arms close different questions:

- **004** — *can we keep the wiki fresh automatically?*
- **005** — *is it worth keeping fresh?*

These are independent. 005 doesn't depend on 004 working; the eval can
run today against the manually-authored wiki we already have. And 005
gates the whole investment — until we've shown the wiki helps Effi at
runtime, the offline reconciler is speculative.

## Scope — what the prototype does and does NOT do

**Does:**

1. Add a `memory_lookup(topic: str)` tool to Effi's tool catalog in
   `python-services/agent_api`. Returns the markdown body of
   `notes/<topic>.md` from a bundled wiki, or a structured "not found"
   message including the available topic list.
2. Inject a fixed system-prompt section at session start when
   `session.project_id == ALLOWED_WIKI_PROJECT_ID`:
   - The three MOCs (`moc/company.md`, `moc/product.md`, `moc/market.md`)
   - `_conventions.md` (so Effi understands the Current/History/Conflicts/Gaps shape)
   - One paragraph of instruction: *the wiki is your fast path; use it
     freely; fall through to raw-data when insufficient.*
3. Bundle the dogfooding wiki (`usegin/effi-memory/askeffi-app-really/`)
   into the python-services image via a pre-build stage step. Path
   resolved at runtime through `EFFI_WIKI_PATH` env var (defaults
   `/app/wiki` in container; local dev overrides to source tree for
   hot iteration).
4. Run an eval of 10–15 questions against (a) wiki-disabled Effi,
   (b) wiki-enabled Effi via `effi --profile <local>` CLI. Per question
   log TTFT, time-to-final-token, full response, tool-call trace.
5. Human + LLM judge score each pair on accuracy + citation quality.
   Output: `RESULTS.md` with consolidated read.

**Does NOT:**

- Touch Supabase. Wiki is markdown bundled into the image. (Storage is
  intentionally throwaway per `DESIGN.md` §3.)
- Add `memory_search`. MOCs in the system prompt are the index; Effi
  picks the topic directly. (v1 adds search when wiki exceeds
  pre-loadable MOC; see DESIGN.md §4.)
- Support multiple wikis. One project ID hardcoded; other projects see
  no wiki and no tool. RLS gating is the v1 replacement.
- Wire the offline reconciler. Wiki updates require redeploy during exp
  005. Acceptable because iteration happens locally; production deploys
  are stable-point demos only.
- Implement absence-detection / gap-flagging. Separate concern, later
  experiment.

## Success criteria

The experiment is a **success** if all three hold:

- ✅ **Faster on average.** Wiki-enabled TTFT < wiki-disabled TTFT, mean
  across the eval set. (We expect 3–5× speedup on questions the wiki
  covers because we skip raw-data retrieval.)
- ✅ **Quality at least as good.** For every question, wiki-enabled
  answer is judged equal or better. Zero regressions. Gaps/Conflicts
  surfaced honestly (Effi quotes the Gap rather than fabricating).
- ✅ **No fabricated citations.** Every citation in a wiki-grounded
  answer resolves to a real artifact. Wiki text already has type-prefixed
  citations; Effi just propagates them — but we verify.

**Partial success** if criterion 1 holds and 2/3 mostly holds (one or
two regressions, surfaced and understood). **Failure** if any wiki
answer is materially worse, or if Effi fabricates a citation, or if the
mean TTFT regresses.

## Tool shape (concretely)

In `python-services/agent_api/tools/wiki.py` (new file):

```python
WIKI_ROOT = Path(os.environ.get("EFFI_WIKI_PATH", "/app/wiki"))
ALLOWED_WIKI_PROJECT_ID = os.environ.get("EFFI_WIKI_PROJECT_ID")

def memory_lookup(topic: str, *, ctx) -> str:
    """Read a curated wiki note about this project. Available topics are
    listed in the MOC section of your system prompt."""
    if ctx.project_id != ALLOWED_WIKI_PROJECT_ID:
        return "[wiki not available for this project]"
    safe = sanitize_topic(topic)
    path = WIKI_ROOT / "notes" / f"{safe}.md"
    if not path.exists():
        available = ", ".join(p.stem for p in (WIKI_ROOT / "notes").iterdir())
        return f"[topic '{safe}' not found. Available: {available}]"
    return path.read_text()
```

One tool. No surprises. `sanitize_topic` rejects path separators and
absolute paths (defense-in-depth even though the gate already
restricted access).

## System-prompt injection

In `python-services/agent_api/prompts/wiki_section.py` (new file):

Reads `_conventions.md` + the three MOCs at module load, concatenates
into a block. Effi's prompt assembly checks `session.project_id` and
appends the block iff it matches `ALLOWED_WIKI_PROJECT_ID`.

The injected block:

```
# Project wiki

A curated wiki of facts about this project is available to you. Use it
freely as your fast path for project-knowledge questions. Fall through
to raw data (canon search, file reading) when the wiki is insufficient
or when the user asks for source-level detail.

## How to read the wiki

[verbatim _conventions.md — explains Current/History/Conflicts/Gaps shape]

## Available notes (index)

[verbatim moc/company.md + moc/product.md + moc/market.md]

To fetch a note in full, call memory_lookup(topic).
```

Always loaded for the configured project. Effi decides per turn whether
to call `memory_lookup`.

## Bundling mechanic

- A pre-build script (`scripts/stage-wiki-for-bundle.sh`) copies
  `usegin/effi-memory/askeffi-app-really/` → `python-services/wiki/`.
- `python-services/wiki/` is gitignored.
- `python-services/Dockerfile` adds `COPY wiki/ /app/wiki/`.
- `EFFI_WIKI_PATH` defaults to `/app/wiki` in prod; local dev sets it to
  `usegin/effi-memory/askeffi-app-really/` to read straight from source.
- Container restart picks up wiki edits in dev (no Docker rebuild needed
  for local iteration).

## Access gate (deliberate v0 wart)

A single env var `EFFI_WIKI_PROJECT_ID` set to the dogfooding project's
UUID. Both the tool and the prompt-injection check it. Other projects
get neither.

This is the bit we throw away in v1. The shape it replaces: an RLS
policy on `project_wiki_notes` that gates rows by `project_id` and
existing project-membership tables. Don't elaborate the env-var gate —
it's a placeholder, not a design.

## Iteration loop

Optimized for fast turnaround:

- `effi --profile <local>` CLI talking to a local python-services
  pointed at the source markdown via `EFFI_WIKI_PATH`.
- Edit a note → restart Effi (or hot-reload if we add file watching) →
  re-run the eval question → compare.
- No Docker builds, no Railway deploys for tight loops.
- Production dogfooding-Effi deploys on stable points, not per-edit.

## Eval set (~10–15 questions)

Spans the topic surface with a mix of question shapes. Draft below;
finalize together before running.

**Factual / single-topic:**

1. "Who funded the MFN round?"
2. "What's our current burn rate?"
3. "Who are the design partners?"
4. "What's the AskEffi team size?"

**Interpretive / multi-topic:**

5. "How is the Hudson deployment going?"
6. "Are we on track to close a seed round?"
7. "Which design partner is the closest to paid?"

**Cross-cutting / synthesis:**

8. "What are the biggest risks to the business right now?"
9. "Who's been the most active contributor in the last month?"
10. "What's the relationship between Cleverly and our GTM motion?"

**Absence-probing / gap-detection:**

11. "What's our security posture?" (we have no `security.md` — Effi
    should say so, not fabricate)
12. "What's our compliance status with SOC2?" (similar — should surface
    absence cleanly)

**Episode-level (should fall through to raw-data):**

13. "What did Phil Lau say in his last call with us?"
14. "What was discussed in the Tuesday production review?"

**Adversarial / known-conflict:**

15. "Is Hudson a marquee customer?" (wiki has the qualifier — Effi
    should propagate it, not the original framing)

Per question: run twice via CLI (wiki-off / wiki-on), capture TTFT +
final-token time + full transcript + tool-call trace.

## Scoring rubric

Two judges per pair:

- **Human (Lihu + Gin together)** — read both answers side by side.
  Mark wiki-on as "better / equal / worse / regression" + a one-line
  note. Track citation correctness manually.
- **LLM judge (Claude Opus)** — same rubric, separate prompt, blinded
  to which answer came from which condition.

Disagreement between judges = flag for discussion. Per-question result:
the consensus or the unresolved disagreement.

## Output artifact

`experiments/005-effi-wiki-tool/RESULTS.md` with:

- Per-question pairs (transcript A / transcript B, judged).
- Aggregate: mean TTFT delta, mean final-token delta, win-rate, citation
  fidelity.
- A "what we learned about the wiki" section — which topics were strong,
  which were weak, what gaps Effi surfaced, where the wiki was wrong.
- A "next iteration" section feeding back into wiki content + conventions.

## Cost estimate

Trivial. Per question:
- One Effi turn each way, ~5K tokens prompt + ~1K response × 2 conditions.
- LLM judge: ~3K tokens per pair.
- ~$0.50 for the whole eval at Opus pricing. Negligible.

## Implementation order

A possible split, if delegated:

1. **Worker 1 — tool + prompt wiring.** Adds `memory_lookup`,
   `wiki_section.py`, bundling script, Dockerfile change, env vars.
   Tests it locally with a hand-crafted curl against the CLI. ~half day.
2. **Worker 2 — eval harness.** A small script that takes a list of
   questions, runs them via the `effi` CLI twice (with/without
   `EFFI_WIKI_PROJECT_ID`), captures timing + transcripts, writes per-pair
   files. ~half day.
3. **Lihu + Gin together — run the eval, score, write RESULTS.md.**

Workers 1 and 2 can proceed in parallel. Worker 1 lands first so worker 2
has something to point the eval harness at.

## The seam to v1

When 005 says "yes, wiki helps" and we're ready to ship the mechanism
to all projects, the v0 code that survives:

- `memory_lookup` signature and contract (only storage adapter changes).
- The system-prompt injection pattern (only data source changes —
  file-read → SQL query).
- The MOC pre-load model (only data source changes).

The v0 code that goes away:

- File-system storage adapter (replaced by SQL).
- `EFFI_WIKI_PROJECT_ID` env-var gate (replaced by RLS).
- Pre-build staging script + Dockerfile COPY (no longer needed).
- Hardcoded single-project assumption (replaced by per-project rows).

The DESIGN.md §3 "v0→v1 transition mechanic" lists the exact import
steps. Do them when the eval passes and project-member access surfaces
need building.

## Out of scope for this experiment

- Multi-project wiki (one hardcoded project).
- Live wiki updates without deploy (markdown is bundled at build).
- Absence-detection / gap-flagging mechanism.
- Conflict-detection mechanism.
- Offline reconciler (exp 004, parallel arm).
- Authoring UI for project members.
- LLM-as-auditor for missing topics.

## Reading order

1. `usegin/effi-memory/DESIGN.md` — frame (especially §3 storage and
   §4 runtime).
2. `usegin/effi-memory/askeffi-app-really/MEMORY.md` — the MOC the
   prompt will preload.
3. `usegin/effi-memory/askeffi-app-really/_conventions.md` — note shape
   the prompt explains to Effi.
4. This file.
5. (After running) `RESULTS.md`.
