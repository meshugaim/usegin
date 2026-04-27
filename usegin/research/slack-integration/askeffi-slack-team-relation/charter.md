# Charter — angle E: askeffi-slack-team-relation

You are a professor of **the question: is "AskEffi-Slack for the team" a separate build, or just the customer Slack integration (angle C) dogfooded on our own AskEffi tenant?**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/slack-integration/RESUME.md`
- `/workspaces/test-mvp/.claude/skills/dogfooding-effi/` (how the team uses Effi today on the team's tenant)
- The other charter at `usegin/research/slack-integration/customer-channel-binding/charter.md` (angle C — customer surface)
- `usegin/research/slack-integration/usegin-slack-team/charter.md` (angle D — UseGin-Slack)
- How the team uses Effi today: `effi-session-audit` skill, `dogfooding-effi` skill, plus PRODUCT.md (workspaces, projects)
- Memory: `project_dx_app_session_vibe.md`, `project_usegin_naming.md`

## Mandate

The user's framing puts THREE Slack-surfaces side-by-side:
1. Customer-facing (1 channel ↔ 1 project) — angle C
2. UseGin-Slack (Gin reads/writes Slack like Linear) — angle D
3. AskEffi-Slack for the team (like Effi's existing customer integrations, applied to our team)

The question for this charter: is #3 actually distinct from #1, or is it just #1 installed on the team's own AskEffi tenant? If they're the same code path, then "build twice" applies to ONE customer-Slack integration that the team also dogfoods, not to two separate things. If they're different, why and how?

Possible distinctions to examine:
- Different scope (team uses Slack much more broadly than a customer would; one project per channel might be too restrictive for the team)
- Different ingestion shape (the team might want all Slack messages searchable across all team-projects, not bound 1:1)
- Different write-back (team integration might want Effi to *post* in Slack with answers, not just ingest)
- Different auth (team has admin access; customer doesn't)
- Different RLS posture (per memory `project_zettel_no_privacy.md`: full team transparency by design)

## Scope

**In:** the relation between #1 and #3. Whether they collapse into one build or stay as two. What's gained/lost either way.

**Out:** the actual implementation of #1 (angle C). The actual implementation of #3 if it's separate (you'll define the boundary, not the spec). UseGin-Slack (D).

## Working rules

- Be willing to claim "they collapse, this angle disappears" if the evidence supports it. That's a valid finding.
- Capture friction as zettels via `dx zettel add --as=usegin`.
- Do NOT commit. Do NOT write outside your folder.

## Deliverable

`/workspaces/test-mvp/usegin/research/slack-integration/askeffi-slack-team-relation/whiteboard.md`:

```
## Top — the click
<Verdict: collapse into one build, or stay as two? One sentence rationale.>

## Middle — the body
<Side-by-side feature/surface comparison. Where they overlap. Where they
diverge. The actual cost of either choice.>

## Bottom — the open ends
<Dilemmas in z026 shape. At least one — there's almost certainly a
dilemma here that needs Lihu's call.>
```

Return a ≤10-line chat summary.
