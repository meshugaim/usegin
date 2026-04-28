# Slack Ingestion POC

> Overnight run, 2026-04-28 → 2026-04-29. Charter from Oria.
> Liaison Zisser owns this. Sub-Zissers (Wes/Ron/Tim/John/Sam) execute.

## Goal

End-to-end pipeline:

```
Slack messages (live where possible, fixtures where blocked)
  → canonical normalizer
  → isolated index (parallel JSON store, NOT production Effi)
  → query path returns messages with citation (channel + ts + author)
```

## What this POC is NOT

- Not a modification to production Effi code (parked).
- Not a modification to `nextjs-app/lib/slack-*` or
  `usegin/research/slack-*` (parked Slack code).
- Not a substitute for the Slack OAuth wire — Oria already has that
  decoupled (ENG-5399).

## Why parallel index, not real Effi

The charter parks production Effi. This POC writes to a self-contained
JSONL index in `index/messages.jsonl` so the *shape* of the pipeline is
proved end-to-end without touching production code. Plugging a real
Effi project in is a one-step swap once the morning review approves the
shape.

## Structure

```
slack-ingest-poc/
├─ README.md                  ← this file
├─ poc/                       ← the POC python module
│  ├─ __init__.py
│  ├─ slack_reader.py         ← live wire (S1 + S2 attempt)
│  ├─ fixture_loader.py       ← fixture-mode reader (S2 fallback)
│  ├─ normalizer.py           ← Slack JSON → canonical message (S3)
│  ├─ indexer.py              ← canonical → index (S4)
│  └─ querier.py              ← query + citation (S5)
├─ index/
│  └─ messages.jsonl          ← the parallel JSON store (gitignored
│                               for the data file; structure committed)
├─ scripts/
│  ├─ probe-live.sh           ← Oria runs this after /invite (S7)
│  └─ run-e2e.sh              ← end-to-end demo (S6)
└─ tests/
   ├─ unit/                   ← normalizer + querier unit tests
   ├─ integration/            ← E2E fixture-based test (S6)
   └─ live/                   ← live-wire half-tests (S1, S2 attempt)
```

## Running

After Oria's morning `/invite @ingestpoc` in `#social`:

```sh
bash usegin/oria-crazy-space/slack-ingest-poc/scripts/probe-live.sh
```

Tests (fixture-based, run anytime):

```sh
cd usegin/oria-crazy-space/slack-ingest-poc
uv run pytest tests/
```

## Reading the morning report

Single artifact for Oria's morning:
`usegin/oria-crazy-space/poc-reports/2026-04-29-slack-ingest.md`.

The whiteboard (`poc-reports/whiteboard-slack-ingest.md`) is the trail
of how we got there.
