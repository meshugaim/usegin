# Charter — angle H: auth-identity-cardinality

You are a professor of **how Slack workspaces map to AskEffi workspaces, and how user identity flows through the integration**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/slack-integration/RESUME.md`
- `/workspaces/test-mvp/PRODUCT.md` (workspace = top-level tenant; org→workspace migration)
- Memory: `project_org_to_workspace_migration` — org tier is being removed; design new features against workspace-owner, not org-owner. **This is critical for this charter.**
- Memory: `project_fathom_per_recorder_scoping` — per-recorder gotcha; one OAuth = one user's scope. Slack analog?
- Existing auth posture: `reference_supabase_auth_signing`, `feedback_dont_infer_signing_from_apikeys`
- Slack OAuth docs (WebFetch): user tokens vs bot tokens; OAuth v2 install flow; multi-workspace install behavior; org-level apps (Slack Enterprise Grid)

## Mandate

Map the identity model end-to-end:

1. **Slack-side mapping**: What does one Slack OAuth install give us? A bot token scoped to one workspace. What about Enterprise Grid (multi-workspace org)? What about cross-workspace shared channels (Slack Connect)?
2. **AskEffi-side mapping**: One AskEffi workspace owns the integration. Per `project_org_to_workspace_migration`, NOT one AskEffi org. What's the cardinality?
   - 1 AskEffi workspace ↔ 1 Slack workspace? (simple)
   - 1 AskEffi workspace ↔ N Slack workspaces? (some teams have prod + dev Slacks)
   - N AskEffi workspaces ↔ 1 Slack workspace? (one Slack feeding two Effi tenants — implausible but verify)
3. **Per-user-OAuth vs bot-token**: For the customer-facing integration, do we need per-user OAuth (so Effi can post-as-the-user), or is the bot token enough? What's the tradeoff?
4. **Per-recorder analog**: The Fathom gotcha was that one OAuth = one user's scope, not the whole team. Does the Slack bot-token model avoid this, or reproduce it? Verify against Slack's actual OAuth docs.
5. **UseGin-Slack identity** (intersection with angle D): if Gin acts on behalf of the team, does Gin install as a separate Slack app on the team workspace? Or is Gin just another bot user? What's the identity model that lets Gin post both into the team's Slack AND into the customer's bound channel without conflating?

## Scope

**In:** OAuth flow specifics, token types, workspace-cardinality decisions, per-user-vs-bot decision, multi-workspace install model, the Fathom analog check.

**Out:** rate limits (G). Channel-binding UX (C). Slack platform features beyond auth (B).

## Working rules

- The org→workspace migration memory is non-negotiable: design against workspace, not org.
- Capture friction as zettels via `dx zettel add --as=usegin`.
- Do NOT commit. Do NOT write outside your folder.

## Deliverable

`/workspaces/test-mvp/usegin/research/slack-integration/auth-identity-cardinality/whiteboard.md`:

```
## Top — the click
<The cardinality call (Slack-WS ↔ AskEffi-WS) plus the bot-vs-user-token call,
in one paragraph. The Fathom-analog verdict: does Slack reproduce the gotcha?>

## Middle — the body
<End-to-end identity map. OAuth flow with token types named. Multi-workspace
edge cases. Cross-workspace shared channels (Slack Connect). Enterprise Grid.
UseGin-Slack identity (if it lives separately or alongside).>

## Bottom — the open ends
<Dilemmas in z026 shape. The cardinality call may itself be a dilemma.>
```

Return a ≤10-line chat summary.
