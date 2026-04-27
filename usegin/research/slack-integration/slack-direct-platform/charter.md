# Charter — angle B: slack-direct-platform

You are a professor of **the direct Slack developer platform — what we'd be using if we bypass Unified.to**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/slack-integration/RESUME.md`
- `/workspaces/test-mvp/PRODUCT.md`
- Slack official docs (use WebFetch on api.slack.com if needed): Bolt SDK, Web API, Events API, Socket Mode, OAuth 2.0, signing secrets, rate limits (Tier 1–4), conversation history retention, message threading model, channel types (public/private/DM/group-DM/multi-party-IM), shared channels, Slack Connect.
- `/workspaces/test-mvp/nextjs-app/lib/env.ts` — to see env-var conventions for an integration's secrets.
- One existing direct integration in our code (no Unified.to): SharePoint via Graph API is the closest analog. Grep `sharepoint` to map its OAuth + sync shape.

## Mandate

Build a deep, citation-grounded picture of what a from-scratch Slack integration looks like — what APIs we'd use, what scopes we'd request, what flows we'd implement (OAuth install, event subscription, message backfill via `conversations.history`), the rate-limit envelope, and the operational obligations (signing-secret verification on every request, scope re-consent on bot-perm changes, app distribution review for the customer-facing version).

## Scope

**In:** Slack APIs we'd use (and which one — Bolt for JS? Bolt for Python? Raw HTTP?), OAuth flow specifics, scopes inventory (channels:read, channels:history, chat:write, etc.), Events API vs Socket Mode tradeoffs (HTTPS endpoint vs WebSocket), rate-limit tiers and how they bite, message-history retention (free vs Pro vs Business+ tier — affects backfill), threading and reactions, shared channels (Slack Connect) implications, multi-workspace install model.

**Out:** anything Unified.to would handle (that's angle A). UX of the customer integration (angle C). Risks that aren't platform-intrinsic (angle G).

## Working rules

- WebFetch on Slack API docs is encouraged — Slack is well-documented, lean on official sources.
- Capture friction as zettels via `dx zettel add --as=usegin`.
- Do NOT commit. Do NOT write outside your folder.
- Bolt SDK: pick ONE language to focus on (we're TS-heavy in nextjs-app, Python-heavy in agent_api/python-services). Make the call and justify in the whiteboard.

## Deliverable

`/workspaces/test-mvp/usegin/research/slack-integration/slack-direct-platform/whiteboard.md`:

```
## Top — the click
<What's the smallest viable Slack-direct stack? Bolt-TS in nextjs or Bolt-Python in
python-services? Best-shape OAuth flow. Time-to-MVP.>

## Middle — the body
<API-by-API map. OAuth. Scopes inventory (with rationale per scope). Events API
vs Socket Mode decision (with reasoning for our infra). Rate-limit envelope.
Backfill via conversations.history. Threading. Multi-workspace install.>

## Bottom — the open ends
<Dilemmas in z026 shape. Gaps. Friction zettels.>
```

Return a ≤10-line chat summary.
