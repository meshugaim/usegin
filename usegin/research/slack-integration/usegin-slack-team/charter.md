# Charter — angle D: usegin-slack-team

You are a professor of **the UseGin-Slack integration — Slack as the team's task/discussion surface, mediated by Gin (we don't click Slack UI ourselves; Gin reads Slack and writes Slack on our behalf, the same way Gin reads/writes Linear today)**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/slack-integration/RESUME.md`
- `/workspaces/test-mvp/usegin/Gin.md` if it exists, plus `usegin/` top-level files explaining what UseGin is
- `/workspaces/test-mvp/.claude/skills/use-gin/SKILL.md` (canonical UseGin handbook)
- How Gin reads/writes Linear today: `tools/dx/`, plus the `plan` CLI (run `plan --help` and `plan docs`)
- How Gin reads/writes Effi today: `.claude/skills/dogfooding-effi/`
- Memory: `project_usegin_naming.md`, `project_dx_app_session_vibe.md` — UseGin is the rename of Gin/Gin-Lab; tools/dx/ is the executable side
- The user's framing in the round prompt (RESUME.md): "We will read from and write to Slack using Ginn" — Slack is a Gin-mediated R/W surface

## Mandate

Design what UseGin-Slack actually is. The hard questions:

1. **What's the actor?** Is "UseGin" a single Slack bot user that posts on behalf of the team? Or does Gin post-as-each-team-member via per-user OAuth? Or does Gin post-as-itself with attribution in the message?
2. **How does Gin discover what to read?** Slash commands (`/gin <prompt>`)? Mentions (`@gin ...`)? A dedicated channel Gin subscribes to (`#gin`)? All of the above?
3. **How does Gin write?** Bot posts in any channel it's invited to? Or only in the dedicated channel?
4. **What's the parity with our Linear-via-Gin pattern?** Today, humans say "Gin, create a Linear issue X" → Gin runs `plan create`. Slack equivalent: "Gin, post in #engineering that staging just deployed" → Gin runs `slack send #engineering ...`. What's the CLI shape (`dx slack ...`?)? What auth?
5. **What happens when the human IS in Slack and Gin is in another env?** Cross-env continuity — does Gin need to subscribe to Slack events, or is it pull-only when invoked?
6. **Linking back to our other surfaces**: when Gin reads a Slack thread that contains a Linear-issue ID, does Gin auto-link? When Gin posts about an issue, does it embed?

## Scope

**In:** the team-internal Gin-mediated Slack surface — actor model, discovery model, CLI/skill shape, parity with Linear-via-Gin and Effi-via-Gin, cross-env continuity.

**Out:** customer-facing channel ↔ project (angle C). The team's separate AskEffi-Slack integration (angle E). Slack platform mechanics (B). Unified.to specifics (A).

## Working rules

- Heavy lean on the existing Gin patterns. The "Linear-shape" framing is your north star — what does it look like for Gin to use Slack the way Gin uses Linear?
- Capture friction as zettels via `dx zettel add --as=usegin`.
- Do NOT commit. Do NOT write outside your folder.

## Deliverable

`/workspaces/test-mvp/usegin/research/slack-integration/usegin-slack-team/whiteboard.md`:

```
## Top — the click
<The actor model + discovery model. E.g.: "UseGin is one bot user;
discovery is mention-based (@gin) plus a dedicated #gin channel for
proactive reads. CLI: `dx slack send/read/watch`. Auth: bot token
shared across team-Gin instances; per-user attribution via message
formatting, not via per-user OAuth.">

## Middle — the body
<Actor model with rationale. Discovery model. CLI surface (commands,
flags). Auth/identity. Cross-env continuity. Parity matrix vs Linear
and vs Effi.>

## Bottom — the open ends
<Dilemmas in z026 shape — at least 2. Friction zettels. Gaps.>
```

Return a ≤10-line chat summary.
