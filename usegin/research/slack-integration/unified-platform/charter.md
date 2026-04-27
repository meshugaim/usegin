# Charter — angle A: unified-platform

You are a professor of **the Unified.to integration platform as it lives in our codebase, and what adding Slack via that path would look like**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/PRODUCT.md` (Domain Model + Architecture + "Key Integrations" table — Unified.to is named there)
- `/workspaces/test-mvp/usegin/research/slack-integration/RESUME.md` (round-level context)
- `/workspaces/test-mvp/nextjs-app/app/api/webhooks/unified/` (Unified.to webhook ingestion)
- `/workspaces/test-mvp/nextjs-app/app/api/fathom/callback/route.ts` (canonical Unified.to OAuth callback path)
- Grep: `grep -ril "unified" nextjs-app/ python-services/` — map every consumer
- Grep: `grep -ril "fathom" nextjs-app/ python-services/` — Fathom is our flagship Unified.to integration; map its full path
- `/workspaces/test-mvp/docs/specs/` — any specs that touched Unified.to
- `/workspaces/test-mvp/nextjs-app/lib/env.ts` — Unified env vars (API key, signing secret)

## Mandate

Define what "Unified 2" means in our actual code (the user said it that way; figure out whether it's Unified.to v2 API, an internal v2 abstraction, or just shorthand for "Unified.to"). Document the shape of an existing Unified.to integration (Fathom is the deepest one) end-to-end: OAuth → token storage → sync trigger → data ingestion → indexing. Then describe what adding **Slack via Unified.to** would look like — connector availability, scope, data shape, message ingestion, webhooks.

## Scope

**In:** what Unified.to gives us (auth, token mgmt, normalized API, webhook delivery), what abstractions our codebase wraps around it, what's already-paved-road for Slack, what's NOT covered by Unified.to that we'd still have to build.

**Out:** non-Unified-path Slack work (that's angle B). Pure customer UX (angle C). Don't speculate about "what would be nice" — describe what the codebase actually does.

## Working rules

- Spawn freely (Read, Grep, Bash) within your charter. You do NOT have the Agent tool.
- Capture friction as zettels via `dx zettel add --as=usegin` if anything you encounter is genuinely surprising or worth preserving (z009 friction loop). Don't push through silently.
- Do NOT commit. The orchestrator commits after you return.
- Do NOT write outside `/workspaces/test-mvp/usegin/research/slack-integration/unified-platform/`.
- If Write is denied for the deliverable, fall back to Bash heredoc + `tee` (z030 precedent).

## Deliverable

Write `/workspaces/test-mvp/usegin/research/slack-integration/unified-platform/whiteboard.md` with this shape:

```
## Top — the click
<The single most-load-bearing finding. What does "Unified 2" mean in
our code? Is Slack-via-Unified a paved road, a dirt path, or a no-go?
Time-to-MVP estimate. Lock-in cost.>

## Middle — the body
<End-to-end map of how Fathom (or another flagship) flows through Unified.to.
Code citations: file:line. Auth flow. Webhook flow. Data shape. Wrappers.
Slack-on-Unified.to specifically: which Slack APIs Unified.to covers, scope.>

## Bottom — the open ends
<Dilemmas in z026 shape. Gaps you couldn't read. Friction zettels you captured.
What you'd want to know that you can't tell from the code alone.>
```

Return a ≤10-line summary in chat: top finding + path to whiteboard.
