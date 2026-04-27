# Charter — angle F: subapp-shape

You are a professor of **the standalone-sub-app shape — how `usegin/evals/` sits inside Gin's project, peer to `zettel/`, `zisser/`, `consultant/`**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/evals/RESUME.md`
- `/workspaces/test-mvp/usegin/CLAUDE.md` and `/workspaces/test-mvp/usegin/README.md` — Gin's project layout, what counts as a sub-app, what the conventions are.
- The peer sub-apps:
  - `usegin/zettel/` — read the README + CLAUDE.md + structure (`ls -la`)
  - `usegin/zisser/` — read README + CLAUDE.md + structure (it's the most recent peer build, z092)
  - `usegin/consultant/` — read CLAUDE.md
  - `usegin/translators/`, `usegin/wispr-flow-corrector/`, `usegin/comptroller/` — skim
- The "things-we-grow" idea: `usegin/things-we-grow.md`
- Memory: `project_zettel_no_privacy.md`, `project_zettelkasten_rd_track.md` — how zettel was scoped.
- For graduation question: when did Gin-internal tools graduate to product? Look at `tools/dx/` history, `tools/session/` — both were Gin-internal and now are PATH'd CLIs the team uses.

## Mandate

Design the static structure of `usegin/evals/` — folder layout, file conventions, governance, README/CLAUDE.md sketches — and decide the standalone-vs-graduates question (does this stay in `usegin/` forever, or does it have a graduation path to `tools/dx/evals/` or `python-services/evals/` if it earns it?).

## Scope

**In:**
- Folder layout for `usegin/evals/` — what goes where. Strawman:
  - `cases/` (eval cases as JSON/YAML)
  - `judges/` (judge rubrics / prompts)
  - `runs/` (committed eval-run results) OR a separate ignored output dir
  - `configs/` (eval-suite configs — which cases × which scorers × which baselines)
  - `CLAUDE.md`, `README.md` — what sits at root
- Governance: who edits cases (Lihu only? any team member? Gin can propose-via-PR?), how a case gets retired, how a baseline gets bumped.
- Two-corpora separation: do Effi product cases and Gin dev-loop cases live in the same folder under different prefixes, or in two parallel sub-trees (`usegin/evals/effi/` + `usegin/evals/gin/`)?
- Zettel integration: when a case is added because of a regression, does the case file thread to the zettel that captured the regression? (Yes — but how is the link encoded.)
- Relationship to AskEffi product code: does any code/config in `usegin/evals/` ever need to be read by `python-services/` at runtime, or is it 100% Gin-internal? If yes, define the import boundary.
- Graduation path: what would have to be true for `usegin/evals/` to become `tools/dx/evals/` (a real shipped CLI peer to `dx slack`) or `python-services/evals/` (product-CI integrated)? Name the threshold.
- README / CLAUDE.md sketches — short outlines of what would land at `usegin/evals/README.md` and `usegin/evals/CLAUDE.md` after this round.

**Out:**
- The runtime DX shape (angle E — you describe the static structure; E describes what runs).
- Tooling choice (angle D).
- Dataset and scoring methods (B, C).
- The v0 spec (angle A).

## Working rules

- Lean heavily on the zettel + zisser layouts as templates — they're the most recent peer sub-apps and the conventions there are load-bearing for consistency across `usegin/`.
- Capture friction as zettels.
- Do NOT commit. Do NOT write outside `/workspaces/test-mvp/usegin/research/evals/subapp-shape/`.

## Deliverable

Write `/workspaces/test-mvp/usegin/research/evals/subapp-shape/whiteboard.md`:

```
## Top — the click
<Recommended folder layout in tree form + the standalone-vs-graduates call.
E.g.: "Single tree under usegin/evals/ with effi/ + gin/ sub-trees;
runs/ committed for transparency; graduates to tools/dx/evals/ when
case-count > 200 OR a non-Gin team-member needs to drive a run.">

## Middle — the body
<Folder tree with one-line per node. Governance table (who edits what,
when, how). Zettel-integration mechanism (how a case thread-links to its
origin zettel). Two-corpora layout decision with rationale. Relation to
product code (boundary statement). Graduation thresholds. README/CLAUDE.md
outlines (just the headings + 1-line per heading).>

## Bottom — the open ends
<Dilemmas in z026 shape (≥2 — at minimum: "single tree vs two parallel
sub-trees for Effi-vs-Gin corpora" and "commit runs/ to git vs
gitignore"). Friction zettels. Open questions for Lihu.>
```

Return a ≤10-line summary in chat.
