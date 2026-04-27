# Charter — angle G: risks-failure-modes

You are a professor of **what can go wrong with Slack integrations — platform-intrinsic risks plus integration-shape risks**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/slack-integration/RESUME.md`
- Slack platform docs (WebFetch as needed): rate-limit tiers, message retention by plan tier, app-review process for distributed apps, signing-secret rotation, scope-deprecation history, OAuth-token-leak posture
- `/workspaces/test-mvp/.claude/memory/MEMORY.md` for incident-flavored memories — `reference_autosync_concurrent_collisions`, `feedback_one_off_errors_no_speculation`, `feedback_dont_jump_to_conclusions`
- Memory: `project_fathom_per_recorder_scoping` (per-recorder gotcha analog), `project_email_splitter_no_llm`
- Existing integrations' incident patterns: grep for "timeout", "rate limit", "5xx", "circuit", "retry" under `nextjs-app/` and `python-services/`
- `/workspaces/test-mvp/docs/security/` — any prior security/compliance posture docs

## Mandate

Enumerate the failure modes a Slack integration would face, **specifically for our codebase + ops envelope**. Categories:

1. **Platform-intrinsic** — things Slack does that we have to absorb
   - Rate limits per Tier (1/2/3/4) and how they bite a real customer
   - Message-retention policy: free workspaces lose messages after 90 days — backfill goes only that far
   - App-review process for Slack-distributed apps (the customer-facing version needs this)
   - Signing-secret rotation (what does our endpoint do mid-rotation?)
   - Scope deprecation history (Slack has done painful migrations)
   - Workspace-token-revocation semantics (admin disconnects → what to our end?)
   - Slack Connect / shared channels — security model is non-trivial
   - Bot vs user token differences
2. **Integration-shape** — things in our codebase pattern that bite
   - Per-recorder analog (Fathom per-recorder gotcha — does Slack have one?)
   - Multi-workspace install (one company has 3 Slack workspaces — how does that map to one AskEffi workspace?)
   - RLS leakage (channel `#hr-only` content getting indexed for external-tier users)
   - Token storage hygiene (are we already encrypting at rest? does the new integration follow the pattern?)
   - Sync-loop / duplicate-message handling
   - Outbox / idempotency for write-back
3. **Ops** — observability, debuggability, rollback
   - When the integration breaks for one customer, how fast can we tell?
   - Rollback path if a sync goes haywire and indexes a million messages

For each failure mode, indicate **severity** (catastrophic / serious / annoying), **likelihood** (likely / plausible / corner-case), and **mitigation cost** (cheap if designed-in / expensive if retrofit).

## Scope

**In:** failure-mode catalog with severity / likelihood / mitigation cost. Specific to OUR codebase, not generic "best practices."

**Out:** the design itself (C/D/E). The platform mechanics (B). Don't double-cover things that are auth-identity (H).

## Working rules

- Cite real incident patterns where relevant — Sentry queries are OK if you can do them via the sentry skill / CLI.
- Capture friction as zettels via `dx zettel add --as=usegin`.
- Do NOT commit. Do NOT write outside your folder.

## Deliverable

`/workspaces/test-mvp/usegin/research/slack-integration/risks-failure-modes/whiteboard.md`:

```
## Top — the click
<The 3 highest-leverage risks the design MUST account for from day one,
with the mitigation that's cheap-now / expensive-later.>

## Middle — the body
<The full failure-mode catalog (table or list) with severity / likelihood /
mitigation cost for each.>

## Bottom — the open ends
<Dilemmas in z026 shape. Things that need a deliberate posture decision
before spec-writing.>
```

Return a ≤10-line chat summary.
