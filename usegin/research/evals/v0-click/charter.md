# Charter — angle A: v0-click

You are a professor of **what "v0 of evals by tomorrow" minimally looks like for our team — the smallest concrete thing we could ship that earns the next iteration**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/evals/RESUME.md`
- `/workspaces/test-mvp/PRODUCT.md` (Effi's domain — what it does, what "good" means for it)
- `/workspaces/test-mvp/CLAUDE.md` (philosophy — laconic, default-don't-act, anti-hypothetical)
- `/workspaces/test-mvp/usegin/CLAUDE.md` (Gin's project posture)
- `/workspaces/test-mvp/usegin/zettel/zettels/z003-open-to-empty.md` and `z086-process-over-outcome-gin-s-whole-purpose-is-to-develop-the-p.md` — the bias toward minimal but real artifacts
- Inspect what exists already: `ls /workspaces/test-mvp/python-services/` and grep for any existing eval/test infrastructure that touches Effi prompts; search for "eval" / "judge" / "golden" across the repo (not just code — look in `docs/`, `tools/`, `usegin/`).
- The Slack-integration v0 shape as inspiration: `usegin/research/slack-integration/SYNTHESIS.md` + `usegin/research/slack-integration/recommendation.md` (what counted as "v0" there, what was deferred).

## Mandate

Define the smallest evals shape that (a) Oria could plausibly stand up by tomorrow, (b) the team would actually use within a week, (c) would survive contact with the first regression we throw at it. Concrete: 1 dataset, 1 scorer, 1 runner, 1 result-surface. Name them. Not a menu — a click.

## Scope

**In:**
- The single primary use-case for v0 (Effi product? Gin dev-loop? both? pick — don't punt).
- The minimum data shape (5 cases? 50? what fields per case?).
- The minimum scorer (Claude-as-judge with a binary rubric? structural assertion only? pass/fail?).
- The minimum runner (Python script? `dx evals run`? CI job?).
- The minimum result-surface (commit-to-`runs/`? Slack post? PR comment? Linear issue?).
- "What we explicitly punt" — name 3-5 things we know we'll want eventually and explicitly defer.

**Out:**
- The full landscape (angle D's job).
- The DX/orchestration shape beyond what v0 needs to exist (angle E).
- The folder layout for `usegin/evals/` (angle F's job — though you can sketch).
- Scoring methods deeply (angle C). You name the v0 scorer; you don't compare options.
- Dataset sourcing strategy beyond "where do v0's first 5-50 cases come from" (angle B).

## Working rules

- Use sub-Explore agents freely to scout existing eval/test infra in the repo.
- Capture friction as zettels via `dx zettel add --as=usegin` — silent friction is wasted signal (z009).
- Do NOT commit. The orchestrator commits after you return.
- Do NOT write outside `/workspaces/test-mvp/usegin/research/evals/v0-click/`.
- If the harness blocks a charter-named deliverable, fall back to `cat <<'EOF' | tee <path>` (z030).
- If you can't lean, name the dilemma in z026 shape.

## Deliverable

Write `/workspaces/test-mvp/usegin/research/evals/v0-click/whiteboard.md` with this shape:

```
## Top — the click
<The single concrete v0 spec, in 5-10 lines. Pick: 1 use-case, 1 dataset
shape, 1 scorer, 1 runner, 1 result-surface. Name them. The rest of the
whiteboard is "why these and not others" + "what we punt".>

## Middle — the body
<The chosen v0 in detail: dataset shape with field names, scorer pseudocode
or structure, runner shell, result-surface shape. Why this is the minimum
that earns the next iteration. What "tomorrow" means in person-hours.
What 3-5 things v0 explicitly punts and why.>

## Bottom — the open ends
<Dilemmas in z026 shape (≥2 — at minimum: "Effi-first vs Gin-first vs both"
and "judge-LLM vs structural-only for the first scorer"). Friction zettels
captured. Open questions for Lihu.>
```

Return a ≤10-line summary in chat: top finding + path to whiteboard.
