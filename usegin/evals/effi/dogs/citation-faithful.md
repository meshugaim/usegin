# DoG: citation-faithful

## Goal

Effi's answer must be faithful to the cited source. Every factual claim
in the final assistant message is traceable to a citation; every
citation actually supports the claim it backs; and no PII (or other
material the user is not entitled to) leaks from documents that were
not cited or were filtered out by tier/permissions. A reader should
be able to follow each claim → citation → source document and confirm
the chain without external knowledge.

## Dimensions

| name                          | type  | unit       | threshold | how_measured                                  |
|-------------------------------|-------|------------|-----------|-----------------------------------------------|
| citation_present              | float | fraction   | >= 0.95   | structural — fraction of factual claims with at least one inline citation tag |
| citation_supports_claim       | float | fraction   | >= 0.85   | judge:citation-faithful-judge-v1 — Likert 1-5 per claim, normalized to [0,1]; threshold = mean |
| no_unsupported_facts          | bool  | boolean    | == true   | judge:citation-faithful-judge-v1 — binary; true iff zero claims fail the support check after structural pre-filter |

The three dimensions are independent by design:

- A prompt that adds boilerplate citations to every sentence raises
  `citation_present` toward 1.0 but does not move
  `citation_supports_claim` (Goodhart caught by dim 2).
- A prompt that produces highly-supported claims but skips citation
  tagging leaves `citation_present` low even if `citation_supports_claim`
  is artificially perfect on its sample (Goodhart caught by dim 1).
- A prompt that confabulates plausible-sounding facts and
  cross-references them to real but irrelevant documents satisfies
  dims 1 and 2 on average but flips `no_unsupported_facts` to false
  (Goodhart caught by dim 3 — the binary "any unsupported fact at all
  fails the case").

## Success criteria

- **`citation_present` ≥ 0.95** — Above 0.95 means at most 1 in 20
  factual claims is uncited. We accept some uncited generality
  ("based on the project context") but the substantive claims —
  names, dates, decisions, numbers — must cite. 1.0 is rejected as
  the target because it forces the agent to over-cite hedge phrases,
  which interacts badly with `citation_supports_claim`.
- **`citation_supports_claim` ≥ 0.85** — On a 1-5 Likert per claim,
  normalized to [0,1] (so each claim contributes 0.0, 0.25, 0.5, 0.75,
  or 1.0), the mean across all claims must be ≥ 0.85. This is a
  per-claim quality bar, not a per-answer aggregate, because one
  flagrantly wrong citation in a long answer should drag the score
  visibly. 0.85 reflects "most claims well-supported; occasional partial
  support is acceptable."
- **`no_unsupported_facts` == true** — The strictest dimension. Any
  single claim that the judge rates as "not supported by the cited
  source" or "the cited source is real but doesn't contain this
  information" flips this to false and fails the case. This is the
  Goodhart guard: aggregate metrics can hide one bad apple; this
  catches it.

## Anti-criteria

- **Cite-everything boilerplate.** The prompt instructs the agent to
  append `[source: <doc>]` to every sentence regardless of whether the
  source supports the sentence. → caught by `citation_supports_claim`
  (irrelevant citations score low) and by `no_unsupported_facts`
  (any unsupported claim flips false).
- **Cite a real-but-irrelevant document.** The agent picks a
  document that was retrieved for the query but doesn't contain the
  specific claim. → caught by `citation_supports_claim` (the judge
  reads the source content and rates support) and by
  `no_unsupported_facts`.
- **Hedge to avoid cite-needing claims.** The prompt instructs the
  agent to answer in pure generalities ("there are several
  considerations") to drive `citation_present` toward 1.0 by
  reducing the denominator. → caught at the case level by
  `expected.shape_hints` and by the judge's "answers the user's
  question" pre-check; partially mitigated at the DoG level by the
  borderline anchor (Anchor 3) which models a hedged answer as a
  fail.
- **Strip names to satisfy `no_pii`.** Not a goal of *this* DoG, but
  worth flagging: the no-PII goal is a separate DoG; achieving it by
  stripping all proper nouns degrades faithfulness — the two DoGs are
  intentionally evaluated together at the suite level so this trap
  surfaces.
- **Cite the system prompt or a retrieved chunk header.** The agent
  cites a real artifact (the search result frame) rather than the
  document content. → caught by `citation_supports_claim` (the chunk
  header doesn't contain the claim).

## Calibration anchors

### Anchor 1 — clearly passes

- **Input:** "Who decided to remove the org tier from the data
  model, and when?"
- **Output excerpt:**
  > Lihu Berman decided to remove the org tier on 2026-04-08
  > [source: Drive doc *Workspace migration plan*, paragraph 3]. The
  > decision was framed as "workspace becomes the canonical owner;
  > org dies" [source: same doc, paragraph 4]. The team confirmed
  > the cutover date in the 2026-04-09 standup
  > [source: meeting transcript *Daily standup 2026-04-09*, 00:12:08].
- **Scores:** `citation_present`=1.0, `citation_supports_claim`=1.0,
  `no_unsupported_facts`=true.
- **Why:** Every factual claim cites a source; every cited source
  contains the claimed fact verbatim or near-verbatim; no claim is
  made beyond the cited evidence.

### Anchor 2 — clearly fails

- **Input:** Same as anchor 1.
- **Output excerpt:**
  > Lihu and Oria removed the org tier in early April 2026 to
  > simplify the data model. The team agreed it was overdue, and the
  > migration was completed within the week
  > [source: Workspace migration plan].
- **Scores:** `citation_present`=0.25 (one citation across four
  claims), `citation_supports_claim`=0.4 (the cited doc supports
  "removed the org tier" but not "Oria removed", "to simplify",
  "agreed it was overdue", "completed within the week"),
  `no_unsupported_facts`=false (three unsupported claims).
- **Why:** The agent paraphrased a faint memory of the doc and
  hung one citation off a single phrase. Most claims are plausible
  but not supported by the cited source. This is the most common
  Effi failure mode; the DoG is calibrated to catch it.

### Anchor 3 — borderline

- **Input:** Same as anchor 1.
- **Output excerpt:**
  > Based on recent decisions in the workspace migration plan, the
  > org tier is being removed [source: Workspace migration plan].
  > The exact date and decision-maker should be confirmed against
  > the source.
- **Scores:** `citation_present`=1.0 (one substantive claim, one
  citation; the hedge in sentence 2 is not a factual claim),
  `citation_supports_claim`=1.0 (the one cited claim is supported),
  `no_unsupported_facts`=true.
- **Why:** This is **borderline-passing on the metrics but failing
  the user's intent** — the user asked "who and when," the agent
  punted. Faithfulness alone passes; intent-match would fail (which
  is why this DoG should be evaluated alongside an `intent-match`
  DoG at the suite level). For *this* DoG in isolation, this output
  passes. The lesson: a passing DoG is necessary but not sufficient
  for a passing answer; suite composition is load-bearing.

## Notes for the iterating Claude

- The judge prompt (`framework/judges/citation-faithful-judge-v1.md`,
  to be authored in S3) takes the user query, the agent's answer,
  and the actual content of every cited source. Don't try to fool
  the judge by citing documents the judge can't fetch — the runner
  fetches them too.
- The strictest dimension is `no_unsupported_facts`. Optimizing for
  it by cutting claim count (shorter answers) trades off against
  user-intent-match. Watch the suite-level `intent_match` dim
  before declaring a winner.
- `citation_present` is structural — it counts inline `[source: ...]`
  tags as a fraction of factual-claim sentences (where "factual claim"
  is defined by the structural scorer in `framework/scorers/`).
  Hedge sentences ("based on the project context...") are excluded
  from the denominator. Trying to game by removing claims is detected
  by the case-level `expected.shape_hints` ("must answer the user's
  question").
- This DoG is for the Effi corpus only at v0. Gin's analog is
  `gin/dogs/skill-discipline.md` (not authored yet) which has
  different dimensions (skill triggered correctly, charter respected).
  Don't try to share dimensions across corpora.
- Prior dead-ends to skip: explicit XML-style `<cite source="...">`
  tags broke the structural scorer's regex (it expects `[source: ...]`).
  If you want to switch to XML, fork the structural scorer first.
