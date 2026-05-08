# Experiment 001 — Blurb (the seed run)

The first vertical-slice experiment for the `usegin/effi-memory/` substrate.

## What this folder contains

- [comparison.md](comparison.md) — side-by-side analysis, accuracy verdict, gaps surfaced, next-step suggestions
- [effi-output.md](effi-output.md) — fresh Effi's blurb (raw-data path)
- [gin-output.md](gin-output.md) — fresh Gin's blurb (wiki-only path)

## Why this experiment

The blurb question failed in production on 2026-05-02 — Effi handed Lihu a confident blurb with a stale raise figure ($3M, sourced from a Jan 2026 UpWest pitch session) instead of the current $2M pre-seed SAFE (per a May 1 Qubit email). The user had to push back to get correction.

This experiment asks: would a curated, conflict-aware fact-wiki — read by Gin, not Effi — answer the same question more accurately than Effi does today against raw data?

## Setup constraints

- The wiki was scaffolded the same day, populated by extracting from the same project data Effi sees. So this isn't a wiki-with-magical-extra-knowledge vs. Effi-without; it's the same source corpus, processed differently.
- Both runs were "fresh" — new sessions/agents with no prior conversation context.
- Both ran the identical prompt.

## Result in one line

The wiki-grounded Gin output was more factually precise on the load-bearing claims (raise terms, partner accounting); the raw-data Effi output had more breadth on facts the wiki doesn't yet cover (founders, deck milestones). For the angel-blurb class, accuracy beat breadth.

See [comparison.md](comparison.md) for the per-claim analysis.
