# Scoring methods — Poll C whiteboard

Author: Poll-C (Opus, evals R&D 2026-04-27). Charter: `./charter.md`.

## Top — the click

**Structural-first, judge-second, human-third — never the reverse.** Our scorer
stack should be a three-layer pyramid in this order:

1. **Structural assertions** (cheap, deterministic, run on every case every
   run) — derived directly from the `effi-session-audit/references/pitfalls.md`
   catalog. These convert today's manual audit signals into machine checks. ~20
   concrete assertions enumerated in the body. They catch ~70% of what Lihu
   currently catches by hand, at near-zero cost.

2. **Claude-as-judge with rotated rubric, N=3 trajectory-aware** — for the
   things structure can't grade (was the answer faithful to the citations? did
   the agent answer the user's actual intent? was the synthesis useful?). N=3
   independent judges with **different rubric phrasings** of the same
   underlying property; we report mean + variance, and a single judge dissent
   is a flag, not noise. Calibrated against a **weekly 10-case human
   spot-check** (Lihu rates, we measure judge–human agreement; if Cohen's κ
   drops below ~0.6 the judge rubric is broken, not the agent).

3. **Human annotation** — only at the calibration boundary above, plus a
   **frozen golden set of ~5 "must never break" cases** (citation present,
   no-PII-leak on a known-trap input, refuses an out-of-scope ask, returns the
   right Fathom meeting for an unambiguous query, etc.) where the answer is
   exact and human-verified once.

**Trajectory: per-turn-then-aggregate, not outcome-only.** Effi is a
tool-using multi-turn agent. Outcome-only scoring (just look at the final
message) is structurally blind to the failure modes that hurt us most —
loops, parameter mismatches, ignored context, confabulation mid-trajectory
that *happens to* end with a confident answer. We score every turn against
the structural battery, then aggregate per-session with a **min/sum/max
shape** rather than a single average (one bad turn ≠ one degenerate session,
but we want to see both).

**The anti-Goodhart commitment is structural, not aspirational.** Rotated
rubric phrasings (mechanism 1) and a **periodic blind human re-baseline**
where Lihu rates 10 cases without seeing the judge's score (mechanism 2),
plus a **third "vibe judge"** that scores on a different rubric than the
primary (mechanism 3 — the dissent-detector). We do not let any single number
become the optimization target.

**Variance budget: N=3 runs per case, report median + IQR.** Effi is
non-deterministic (LLM sampling, tool-result ordering, search-index drift).
A single run is not a measurement. We commit to N≥3 from day one; cases
whose IQR exceeds half the scoring scale are flagged "high-variance" and
either re-classified (the case is genuinely ambiguous), instrumented (we're
missing a structural assertion that would explain the variance), or
quarantined (intentionally probabilistic — track separately, don't average
into the suite mean).

The full menu and the "what doesn't fit" notes are in the middle. The Lean
above is what I'd recommend angle A pick from — not the only option.

## Middle — the body

### Method inventory (with tradeoffs, calibration cost, false-positive shape)

| Method | Grades well | Grades badly | Calibration cost | False-positive shape | Runtime cost |
|---|---|---|---|---|---|
| **Structural assertions** | Tool schema validity, presence of citations, no-PII-leak, latency budget, tool-call count bounds, no-loop (same tool+args ≥3×), enrichment-status-not-pending-when-claimed, parameter-types-correct | Semantic correctness, faithfulness, helpfulness, intent-match | One-time (write the assertion), refresh on schema changes | False-negatives are the real risk (assertion fires correctly but misses a class of failure); FP rate ~0 if assertion is well-written | Microseconds — runs in-process |
| **Claude-as-judge (LLM rubric)** | Faithfulness ("does answer cite tool output"), intent-match, helpfulness, "would a human user be satisfied", answer-quality-vs-baseline | Hard ground truth (math, exact-fact retrieval), latency, anything where the judge has the same blind spot as the agent | Ongoing — judge–human agreement weekly; rubric versioning | Confident-wrong (the judge confabulates a score), sycophancy toward verbose answers, position bias in pairwise | ~$0.01–$0.05 per case per judge call; N=3 = 3× cost |
| **Golden-answer match** | Single right answer (a specific citation, a known meeting id, a fixed refusal). Catches regressions instantly. | Anything where the right answer can be phrased multiple ways. Brittle — minor agent improvements break the test. | High to author (must hand-verify the gold), low to run | False-positives when agent improves but doesn't match exact text; mitigated by `contains` / structural match instead of equality | Microseconds |
| **Human annotation** | Anything. Ground truth. | Doesn't scale. Slow. Expensive in attention. | N/A — it IS the calibration | Inter-rater disagreement; mood/fatigue effects | ~5–10 min per case; this is the bottleneck |
| **Regression-vs-baseline** | "Did this prompt change make things measurably worse?" — comparative scoring is more reliable than absolute. | "Is this good?" (you only know better/worse, not whether the floor is acceptable) | Pick a baseline run, version it; refresh on feature change | False-stable (both old and new fail; comparison says "no change") | Same as the underlying scorer × 2 (old + new) |

The five methods are **not alternatives** — they're a stack. Most production
eval frameworks (promptfoo, braintrust, openai-evals) compose them. Our
question isn't "which one" but "what mix, weighted how, calibrated against
what." See the Lean for the recommended mix.

### Trajectory scoring proposal — concrete

Effi's session JSONL is a sequence of: `user_message → [thinking | tool_call
→ tool_result]* → assistant_message → user_message → ...`. Scoring this
needs three layers:

1. **Per-turn scoring**: each assistant turn gets the full structural battery
   (loop detection, schema validity, citation presence, etc.) AND a
   per-turn judge call ("did this turn make progress on the user's intent?").
2. **Per-session aggregation**: not a mean — a **shape**. Report:
   - `min(turn_scores)` — worst turn (catches one-bad-turn cases)
   - `last(turn_score)` — final turn (catches got-there-eventually cases)
   - `count(structural_violations)` — total assertion failures across turns
   - `slope(turn_scores)` — improving or degrading? (frustration curve proxy)
   - `bool(abandoned)` — did the user stop responding mid-flow?
3. **Cross-session aggregation**: median over N=3 runs of the per-session
   shape, with IQR for variance.

Outcome-only scoring is appealing because it's cheap and matches "did the
user get what they wanted." It is **structurally blind** to: agent loops,
context-ignoring, parameter-fumble bursts, confabulation that ends in a
confident-but-wrong answer. Half of the `pitfalls.md` catalog is invisible
under outcome-only. We do not adopt it.

### Calibration loop — how we trust a Claude-as-judge score

The hard truth: a judge LLM has no access to ground truth. It scores by
reading. Without calibration, the score is a self-fulfilling prophecy.

**The loop:**

```
weekly:
  1. sample 10 cases (diverse: structural-pass + judge-flag, structural-fail
     + judge-pass, near-baseline, far-from-baseline, high-variance)
  2. Lihu rates each case BLIND (does not see judge score)
  3. compute Cohen's κ between Lihu's rating and primary judge's rating
  4. compute mean absolute difference per scoring dimension
  5. if κ < 0.6 OR MAD > 1.0 (on 0-5 scale): rubric is broken, not agent
       → revise the judge rubric
       → re-run last week's eval suite with new rubric
       → never optimize the agent against an uncalibrated rubric
  6. log every revision — rubric version is part of every score record
```

**Inter-judge agreement (N=3 with rotated rubric):** when 3 judges with
different rubric phrasings of the same property converge, that's a
high-confidence score. When they diverge, the *case* is the finding — it's
either ambiguous (good — quarantine and study) or one rubric has a bias the
others don't (good — we found a rubric bug). Treat divergence as signal,
not as noise to average away. (Memory thread:
`feedback_multi_reviewer_convergence` — independent convergence promotes a
potential-nit to real-information.)

### Anti-Goodhart mechanisms (≥2 — we propose 3)

Goodhart's Law: when a measure becomes a target, it ceases to be a good
measure. Every scorer we adopt will eventually drift if we let it. Our
defenses:

1. **Rotated rubric phrasings.** The primary "answer faithfulness" judge
   uses 3 different rubric texts (rotated per run). If all 3 converge, the
   property is real. If only one fires, the agent learned to game *that*
   phrasing. Costs ~3× the judge calls; pays for itself the first time we
   catch a Goodhart drift.

2. **Periodic blind human re-baseline.** Once a month, Lihu (or a chosen
   reviewer) rates 30 cases without seeing the prior scores. We compare
   distribution against the judge's. If the judge's mean has crept up while
   the human's hasn't, the judge is being gamed. (Threading
   `feedback_verifier_query_external_state` — when a claim is about external
   state, query it; humans are the external state for "is this good.")

3. **A "vibe judge" running an orthogonal rubric.** The primary judges score
   "answer faithfulness" and "intent match." The vibe judge scores
   something the agent isn't directly optimized against — e.g., "would a
   thoughtful PM think this answer is helpful overall?" The vibe judge is
   weakly weighted in aggregate but **strongly weighted as a dissent
   signal**: when primary scores are high and vibe is low, the case is
   surfaced for human review. This is the structural equivalent of the
   `effi-session-audit` skill's "read the JSONL even when SQL says fine."

These mechanisms are explicitly **not** about the eval suite running
correctly — they're about the eval suite remaining honest as the agent
trains against it.

### Mapping `effi-session-audit` failure-modes → structural assertions

This is the core handoff. Lihu's manual audit IS today's scorer. Every
pattern in `pitfalls.md` and `signals.md` that can be detected
deterministically should be a structural assertion in v1. From a careful
read of those two files, here are the concrete assertions:

**From `pitfalls.md` (agent failure patterns):**

| # | Assertion | Source pattern | Detection |
|---|---|---|---|
| S01 | `tool_call.error IS NULL` per tool call | All "tool-schema confusion" patterns | `len([t for t in trace.tool_calls if t.error]) == 0` |
| S02 | No parameter-name mismatch (e.g. `file_id` vs `drive_file_id`) | Parameter name mismatch across sibling tools | Schema-validate `tool_input` against the tool's declared schema; compare against sibling-tool key set |
| S03 | All numeric params are typed integers/floats, not strings | Stringified integers | Type-check `tool_input` values against schema |
| S04 | UUID-shaped params are full UUIDs, not 8-char prefixes | Truncated UUIDs fed back as input | Regex: any param keyed `*_id` matches `^[0-9a-f]{8}-...$` not `^[0-9a-f]{8}$` |
| S05 | No tool called >2× with same args in one turn | Tool called multiple times in one turn for same data | Group by `(turn_id, tool_name, hash(tool_input))`, max ≤ 2 |
| S06 | No live-fetch when cached column has the data | Live fetch when cache exists | Hard to detect generically; case-specific assertions per known-cached field |
| S07 | Tool spans complete in <p95 budget per tool | Linear-scan fallback for missing id | `tool_call.duration_ms < TOOL_BUDGETS[tool_name]` |
| S08 | Final answer cites tool outputs that exist | Confabulated answer | NLP: extract claims from final message; check overlap with `tool_result` payloads (this is judge-territory; a structural pre-filter is "any citation token appears in any tool output") |
| S09 | Agent doesn't call a tool for info already in context | Ignoring information already in context | Per-turn: scan prior messages for the requested entity; flag if tool called for it |
| S10 | Tool choice matches intent class | Tool-choice mismatch for intent | Requires intent classification — partial automation (e.g. "user mentioned 'meeting' → first tool should be in `{get_meeting, list_meetings, semantic_search}`") |
| S11 | No PII leak in final message | (implicit — security pitfall, not in audit list yet but Lihu cares) | Regex sweep for emails / phones / ids that weren't in user-visible context |
| S12 | Enrichment status is not silently `pending` when claim depends on enrichment | "Tool works, but quality degrades due to missing enrichment" | When `tool_result` includes `enrichment_status`, agent's claim about enriched fields must be prefaced or refused |

**From `signals.md` (frustration / confusion signals):**

| # | Assertion | Source signal | Detection |
|---|---|---|---|
| S13 | User does not re-ask same question semantically within session | Repeated intent | Embed all user messages in session, pairwise similarity < 0.85 |
| S14 | No "no, I meant…" / "you misunderstood" / "that's wrong" in user turns | Clarification / correction messages | Regex / classifier on user messages |
| S15 | User message length doesn't collapse late-session | Short, clipped messages later in session | `mean(user_msg_len[last_third]) > 0.4 * mean(user_msg_len[first_third])` |
| S16 | Session not abandoned mid-turn | Abandoned session | Final message is from assistant; user closed without further input → flag |
| S17 | `tool_call_count` per turn within session-relative budget | High tool_call_count single turn | `turn.tool_call_count < 3 * median(session.turns.tool_call_count)` |
| S18 | No tool-input-error burst | Tool input errors burst | Within a 5-call sliding window, error count ≤ 1 |
| S19 | Thinking/content ratio not pathological | Long thinking without action | `len(thinking_spans) / len(content_spans) < 5` and no thinking-only turns |
| S20 | Tool-loop detection (sibling of S05 at session level) | Tool looping | Same as S05 but session-wide, threshold 4 |

**Coverage:** S01–S08, S11, S17, S18, S20 are fully deterministic (cheap,
zero-FP if written carefully). S09, S13, S14, S15, S16, S19 are
near-deterministic (regex / heuristic, low-FP). S10, S12 require partial
intent-classification (judge-augmented). S06 is per-case bespoke.

This is **the v1 scorer surface** — 20 structural assertions plus a
calibrated faithfulness-judge for what S08 can't fully pin down. Angle A's
"v0 click" picks the slimmest subset of these (suggested: S01, S05, S08,
S13, S14 — the 5 that fire most often in audits).

### Variance budget — telling signal from noise

Effi runs are non-deterministic. Sources of variance:

- **LLM sampling** — temperature > 0; same input → different reasoning paths.
- **Tool-result ordering** — search results, list endpoints not perfectly
  stable.
- **Search-index drift** — VAIS / GFS reindex during run.
- **Time-relative tools** — "recent meetings" depends on wallclock.

We can't seed the LLM (Anthropic API doesn't expose seeds). We can:

- **Run N=3 per case** (default); report median + IQR.
- **Flag high-variance cases** (IQR > 0.5 × scale): three buckets:
  - **Genuinely ambiguous case** → re-author or remove.
  - **Missing structural assertion** → the variance is masking a real
    failure mode; instrument it.
  - **Intentionally probabilistic** (creative synthesis tasks where N
    correct answers exist) → quarantine; track variance as a feature, not
    a bug; never average into suite mean.
- **Snapshot tool-side state** where possible (freeze the DB read-replica
  per eval run; pin VAIS index version). Out of scope for v1; flag for
  angle E.
- **Variance budget per scorer dimension**: structural assertions should
  have IQR = 0 (they're deterministic). If they don't, the assertion is
  stochastic and broken. Judge dimensions can have IQR up to ~1.0 on a 0-5
  scale before we re-examine the rubric.

### What we did NOT include (and why — for cross-cut visibility)

- **Pairwise / preference scoring (A vs. B model comparison).** Useful for
  "is the new prompt better" but expensive and lossy as a primary score.
  Recommend angle E adopt it for the *iteration loop* (Claude tries 5
  prompts, judge picks the best) but not for the daily suite.
- **Embedding-based semantic similarity to a gold answer.** Brittle, opaque
  to debug, and the failure modes we care about aren't "wrong words" —
  they're "wrong tool, right words" or "right tool, confabulated synthesis."
  A judge call on faithfulness beats embedding similarity for our shape.
- **Latency as a primary score.** Latency is a structural assertion (S07),
  not a quality signal. A 30-second answer that's right beats a 3-second
  answer that's wrong. Track it; don't optimize against it as the headline.
- **Cost as a score.** Same logic — track in a side dimension, don't
  conflate with quality.

## Bottom — the open ends

### Dilemma 1: judge-LLM cost vs. structural coverage

> **Decision needed:** how much of the scorer mix should be judge-LLM vs.
> structural assertions, given cost?
>
> **Options:**
> - **A. Judge-heavy** (every case gets N=3 judges + structural). Best signal
>   on faithfulness/intent. ~$0.10–$0.30 per case per run. For 200 cases × 3
>   runs = ~$60–180/run. Sustainable for daily but not for every-prompt-try.
> - **B. Structural-heavy** (judge only on the 20% of cases that fire a
>   structural flag, or that diverge from baseline). ~10× cheaper but blinds
>   the judge to cases where structure passes but answer is bad
>   (confabulation that uses real citations).
> - **C. Tiered** (full structural + cheap judge always, expensive judge only
>   on flagged cases). Middle road; complexity tax in result-aggregation.
>
> **Gin's lean:** **C — tiered**, with the cheap judge being a single
> faithfulness call per session (not per turn) and the expensive judge being
> the N=3 rotated-rubric battery on flagged cases only.
>
> **Why:** structural is too cheap not to run on everything; full judge is
> too expensive to run on everything; the cases worth deep-judging are the
> ones structure already noticed as anomalous.
>
> **Price:** result-aggregation logic gets two-tier; flag triage rules need
> to be authored and maintained.
>
> **Risk:** "passes structural, low-judge-priority" cases are a known
> Goodhart vector — if the agent learns to satisfy structural and the cheap
> judge while degrading on the expensive judge's dimensions, we won't see
> it until the weekly human re-baseline. Mitigation: rotate which 5% of
> "passing" cases get the expensive judge as a sanity sample.
>
> **For Lihu to weigh:** the budget question (is $60/day for the daily
> suite acceptable?) and the cadence question (do we want every-PR eval, or
> nightly, or only on-demand?).

### Dilemma 2: trajectory vs. outcome scoring for tool-using agents

> **Decision needed:** do we score the trajectory (turn-by-turn shape) or
> only the outcome (final answer)?
>
> **Options:**
> - **A. Outcome-only.** Cheap, simple, matches "did the user get what they
>   wanted." Standard in chat-completion benchmarks (MMLU, etc.).
> - **B. Trajectory + outcome.** Score every turn structurally; aggregate
>   per-session in a shape (min/last/slope/abandoned); also score the final
>   message as outcome. More expensive, more honest.
> - **C. Trajectory-only.** Don't score the outcome separately; the
>   per-turn shape captures it. Wrong-shaped — the user cares about the
>   outcome, not our trajectory aesthetics.
>
> **Gin's lean:** **B — trajectory + outcome.**
>
> **Why:** half the failure modes in `pitfalls.md` are trajectory-failures
> that produce a confident outcome (loops, parameter fumbles, ignored
> context, mid-trajectory confabulation papered over by a final synthesis).
> Outcome-only scoring would silently bless these. We have the JSONL; we
> have the structural battery; the marginal cost over outcome-only is small
> and the visibility we gain is large.
>
> **Price:** more complex result schema; harder to communicate a single
> score to a non-engineer ("our eval score is …" gets a "which dimension?"
> follow-up). Mitigation: report a headline number (mean of session-level
> aggregates) AND the breakdown.
>
> **Risk:** trajectory metrics drift differently than outcome metrics —
> we'll see "trajectory got better but outcome got worse" cases that are
> hard to explain. That's not a bug, it's the point — but it requires
> discipline not to fold the metrics together for the executive summary.
>
> **For Lihu to weigh:** the comms question (one number or several?) and
> the question of whether per-turn judge calls are worth the cost (vs.
> per-turn structural only + per-session judge).

### Dilemma 3 — bonus, surfaced because the answer flows from above

> **Decision needed:** N=3 vs. N=1 vs. higher N for variance budget — what's
> the right default?
>
> **Options:**
> - **A. N=1.** Cheapest. Single run, single number. We've all seen this.
>   It's wrong — non-determinism is real.
> - **B. N=3.** Median + IQR. 3× cost. Catches obvious variance. Standard
>   in OpenAI's eval guidance.
> - **C. N=5+ for high-stakes cases, N=1 for cheap regression.** Tiered.
>   Complexity tax.
>
> **Gin's lean:** **B (N=3)** as the default; **N=5** for the frozen golden
> set (~5 cases — cheap to over-sample because the set is small); **N=1**
> for the iteration loop where Claude is sweeping prompts (angle E's
> domain — there, you want speed and you accept noise because you'll
> validate the winner with N=3 in the daily suite).
>
> **Why:** N=3 is the smallest N where median is meaningful and IQR exists.
> N=2 gives you "they agree or disagree" with no median. N=5+ is overkill
> for the daily suite when budget matters more.

### Friction zettels (to capture via `dx zettel add --as=usegin`)

(Captured during the writeup of this whiteboard — flagging here so the
orchestrator can decide whether to file. Per z009, friction is a
deliverable.)

- **f1** — "We don't have inter-rater agreement infrastructure." When I
  reached for κ as the calibration metric, I realized we have no place
  that stores Lihu's manual ratings to compare against. The blind
  re-baseline in mechanism 2 needs a UI or CLI affordance that doesn't
  yet exist. Cross-cut to angle E (DX) and angle F (subapp shape) — they
  should know "human-rating capture" is a first-class need, not a future
  nice-to-have.

- **f2** — "Anthropic doesn't expose seeds." Variance budget would be
  smaller and cheaper if we could pin the LLM's sampling. We can't. This
  bounds N=3-as-minimum permanently — there's no clever workaround. Worth
  a zettel because future-Gin will ask "why do we always run N≥3 when
  unit tests don't" and the answer is "because we're not testing unit
  outputs, we're sampling a distribution."

- **f3** — "Structural assertions S08 (citation faithfulness) and S09
  (ignored context) are the line where 'structural' bleeds into 'judge.'"
  I drew the line by what's deterministically detectable, but the line is
  fuzzy. A future round will probably re-cut it as "free-call
  judge-augmented assertion" — a structural framework that calls a tiny
  classifier per assertion. Out of scope here; flagging as where the
  category boundary will move.

### Open questions for Lihu

1. **What's the calibration owner?** The weekly 10-case human spot-check is
   load-bearing. Is that you (Lihu)? A rotation across the team? An
   external annotator? The answer changes the cadence, the rubric
   complexity, and the comms shape.

2. **Do we want a single headline score or a dashboard of dimensions?**
   Trajectory + outcome scoring naturally produces a multi-dimensional
   result. Some teams collapse it (one number, easier comms, hides
   information). Others publish the dimensions (more honest, harder for
   non-engineers to read). Your call — I lean dimensional with a
   "headline" derived view, but it's a UX call.

3. **Does Effi vs. Gin share a scorer stack, or are they separate?** I
   assumed shared (both are tool-using LLM agents with multi-turn
   trajectories). But Gin's "good" is "did the skill trigger right, did
   the orchestration land its charter" — a different rubric than Effi's
   "did the user get a faithful answer." Same shape, different rubric.
   The structural battery is largely portable; the judge rubrics are not.
   Want one suite with two rubric profiles, or two parallel suites?

4. **What's our tolerance for false-positive structural assertions?** S05
   (no tool called >2× with same args) will fire on legitimate retries
   after transient errors. S17 (tool_call_count budget) will fire on
   genuinely complex queries. The choice between "tight thresholds, more
   FPs, more triage" and "loose thresholds, fewer FPs, miss real
   failures" is a culture choice, not a technical one.

5. **The "anti-leakage" question is partly mine, partly angle B's.** If we
   train (RLHF / fine-tune / prompt-iterate) against the eval suite, the
   suite stops being a measure. Angle B owns where cases come from; I own
   the calibration that detects when we've Goodharted. The two need to
   talk — flag for the synthesizer.
