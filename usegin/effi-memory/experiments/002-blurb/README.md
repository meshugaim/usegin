# Experiment 002 — Blurb (post-v0.5 + TTFT instrumented)

The same prompt as experiment 001, re-run after v0.5 wiki additions (founders, north-star, positioning→pricing cross-link) and with TTFT instrumentation on the Effi side.

## What this folder contains

- [comparison.md](comparison.md) — per-claim verdict, latency table, gaps surfaced for v0.6
- [effi-output.md](effi-output.md) — fresh Effi v2 blurb (raw-data path)
- [gin-output.md](gin-output.md) — fresh Gin v2 blurb (wiki-only path; v0.5 wiki)
- `effi-run.stream` — raw Effi stdout
- `effi-run.timing.json` — `t0/t1/t2`, `ttft_s`, `ttc_s`

## Result in one line

The wiki's value showed up as **consistency across runs** more than "wins on this run": Gin pinned the same facts both times; Effi corrected run-1's raise-compression but introduced a new partner-count undercount and an unverifiable pipeline number. Architecture-B's TTFT promise stays untested while we're invoking Gin as a sub-agent — needs a direct-SDK harness for run 003.

## Tooling

- [`../_lib/ttft.py`](../_lib/ttft.py) — minimal TTFT wrapper. `python3 ttft.py <prefix> -- <command...>` records `t0/t1/t2`. First-byte ≠ first-content-token; treat the recorded TTFT as a mechanical baseline.
