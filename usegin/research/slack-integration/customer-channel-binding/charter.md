# Charter — angle C: customer-channel-binding

You are a professor of **the customer-facing surface where one Slack channel binds to one AskEffi project — what that means in UX, data model, and lifecycle**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/slack-integration/RESUME.md`
- `/workspaces/test-mvp/PRODUCT.md` (data items, projects, internal/external access tier, RLS)
- Existing project-integrations UX as reference shape:
  - Drive integration: `nextjs-app/app/(app)/projects/[id]/integrations/drive/` (or wherever it lives — grep `drive` under `app/`)
  - SharePoint integration page
  - Fathom integration page
- Project schema: `grep -ril "data_items\|projects" supabase/migrations/ | head`
- Email-integration spec: `docs/email-integration-mailbox-connection.spec.md`
- `/workspaces/test-mvp/CLAUDE.md` for testing/migration conventions
- Relevant memory: `feedback_email_splitter_no_llm` (regex-only for emails — does it apply to Slack?), `project_org_to_workspace_migration` (workspace, not org, owns integrations), `project_fathom_per_recorder_scoping` (per-recorder gotcha analog?)

## Mandate

Design the customer-product surface for binding a Slack channel to a project. Cover: install/connect UX (admin clicks "Connect Slack" — then what?), channel-picker UX (which channel binds to which project), data ingestion (do channel messages become data items? threaded as one item or per-message? attachments? files?), historical backfill, RLS / who-can-see-what (internal vs external tier), lifecycle handling (channel renamed → bound projects refresh? channel archived → integration goes inactive? channel deleted → graceful degradation?), and bidirectional questions (does Effi post replies into the channel? or read-only?).

## Scope

**In:** UX flow, data model (DB shape — how the binding is stored, how messages become data items), RLS implications, lifecycle edge cases, bidirectional vs read-only choice.

**Out:** Slack platform mechanics (angle B) and Unified.to mechanics (angle A). Auth/identity is angle H. Risks specific to Slack are angle G.

## Working rules

- Reuse existing integration patterns (Drive, SharePoint, Fathom) as the shape — call out where Slack diverges.
- Capture friction as zettels via `dx zettel add --as=usegin`.
- Do NOT commit. Do NOT write outside your folder.

## Deliverable

`/workspaces/test-mvp/usegin/research/slack-integration/customer-channel-binding/whiteboard.md`:

```
## Top — the click
<The single hardest design decision in this surface and the Lean. E.g.:
"Read-only first; bidirectional later. Per-message data item, not
per-channel-rollup. RLS: external tier gets nothing from Slack until
labels exist." — or whatever the actual click is.>

## Middle — the body
<UX flow. DB schema sketch (binding table + how messages become data items).
Backfill strategy. Lifecycle table (rename/archive/delete/permission-revoke).
RLS / access tier mapping. Diff vs Drive/SharePoint/Fathom shape.>

## Bottom — the open ends
<Dilemmas in z026 shape — at least 2. Gaps. Friction zettels.>
```

Return a ≤10-line chat summary.
