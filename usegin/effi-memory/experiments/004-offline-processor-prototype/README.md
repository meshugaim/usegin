# Experiment 004 — offline-processor prototype

Status: **experiment under evaluation** (not a template, not a v1 spec).

A single-topic prototype of the wiki's "keep it current" half — the offline
processor. Given a curated wiki note (`notes/activity.md`) and the indexed
artifacts that arrived after the note's `updated:` watermark, propose an edit
that a human reviewer would accept as-is.

See `PLAN.md` for the design intent, success criteria, and why `activity.md`
is the test topic. See `usegin/effi-memory/DESIGN.md` for the broader frame.

## Run

```bash
cd usegin/effi-memory/experiments/004-offline-processor-prototype
uv sync
uv run python run.py
```

Output lands in `runs/<timestamp>/`:

- `proposal.json` — structured proposal (changes + citations + confidence)
- `proposal.md` — human-readable diff against the current note
- `report.md` — run metrics (artifacts processed, citations verified, cost,
  runtime)
- `rejected.md` — present only if citation verification failed; explains why

## Pipeline

1. **Fetch** — read note frontmatter `updated:` as watermark; call
   `effi --profile dogfooding dev agent-tools project-delta --after <watermark>`
   to enumerate new email/meeting/file items.
2. **Filter** — keep delta items that plausibly mention any tracked person
   (substring match on names + emails extracted from the note).
3. **Synthesize** — single `effi ask --new --json` call: paste the current
   note + filtered delta + rubric; ask for a structured proposal with cited
   evidence per claim.
4. **Render** — produce `proposal.md` showing changes vs the current note.
5. **Verify** — every cited ID must resolve. Hallucinated citations reject
   the whole proposal.

## Scope

Pure markdown read + JSON write. No Supabase. No cron. No auto-apply.
Touches only `notes/activity.md` (read-only). Proposal goes to file, not Slack.

## Layout

```
.
├── README.md
├── PLAN.md                  # design intent, success criteria
├── pyproject.toml
├── run.py                   # entry point — orchestrates the 5 stages
├── processor/               # one module per stage
│   ├── __init__.py
│   ├── fetch.py             # stage 1
│   ├── filter.py            # stage 2
│   ├── synthesize.py        # stage 3
│   ├── render.py            # stage 4
│   └── verify.py            # stage 5
└── runs/                    # per-invocation output (gitignored)
```
