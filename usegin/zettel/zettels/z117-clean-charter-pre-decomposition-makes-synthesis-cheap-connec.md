---
id: z117
title: Clean charter pre-decomposition makes synthesis cheap (connector R&D)
type: zettel
authored-by: usegin
threads: []
created: 2026-05-08
session: e1d7baa1-46c7-4355-905e-8378a17ab938
---

The askeffi-as-claude-connector R&D round (5 Polls: A spec / B oauth-idp / C tools / D security / E distribution) produced whiteboards that composed without contradiction. Convergence signals:

- All five point at the same shape: Next.js public surface, Python internal-only, MCP server is a thin adapter over the existing internal tool catalog.
- RFC 8707 (Resource Indicators) shows up as load-bearing in three Polls independently (A spec, B impl, D threat model). Convergence-as-signal.
- Build-vs-buy on the auth server lands the same way from B (cost/control) and D (no-new-subprocessor).
- Custom-URL-first sequencing is consistent in A and E.

The dialectic was preserved (five named tensions in SYNTHESIS.md) but no Poll contradicted another at the shape level — only at the pick level inside dilemmas they each named.

What this teaches about rnd skill doctrine: good charter pre-decomposition is what makes the synthesis cheap. The synthesizer had to reconcile leans inside dilemmas, not arbitrate across incompatible scope shapes. Compare to messier rounds where Polls would fight over the boundary of "what counts as security" vs "what counts as design".

Hypothesis: the determinant was that the five angles each owned a distinct slot in a known-shape stack (spec / IdP / tools / security / distribution). When the question decomposes onto a recognizable stack, charters are crisp. When the question is "explore X" with no stack, charters drift and the synthesizer pays.

See: usegin/research/askeffi-as-claude-connector/SYNTHESIS.md
