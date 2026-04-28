# Evals sub-app — agent instructions

You are working in `usegin/evals/`. Read `README.md` first (~2 min), then
`charter.md`. This file is the operating manual.

## What this sub-app is

The measurement substrate for Effi (product) and Gin (dev agent). Every
eval run, judge rubric, case file, and frozen baseline lives here. The
runner (`tools/dx/src/evals/`) drives it; the data stays here forever.

## Read-first, every time

1. `README.md` — what it is, where things live, how to drive it.
2. `charter.md` — the standing Auftragstaktik charter for all evals work.
3. `principles/` — the five load-bearing principles. Read before touching
   judges, scorers, or baselines.
4. The relevant corpus README (`effi/README.md` or `gin/README.md`).

## Standalone-repo posture

Do not import from other usegin sub-apps. Cross-reference by name, not
path. Production code does not import from here; you may read production
code to snapshot a prompt, but write only inside `usegin/evals/`.

## Where things go

| Thing | Place |
|---|---|
| New Effi case | `effi/cases/<id>.json` — front-matter + pointer shape |
| New Gin case | `gin/cases/<id>.json` or `.claude/skills/<name>/evals/evals.json` |
| New DoG doc | `<corpus>/dogs/<goal>.md` — use the DoG schema (S2) |
| New judge | `framework/judges/<judge>-v1.md` — start at v1, never edit |
| New scorer | `framework/scorers/<scorer>.*` — pure function, no side effects |
| New suite config | `framework/configs/<suite>.yaml` |
| Run results | `<corpus>/runs/<ts>-<suite>-<sha>/` — auto-written by runner |
| Baseline bump | `<corpus>/baselines/<suite>.json` — Lihu-only; commit msg must say why |
| Friction / gaps | `usegin/evals/gaps.md` (append-only) AND a zettel via `dx zettel add` |
| Autonomous iterate sandbox | `sandbox/<run-id>/` — gitignored, ephemeral |

## How to add a case

1. Write the case file with front-matter (`id`, `origin`, `threads`,
   `created`, `authored-by`, `status`).
2. For Effi: `origin: zettel|linear|session-audit`; `source_uri` must
   point to the `conversations` bucket path. For Gin: `assertions[]` in
   plain English.
3. Thread to the zettel or Linear issue that motivated it (required for
   `origin: zettel` or `origin: linear`).
4. Do not edit an existing case to retrofit it — write `supersedes:` and
   leave the old one with `status: retired`.

## Judge versioning — never edit, always fork

When a judge needs updating:
1. Copy `framework/judges/<name>-vN.md` → `framework/judges/<name>-v(N+1).md`.
2. Make your changes in the new file.
3. Update `framework/judges/CURRENT.md` to point at the new version.
4. Old version stays permanently — runs reference it by filename.

## Baseline bumps — Lihu-only

A baseline is a frozen promise. Bumping it resets the regression signal.
Only Lihu bumps baselines. Commit message shape:

```
evals: bump baseline <suite> v3 → v4 — <one-line reason>
```

## Autonomous iterate rules

`dx evals iterate` mutates prompts in `sandbox/`. It cannot touch:
- `<corpus>/cases/` — case files
- `<corpus>/dogs/` — DoG docs
- `framework/scorers/` — scorer code
- `framework/judges/` — judge rubrics

These are enforced by a PreToolUse hook (`.claude/skills/evals-iterate/`).
Do not attempt to work around the hook. If the prompt can't improve without
changing the scorer, surface the gap in `gaps.md`.

Auto-promote zone: `usegin/**` and `.claude/skills/**` only. Effi production
prompts (`python-services/agent_api/prompts/`) iterate in sandbox; Lihu
applies `winner.diff` manually.

## What NOT to do

- Do not touch production code (`nextjs-app/`, `python-services/`).
- Do not edit an existing case in-place — retire and supersede.
- Do not edit a judge in-place after its first use — fork to a new version.
- Do not bump a baseline without Lihu's explicit sign-off.
- Do not name a change without a zettel: every new case, DoG, or judge
  that isn't a pure mechanical transcription must be named in a zettel or
  a Linear comment the same turn it's created.
- Do not commit `sandbox/` contents — they are gitignored by design.

## Friction is signal

When you hit a gap — missing schema, unclear governance, ambiguous corpus
boundary — don't work around it. Append to `gaps.md` AND file a zettel via:

```bash
dx zettel add --as=usegin --threads "~<case-or-run-id>"
```

## Stop condition

Per-run: runner exits when all cases in the suite are scored and
`summary.md` is written. Per-suite: when `<corpus>/runs/<id>/summary.md`
exists with `status: complete`. Per-charter: when `charter.md`'s end-state
section is satisfied and `RESUME.md` is written (S6).
