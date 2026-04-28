# DoG: fixture-discipline

## Goal

The agent must produce a direct, accurate answer without hallucination.
Used exclusively for offline dry-run testing of the evals framework.

## Dimensions

| name             | type  | unit     | threshold | how_measured                              |
|------------------|-------|----------|-----------|-------------------------------------------|
| answer_present   | bool  | boolean  | == true   | structural — response contains a numeric answer |
| no_hallucination | float | fraction | >= 0.90   | judge:fixture-discipline — fraction of claims verifiable from prompt context |

## Success criteria

- **`answer_present` == true** — The response contains at least one numeric value.
- **`no_hallucination` >= 0.90** — Almost all claims are grounded in the prompt.

## Anti-criteria

- **Verbose non-answers.** A response that talks around the question without providing a number fails `answer_present`.
- **Invented context.** Adding unrequested background flips `no_hallucination`.

## Calibration anchors

### Anchor 1 — clearly passes

- **Input:** "What is 2 + 2?"
- **Output:** "4"
- **Scores:** `answer_present`=1, `no_hallucination`=1.0.

### Anchor 2 — clearly fails

- **Input:** "What is 2 + 2?"
- **Output:** "The answer depends on the number system you're using, which was invented in ancient Mesopotamia around 3000 BCE."
- **Scores:** `answer_present`=0 (no direct answer), `no_hallucination`=0.2.

## Notes for the iterating Claude

This DoG is a fixture — do not use it in production eval suites.
It exists only to support offline testing of the evals runner pipeline.
