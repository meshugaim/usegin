# Charter — angle F: comparative-paths

You are a professor of **the head-to-head comparison: Unified.to-mediated Slack vs direct Slack**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/slack-integration/RESUME.md`
- `usegin/research/slack-integration/unified-platform/charter.md` (angle A's charter, so you understand what they're studying)
- `usegin/research/slack-integration/slack-direct-platform/charter.md` (angle B's charter)
- The Unified.to docs (WebFetch unified.to/docs if needed)
- Slack-direct: skim Slack Bolt SDK docs
- `/workspaces/test-mvp/PRODUCT.md` for our actual ops constraints

**Note:** angles A and B are running in parallel with you. Do NOT read their whiteboards (they may not be written yet, or may be partial). You're constructing the comparison from the same primary sources independently — that's the point of parallel R&D. The synthesizer will reconcile if your conclusions differ.

## Mandate

Construct the **comparison matrix** for Unified-vs-direct, scored on these dimensions, with citations:

| Dimension | Unified.to | Direct Slack | Tradeoff |
|---|---|---|---|
| Time-to-MVP | | | |
| OAuth/install flow code we own | | | |
| Token storage we own | | | |
| Webhook plumbing we own | | | |
| Rate-limit handling we own | | | |
| Slack-feature coverage (channels, threads, reactions, files, Slack Connect) | | | |
| Per-Slack-API-version drift exposure | | | |
| Lock-in cost (cost to migrate off) | | | |
| Cost per workspace per month | | | |
| Build-twice complexity (do they share any code?) | | | |
| Customer-facing app review obligations (Slack distribution review) | | | |
| Multi-workspace install model | | | |
| Debug-ability when something breaks | | | |
| Subprocessor / DPA / compliance impact | | | |

Then answer the meta-question: **what does "build it twice" actually buy us?** Pick from:
- **Knowledge** (we learn both paths, then pick one for prod)
- **Hedge** (we keep both in prod so if Unified.to breaks/raises prices, we switch)
- **A/B** (we run customers on one, team on the other — different ergonomics)
- **Escape** (Unified for v0, direct as escape hatch when we hit Unified's ceiling)
- **Something else**

Make a recommendation in z026 shape on how to actually run "build twice."

## Scope

**In:** the comparison matrix, the build-twice meta-call.

**Out:** the per-surface UX (C/D/E) — your matrix is platform-level. Don't re-derive risks (that's G). Don't re-derive auth specifics (H).

## Working rules

- Cite sources (URLs OK, file paths OK).
- Capture friction as zettels via `dx zettel add --as=usegin`.
- Do NOT commit. Do NOT write outside your folder.

## Deliverable

`/workspaces/test-mvp/usegin/research/slack-integration/comparative-paths/whiteboard.md`:

```
## Top — the click
<The comparison's bottom line: which path wins for which surface. Plus
the build-twice verdict (knowledge/hedge/A-B/escape/other).>

## Middle — the body
<The full comparison matrix above, filled in with citations.
Build-twice meta-call rationale.>

## Bottom — the open ends
<Dilemmas in z026 shape. The meta-call may itself be a dilemma for Lihu.>
```

Return a ≤10-line chat summary.
