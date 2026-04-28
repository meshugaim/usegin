# DoG Schema — Definition of Good

A DoG is a **markdown** document that the iterate-loop Claude reads
before, during, and after each generation. It is the stopping
condition, the rubric, and the calibration anchor — all in one file —
because all three need to be read by the same Claude in the same
context window.

DoGs are markdown (not JSON, not YAML) on purpose: the iterate director
loads the file as plain text and uses it as part of its system prompt.
Headings have stable names because the runner parses them; everything
under a heading is free-form prose the LLM reads as guidance.

This shape encodes principle 4 (DoG-driven iteration) and principle 5
(anti-Goodhart) at the document layer. Principle 1 (measurable params)
is enforced by the **Dimensions** table — every dimension has a name, a
type, a unit, and a threshold.

---

## Required sections (in order, with stable H1/H2 names)

```markdown
# DoG: <goal-slug>

## Goal
<one paragraph in plain English; what does success look like to a human reader>

## Dimensions
| name              | type     | unit          | threshold | how_measured                                         |
|-------------------|----------|---------------|-----------|------------------------------------------------------|
| <dim-slug>        | bool|float|int | <unit>   | <comparison op + value>  | <one-line: structural? judge? hybrid?>     |

## Success criteria
- **<dim-slug>:** <numeric/structural target restated; why this threshold>
- ...

## Anti-criteria
Goodhart traps — ways an output can satisfy the metric while defeating the goal.
- **<trap name>:** <one sentence describing the trap and how the dimensions catch it>
- ...

## Calibration anchors
1–3 hand-rated examples grounding the rubric. Each anchor names: the
input, the output excerpt, the per-dimension scores, and the human
rationale.

### Anchor 1 — clearly passes
- **Input:** <one-line>
- **Output excerpt:** <quoted>
- **Scores:** <dim-a>=1.0, <dim-b>=0.9, ...
- **Why:** <one sentence>

### Anchor 2 — clearly fails
- **Input:** <one-line>
- **Output excerpt:** <quoted>
- **Scores:** <dim-a>=0.0, <dim-b>=0.2, ...
- **Why:** <one sentence>

### Anchor 3 — borderline (optional but recommended)
- **Input:** <one-line>
- **Output excerpt:** <quoted>
- **Scores:** <dim-a>=0.6, <dim-b>=0.5, ...
- **Why:** <one sentence>

## Notes for the iterating Claude
Free-form. Hints about what to try, what NOT to try, prior dead-ends,
known shapes that look right but Goodhart, hand-off context.
```

---

## Section semantics

### `# DoG: <goal-slug>`
Required. The slug must equal the filename (without `.md`). The runner
asserts this on load.

### `## Goal`
One paragraph. Plain English. The reader (human or Claude) should
finish this paragraph able to recognize a passing answer in the wild,
even before reading the dimensions. If the goal cannot be stated in one
paragraph, the DoG is too broad — split into two DoGs.

### `## Dimensions`
The load-bearing table. Required columns:

- **`name`** — slug, lowercase-snake. This slug appears in case
  `expected.shape_hints[]`, run JSON, summary tables, and judge
  prompts. Stable forever once the DoG is in use.
- **`type`** — one of: `bool`, `float`, `int`. `float` is in `[0, 1]`.
  No free-text scores.
- **`unit`** — `fraction`, `count`, `boolean`, or a domain-specific
  unit (`per-claim`, `per-citation`, etc.). The unit drives how the
  scorer aggregates across cases.
- **`threshold`** — a comparison: `>= 0.95`, `== true`, `<= 0.05`.
  Parsed by the iterate director as the stop condition.
- **`how_measured`** — one of:
  - `structural` — deterministic function over the trace (e.g.
    "presence of `<source>` tag"). Implemented in
    `framework/scorers/<dim>.ts`.
  - `judge:<judge-slug>` — judged by the named judge prompt
    (`framework/judges/<judge-slug>-vN.md`).
  - `hybrid` — structural pre-filter then judge. Both must pass.

Dimensions are **independent**. A change to the prompt that moves
`citation_present` should not mechanically move
`claim_supported_by_citation`. This independence is what makes
principle 2 (per-tweak attribution) work — each dim's delta is
attributable on its own.

### `## Success criteria`
Per-dimension restatement of the threshold *with the reason*. The
threshold says "≥ 0.95"; the success criterion explains why 0.95 and
not 0.99 (calibration cost, baseline drift tolerance, real-world floor).

### `## Anti-criteria`
The Goodhart bait. Each entry names a trap (a pattern that satisfies
metric while defeating the goal) and identifies which dimension catches
it. If a trap is named here that no dimension catches, the DoG is
incomplete — add the dimension or remove the trap from scope.

This section is **mandatory** and must contain at least 2 entries.
Empty anti-criteria is a sign the author skipped the Goodhart audit.

### `## Calibration anchors`
1–3 worked examples. The judge is given these as few-shot at scoring
time (the runner concatenates them into the judge prompt). Without
anchors, two judge calls on the same answer diverge — anchors are the
ground that the judge stands on.

At least one **clear pass** and one **clear fail** are required. The
optional **borderline** anchor is the most valuable one for calibration
quality but the hardest to author; ship without it at v0 if needed.

### `## Notes for the iterating Claude`
Free-form. Read by the iterate director as guidance, not as
hard constraints. Examples:
- "Don't try to add citation tags to every sentence; the
  `claim_supported_by_citation` dimension penalizes irrelevant
  citations."
- "Prior generation 7 tried to satisfy `no_pii` by stripping all
  proper nouns; this broke `intent_match` — avoid."
- "The judge has been observed to over-credit verbose answers; keep
  outputs concise."

This section is the institutional memory of failed iterations. Append
after every `iterate` run that produced a learning; never delete entries.

---

## Forking and versioning

DoGs follow the same fork-on-edit rule as judges (CF-DV8):

- Once a DoG has been referenced by a committed run, it is **immutable**.
- To revise: copy `<goal>.md` → `<goal>-v2.md`, make the change, update
  `dog_ref` in the affected cases. The old DoG stays for historical
  comparison; the runner refers to the file path as the version
  identifier.
- The `Notes for the iterating Claude` section is the one **append-only
  exception** — adding a new bullet under it is allowed in-place
  (because it cannot change a prior run's score).

---

## How the runner consumes a DoG

1. Parse the H1 (`# DoG: <slug>`) and assert it matches filename.
2. Parse the `## Dimensions` table; build a `{name, type, unit,
   threshold, how_measured}` record per row.
3. Pass the full markdown to the judge as part of the system prompt.
4. After scoring: write per-dimension scores to the case JSON; emit
   the row in `summary.md`.
5. For iterate: after every generation, check each dimension's score
   against its threshold; stop when all pass.

---

## How a fresh reader writes a new DoG

1. Pick a goal — state it in one sentence to yourself.
2. Name 2-4 dimensions that, taken together, are sufficient evidence of
   the goal. Each must be measurable (structural or judgeable).
3. For each dimension: pick `type`, `unit`, set a threshold you can
   defend in one sentence (write the defense under `Success criteria`).
4. **Goodhart audit:** ask "what's the laziest output that scores well
   on these dimensions but doesn't actually satisfy the goal?" Write
   each failure as an anti-criterion; verify a dimension catches it.
5. Author 2 anchors (one pass, one fail). If you can't, the DoG is
   too abstract — concretize the goal.
6. Save under `<corpus>/dogs/<goal-slug>.md`. Reference from cases.

If the act takes more than 30 minutes for a focused DoG, the goal is
too broad; split.
