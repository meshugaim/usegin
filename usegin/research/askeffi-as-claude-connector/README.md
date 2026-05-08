---
date: 2026-05-08
trigger: nitsan asked "what would it take for AskEffi to be a Claude connector"
status: in-flight
---

# R&D — AskEffi as a Claude connector

Five-Poll round on what it would take for AskEffi to expose a remote MCP server
and be addable in claude.ai as a connector (like Slack/GitHub/Linear today).

## Angles

- `A-anthropic-spec/` — what Anthropic's connector / remote-MCP layer requires (DCR, OAuth 2.1, MCP version, transport, capability negotiation, what claude.ai accepts today)
- `B-askeffi-oauth-idp/` — turning AskEffi into an OAuth 2.1 authorization server on top of Supabase auth (token issuance, refresh, revocation, consent)
- `C-mcp-tool-surface/` — which AskEffi capabilities map to MCP tools/resources/prompts and how they read in chat
- `D-security-multitenancy/` — scopes, RLS interaction, audit, rate limits, abuse, token storage on Anthropic's side
- `E-distribution-ux/` — directory listing vs custom-URL add, branding, review process, what existing connectors reveal as the bar

## Synthesis

Lands at `SYNTHESIS.md` once all five whiteboards are committed.
