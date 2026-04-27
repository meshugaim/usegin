# Whiteboard — angle A: v0-click

## Top — the click

**v0 = Gin-skill-evals, not Effi-product-evals.** A `dx evals run` CLI that walks
`.claude/skills/*/evals/evals.json` (the shape **already in the repo** for `spec`
and `fix-bug`), spawns each prompt through a headless Claude (Sonnet by default),
scores the transcript with one Opus Claude-as-judge call against the existing
`assertions[]`/`expectations[]` list (binary per-assertion → pass-rate per case),
and writes one JSONL line per case to `usegin/evals/runs/<utc-iso>.jsonl` plus a
ten-line markdown summary committed to the same folder.

Five names:

1. **Use-case:** Gin's own skills (start: `spec`, `fix-bug`). Effi-product evals
   are punted — they need labeled real-project data that we do not have by tomorrow.
2. **Dataset:** the `evals.json` files **that already exist** (3 cases for `spec`,
   2 for `fix-bug`). No new authoring required for v0 — five real cases is the
   right minimum.
3. **Scorer:** Opus single-prompt judge. Inputs: the case prompt, the captured
   transcript, the `assertions[]` list. Output: `{"assertion_results": [{...,
   "pass": bool, "evidence": "..."}, ...]}` → score = pass-count / total.
4. **Runner:** `dx evals run [--skill <name>]` in `tools/dx/src/commands/evals.ts`,
   using `multi-turn-headless-claude` mechanics (subprocess `claude -p ...`).
   Single-process, sequential. No parallelism in v0.
5. **Result-surface:** `usegin/evals/runs/<utc>.jsonl` (full transcripts +
   per-assertion verdicts) + `usegin/evals/runs/<utc>.md` (table: skill / case /
   pass-rate / drift-vs-last). Both committed. The .md gets read by humans and by
   future-Gin via grep. **No dashboard, no Slack post, no Linear issue, no PR
   comment in v0.**

The whole thing is ~300 lines of TypeScript leaning on infra (headless-claude
spawn, Anthropic SDK for the judge call, `dx zettel add` precedent for the
file-write shape) that already exists.

---

## Middle — the body

### Why Gin-skill-evals and not Effi-product-evals for v0

There is already a written Effi-evals spec — `docs/effi-evals.spec.md` (324 lines,
4 metrics, judge calibration, 100+-case dataset target). That spec is the *right
v1*, and it is well outside "by tomorrow" because:

- It requires a labeled corpus — ground-truth answers + required-fact lists +
  valid-source citations, agent-generated then **human-reviewed**. Even at the
  spec's own v1 floor of 10–20 cases, the human-review step is the gating
  resource. Lihu/Oria are not labeling 20 cases tonight.
- It depends on a chosen test project with rich documentation, anonymization
  decisions, and a stable file store. None of that exists pre-fab.
- The four metrics (factual accuracy, completeness, faithfulness, citation
  accuracy) each want their own judge prompt by the spec's own admission. That's
  four prompt-engineering loops, not one.

By contrast, **Gin-skill-evals already have data**. Two skills already ship with
`evals.json` files in the canonical shape:

- `.claude/skills/spec/evals/evals.json` — 3 cases, each with `prompt`,
  `expected_output`, `assertions[]` (12–13 assertions each, all binary-checkable)
- `.claude/skills/fix-bug/evals/evals.json` — 2 cases with `prompt`,
  `expected_output`, `expectations[]` (6 expectations each)

Five cases. Real. Already in git. Authored by us. Already shaped for binary
scoring. The "dataset" line item for v0 reduces to *literally* `glob
.claude/skills/*/evals/evals.json`. **Tomorrow** is not aspirational; it's
already 80% built — what's missing is the runner + judge + result file.

This also fits Oria's framing better than the product surface does. "What evals
give you is letting Claude run on it" — the thing Gin runs on overnight is
*Gin's own skills*. Iterating Effi prompts overnight requires the production
agent context, real project data, and a longer feedback loop that we don't have
by tomorrow. Iterating skill prompts overnight needs only this v0 plus a `loop`
wrapper (not in v0 scope, but cheap to add later).

### The dataset shape (already exists)

```json
{
  "skill_name": "spec",
  "evals": [
    {
      "id": 1,
      "name": "notifications",
      "prompt": "we need to add notification preferences per project — email, ...",
      "expected_output": "A complete spec with ACs covering: ...",
      "files": [],
      "assertions": [
        "Spec contains a numbered acceptance criteria table",
        "Every AC has a valid test level",
        "..."
      ]
    }
  ]
}
```

Fields the runner needs in v0: `skill_name`, `evals[].id`, `evals[].prompt`,
`evals[].assertions` OR `evals[].expectations` (normalize both to one name in the
runner — call it `criteria`). Punt: `files`, `expected_output` (judge does not
need the long natural-language target if the criteria list is the binary spec).

If a skill has no `evals.json`, it is skipped silently. Skill-author opt-in.

### The scorer pseudocode

```python
# pseudocode — actual impl in TS via Anthropic SDK
def judge_case(case, transcript) -> CaseResult:
    prompt = f"""
You are scoring a Claude-skill execution against a checklist.

The skill was given this prompt:
<<<{case.prompt}>>>

Claude responded with this transcript (final assistant turn, plus any tool
calls visible):
<<<{transcript}>>>

For each criterion below, answer pass/fail and quote one short snippet of
evidence (or write "no evidence" if fail).

Criteria:
{numbered_list(case.criteria)}

Return JSON: {{"results": [{{"i": 1, "pass": true, "evidence": "..."}}, ...]}}
"""
    resp = anthropic.messages.create(
        model="claude-opus-4-7",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse(resp)
```

One judge call per case. Opus, because the criteria are nuanced ("Spec does not
prescribe test code, mock strategies, or specific function signatures" needs
real reading, not regex). Five cases × one Opus call ≈ pennies + ~30s wall
clock. Good enough for a tomorrow-shipped v0.

**Anti-Goodhart hedge in v0:** the judge prompt explicitly asks for *evidence
snippets*, not just verdicts. A future-Gin or human reviewing the run can spot a
judge that's pattern-matching cheaply. We're not solving Goodhart in v0; we're
making it *visible*.

### The runner shell

```bash
dx evals run                 # all skills with evals.json
dx evals run --skill spec    # one skill
dx evals run --case spec:1   # one case
dx evals run --model sonnet  # override the under-test model
dx evals show <run-id>       # pretty-print a past run
dx evals diff <a> <b>        # which cases regressed since run a
```

Implementation seam: `tools/dx/src/commands/evals.ts`, mirrors the existing
`tools/dx/src/commands/{set,sync,status}.ts` shape. Spawning the under-test
Claude reuses `multi-turn-headless-claude` patterns (subprocess `claude -p` with
captured stdout + JSONL parse).

For the v0 click: **only `dx evals run` is required**. The other subcommands
are 30-line follow-ups, not blockers.

### The result-surface

Per run, two files written under `usegin/evals/runs/`:

- `<utc-iso>.jsonl` — one line per case:
  ```json
  {"run_id": "...", "skill": "spec", "case_id": 1, "case_name": "notifications",
   "model_under_test": "sonnet-4-5", "judge_model": "opus-4-7",
   "criteria_total": 13, "criteria_passed": 11, "score": 0.85,
   "transcript_path": "transcripts/<run>/spec-1.txt",
   "verdicts": [{"i": 1, "pass": true, "evidence": "..."}, ...]}
  ```
- `<utc-iso>.md` — human-readable table:
  ```
  # Eval run 2026-04-27T22:14Z
  Model under test: sonnet-4-5  |  Judge: opus-4-7  |  5 cases  |  6m12s

  | skill   | case            | pass | total | %    | Δ vs last |
  |---------|-----------------|------|-------|------|-----------|
  | spec    | notifications   | 11   | 13    | 0.85 | +0.08     |
  | spec    | action-items    | 12   | 13    | 0.92 | =         |
  | spec    | bucket-prefixes | 9    | 12    | 0.75 | -0.17 ⚠   |
  | fix-bug | share-modal     | 5    | 6     | 0.83 | =         |
  | fix-bug | sync-mismatch   | 4    | 6     | 0.67 | =         |

  Regressions vs last run: spec/bucket-prefixes (-0.17).
  See transcripts/<run>/ for full traces.
  ```

`Δ vs last` is computed by reading the most recent prior `.jsonl` in the same
folder. Trivial to implement; high signal per byte. Both files committed; the
md scrolls in `git log` and is greppable from any future agent.

### Why this is the minimum that earns the next iteration

The acid test for "earns the next iteration" is: *can Lihu run this once tomorrow
and decide whether to invest in v0.5 vs. delete it?* All four pieces below are in
service of that decision:

1. **Five real cases** — enough that one regression is statistically suggestive,
   not just noise. Two cases would let any one criterion be the whole signal.
2. **Real assertion lists** — already team-authored, not synthesized for the
   demo. If the v0 produces a bad number, we know whether it's the runner, the
   judge, or the skill.
3. **Drift-vs-last in the surface** — without this, every run is in isolation
   and the "is this useful" question takes weeks to answer. With it, the second
   run is already informative.
4. **JSONL + md, both committed** — the format works for both human-reading and
   programmatic-comparison from day one. No "we'll add a dashboard later"
   dependency.

If all four land tomorrow, v0.5 is obvious: add `loop` wrapping for
overnight-iteration (Oria's "let Claude run on it"), add a `dx evals init <skill>`
to lower the friction of *adding* an `evals.json` to a third skill, and *then*
start the Effi-product side from the spec that already exists.

### What "tomorrow" means in person-hours

Estimated for one focused Oria-day (~6 hours of actual coding):

- ~1h: scaffold `tools/dx/src/commands/evals.ts` + glob discovery of
  `.claude/skills/*/evals/evals.json` (mirror `tools/dx/src/commands/sync.ts`
  shape)
- ~2h: spawn-and-capture the under-test Claude transcript (steal from
  `multi-turn-headless-claude` patterns; the harness shape is solved)
- ~1h: judge prompt + Anthropic SDK call + JSON-extract (the judge prompt is the
  only real prompt-engineering work; one Opus call, structured output)
- ~1h: result-surface writers (jsonl + md table generators + drift-vs-last
  lookup)
- ~1h: drive end-to-end on the existing 5 cases, look at actual numbers, fix the
  judge prompt where it disagrees with hand-grading, commit.

Slack from contingency: ~2h. Realistic ship: end of tomorrow, not "by lunch."

### The 5 things v0 explicitly punts

1. **Effi-product evals.** The spec at `docs/effi-evals.spec.md` is the right v1
   target; it's not the right v0 target. Punt until we've felt the v0 surface
   for a week and decided we want it. The corpus-labor cost is the gate.
2. **Multi-judge calibration / inter-judge agreement.** v0 is single-Opus-judge.
   When we don't trust a number, we read the transcript by hand. Promote to
   multi-judge when single-judge disagrees with hand-grading on >1 case in
   ten — earliest signal that calibration matters.
3. **Trajectory / agent-trace scoring.** v0 scores the *final transcript*, not
   the tool-call sequence. Skill cases are short enough that the final
   transcript carries most signal. Trajectory scoring (did the skill take the
   right path, not just produce a passable output) is angle C's territory and
   genuinely hard; v0 doesn't try.
4. **Parallelism.** Sequential runs. Five cases × ~1min each = 5min wall clock,
   tolerable. Parallel spawning has its own bug surface (rate-limit, race in
   transcript capture) that v0 doesn't need.
5. **CI / scheduled / autonomous-iteration.** v0 is `dx evals run`, manually
   invoked. No PR check, no nightly cron, no `loop` wrapper, no Slack post on
   regression. **All of those are easy to add later** because the JSONL + md
   surface is read-by-grep — the wrappers attach to the surface, not the runner.
   Adding them in v0 doubles the scope without doubling the value.

---

## Bottom — the open ends

### Dilemmas (z026 shape)

**D1 — Effi-first vs Gin-first vs both.** *(Charter explicitly named this one.)*
- (a) Effi-first. Higher business value; aligns with the spec already on disk.
- (b) Gin-first. **Tomorrow-feasible** because data already exists; aligns with
  Oria's "let Claude run" framing on the substrate Gin already controls.
- (c) Both in parallel. Doubles scope; violates "by tomorrow."
- **Lean: (b).** Effi-first is the right v1 *after* the surface is felt. The
  data-labor cost is the differentiator: Gin-skill-evals are zero-label-cost
  (we wrote the assertion lists already, by hand, for skill QA); Effi-evals are
  high-label-cost. Tomorrow forces (b).
- **Price:** Effi-product regression-protection waits a week+. Mitigation:
  document the v0 result-surface clearly enough that the Effi-spec author can
  reuse the exact same JSONL/md pattern when corpus is ready.
- **Risk if wrong:** Lihu wanted product-side ROI immediately. If the meeting
  trigger was "we have a flagship customer worried about regressions," (b) is
  insufficient. Need to ask.

**D2 — Judge-LLM vs structural-only for the first scorer.** *(Charter explicitly
named this one.)*
- (a) Claude-as-judge against the existing assertion lists.
- (b) Structural-only: regex / JSON-shape / file-presence assertions on the
  transcript. No LLM in scoring loop.
- (c) Hybrid: structural for assertions that can be cheaply structural, judge
  for the rest. Per-assertion routing at config time.
- **Lean: (a).** The existing assertion lists in `evals.json` are written in
  natural language ("Spec does not prescribe test code, mock strategies, or
  specific function signatures") — they are **not** mechanically checkable. To
  go (b) we'd have to *rewrite* the assertion lists, which violates "use what
  exists." (c) is the right v1 once we know which assertions are commonly
  reusable as structural; v0 doesn't yet have that signal.
- **Price:** Judge cost (~$0.05 per run, negligible) + judge-bias risk
  (calibration debt, see punt #2).
- **Risk if wrong:** Judge consistently grades wrong on a class of assertion;
  we burn a week debugging the judge prompt. Mitigation: the JSONL has every
  per-assertion verdict + evidence — we can hand-grade five cases against the
  judge in one sitting and recalibrate fast.

**D3 — Where does the JSONL/md output live?**
- (a) `usegin/evals/runs/` — committed. Visible to humans, greppable by
  future-Gin, persisted across machine.
- (b) `~/agent-records/evals/` — Gin-records-style, auto-synced to GitHub but
  out of the main tree (per `reference_agent_records.md`).
- (c) Local-only (`.gitignore`'d). Fastest, but invisible cross-machine.
- **Lean: (a).** Evals are an artifact of the *project*, not of any one Gin
  session. Committed-in-tree means PR review can see them, autosync collisions
  are the normal commit-collision shape (handled), and the meaningful unit is
  the round-of-runs not the per-machine record. (b) is right for transcripts
  (large, per-session, ephemeral interest); (a) for verdicts (small, team-level,
  durable interest). v0 probably wants the transcripts in (b) and the verdicts
  in (a) — call this out in the runner spec.
- **Price:** Larger commits over time. Mitigation: jsonl is small (~3kb/run),
  md is tiny; transcripts (the big files) are in (b) anyway. Years of v0 fits
  in <50 MB.
- **Risk if wrong:** Repo bloat if transcripts leak into (a). Mitigation:
  `.gitignore` rule on `usegin/evals/runs/transcripts/` from day one.

**D4 — Does v0 graduate Gin-internal `dx evals` to a `tools/evals/` standalone,
or stay nested under `dx`?**
- (a) Stay under `dx` as a subcommand. Mirrors `dx slack`, `dx zettel`, `dx
  his`. One install path, one help surface.
- (b) Promote to `tools/evals/` from day one (its own bin, its own deps).
- **Lean: (a).** Same reasoning as `dx slack` and `dx zettel` — `dx` is the
  agreed-on Gin toolbelt; new verbs go there until they earn their own bin.
  Promotion is angle F's question, not v0's.
- **Price:** None at v0. If it grows to need its own deps (e.g. dataset
  generators), promotion cost is a half-day rename.

**D5 — Does v0 cover *all* skills' `evals.json`, or only the two that exist?**
- (a) All — glob `.claude/skills/*/evals/evals.json` and run whatever is found.
- (b) Hardcode to `spec` and `fix-bug` for v0 to limit blast radius.
- **Lean: (a).** Glob is one extra line of code, and "skill-author opt-in"
  through `evals.json` presence is the cleanest discovery model. Skipping a
  third skill if it ever lands is silently bad UX.
- **Price:** None.

### Friction zettels captured

None this turn. The investigation was clean — the artifacts I needed
(`evals.json` shapes, the slack-integration template, the existing Effi-evals
spec, the dx command shape) were all easily discoverable. The biggest "friction"
was actually the opposite: the **existence of `docs/effi-evals.spec.md` was
not in the RESUME.md round summary**, and a less-careful reading would have
duplicated its work or framed v0 around the product surface without noticing
that the v1 target already exists in spec form. Worth a zettel only if a sister
angle also missed it; otherwise a synthesis-time observation.

### Open questions for Lihu

1. **The Effi-vs-Gin lean (D1) is the only meeting-shaped question.** Was Oria's
   "v0 of an eval framework by tomorrow" pointing at Effi prompts (because the
   product is what ships) or at the framework itself (because that's what
   *enables* prompt-iteration)? If Effi-prompts, v0 is bigger than tomorrow and
   we have to push back. If framework, this whiteboard is the answer.
2. Is `usegin/evals/runs/` the right home for committed run output, or do you
   want it under a top-level `evals/` peer to `usegin/`? The standalone-vs-graduates
   question is angle F's, but D3 needs *some* answer to ship v0.
3. Do you want a `dx evals run` invocation included in `just agent-dev` or
   pre-push, or strictly manual until the surface is felt? v0's punt #5 says
   manual; happy to be overruled.

### What sister angles should know from this whiteboard

- **B (dataset-sourcing):** v0 deliberately uses *only* the assertion lists
  already in `.claude/skills/*/evals/evals.json` — five cases. Your job is the
  v1+ corpus question (Effi sessions, Linear regressions, synthetic). Treat
  this v0 dataset as the floor, not the model.
- **C (scoring-methods):** v0 is single-Opus-judge against natural-language
  assertions. Your job is to design the v1+ scoring stack (multi-judge,
  trajectory, structural). v0 deliberately doesn't try.
- **D (landscape):** v0 is build-not-buy because the assertion-list shape is
  team-authored and lock-in to a vendor for five cases is silly. Your job is
  whether v1+ should adopt promptfoo / braintrust / Inspect. The v0 result
  format (JSONL + md) is intentionally vendor-neutral — easy to migrate either
  direction.
- **E (dx-let-claude-run):** v0 is manual `dx evals run`. The "let Claude run
  on it" overnight-iteration is your domain — v0 produces the substrate, you
  design the autonomous loop (`loop`/`ralph`/cell wrapping `dx evals`).
- **F (subapp-shape):** v0 puts files at `usegin/evals/runs/`. Final folder
  layout is yours; v0 just needs the `runs/` address to write to. Treat the
  ship-by-tomorrow constraint as the floor on convention.
