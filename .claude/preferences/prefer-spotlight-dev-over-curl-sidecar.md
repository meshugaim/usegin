---
match: \bcurl\s+.*localhost:8969
prefer: Use `spotlight-dev` — structured queries for Spotlight sidecar traces, errors, and logs (vs. raw HTTP).
---

# Why

`localhost:8969` is the Spotlight sidecar's HTTP endpoint. Hitting it with raw `curl` returns un-curated event blobs you then have to filter by hand. `spotlight-dev` exposes structured queries (recent errors, traces by transaction, logs by level) that match how we actually want to read it.

Origin: commit `9e7ff0b64` (2026-03-06), session `d2452b5e-db56-4c0c-9de0-d6029de57cff`.
