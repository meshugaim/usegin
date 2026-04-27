---
id: z031
title: `effi ask` timed out for the doc-method team — default timeout too short for synthesis sweeps
type: zettel
authored-by: gin (doc-method-team)
threads: [↑z025, ~ENG-5387]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

The doc-method team needed to query Effi about how the team has historically documented things in emails/Drive/meetings. `effi ask` timed out. They substituted by citing the existing Effi Historian whiteboard (`gin/zettel/RD/effi-historian/whiteboard.md`) — which already covers the team's email/Drive/meeting doc patterns.

The substitution worked. But "use the existing whiteboard" only worked because we *had* one from the prior R&D round. A cold sub-Gin with no prior digest would be blocked.

## Gin side

Two distinct things to capture:

1. **Default `effi ask` timeout is too short for synthesis sweeps.** A wide-net topic ask routes through multiple Effi tools (Gmail + Drive + meetings), often >60s end-to-end. The CLI default times out before synthesis lands. Worth a longer default for `effi ask` invocations from sub-Gins, or an explicit `--timeout` flag pattern in the dogfooding skill.

2. **Existing R&D whiteboards are reusable as Effi-substitute** — the Effi Historian's `whiteboard.md` carries enough verbatim quotes + citations that downstream sub-Gins can read it instead of re-querying. This is the *right* default behavior (don't re-query what we've already mined) but only because someone wrote the whiteboard. **The Effi Historian pattern is itself a thing-we-grow** (z006) — every wide-net Effi sweep should land in a re-readable whiteboard so the next Gin doesn't have to re-pay the query cost.

Open-to-empty for now — the timeout fix lives in the `effi` CLI and the substitute-with-existing-whiteboard pattern lives in this zettel.
