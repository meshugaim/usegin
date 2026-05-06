---
name: team-gmail
description: Use this when an agent needs to read team Gmail or draft an email as the live human via the claude.ai Gmail connector — find a thread, draft a reply, search by sender/date, manage labels. Triggered by "what did Guy email about X", "draft a reply to Y", "find the thread where we discussed Z". NOT for: AskEffi's *product* email source (Effi indexes Gmail as a project data source — read by the product, not the agent), `nextjs-app/api/webhooks/mailgun/*` (product inbound-email handling), Mailgun outbound transactional sends (the product's `noreply@mail.askeffi.ai`), bulk synthesis across email/Drive (use `dogfooding-effi`).
---

# Team Gmail via claude.ai connector

Read team email and draft replies as the live human via the claude.ai connector. The agent acts under your real identity (e.g. `nitsan@askeffi.ai`).

For the full lifecycle, see `docs/claude-ai-connectors.md`.

## The contract: drafts only, no send

Anthropic's deliberate boundary: agent can **create drafts but cannot send**. Drafts land in your Gmail Drafts folder; the human presses send. Different from Slack (where sends go live).

The connector is **create-new-resource only**, not modify-existing — agent can `create_label` (define a label) but cannot `label_thread` (apply it to an existing thread; insufficient scopes). Same philosophy as the no-send boundary.

The `[auto-send]` Apps Script pipeline (see `docs/claude-ai-connectors.md`) dissolves the no-send boundary by your own choice — a Google-side time trigger sends drafts whose first body line is `[auto-send]`.

## Activation check

If only `*_authenticate` tools are visible, prompt the human to run `/mcp` and select "claude.ai Gmail".

## Read

```bash
# Gmail search syntax — same operators as the Gmail web UI
mcp__claude_ai_Gmail__search_threads query='from:guy@askeffi.ai newer_than:14d'
mcp__claude_ai_Gmail__search_threads query='subject:"Weekly Status update" newer_than:60d'

# Read a thread in full (all messages, full bodies)
mcp__claude_ai_Gmail__get_thread threadId='19df1982550d352a' messageFormat='FULL_CONTENT'
```

## Draft

```bash
# Plain draft to one or more recipients
mcp__claude_ai_Gmail__create_draft \
  to=['nitsan@askeffi.ai'] \
  subject='...' \
  body='...'

# Reply that attaches to an existing thread
mcp__claude_ai_Gmail__create_draft \
  to=['recipient@external.com'] \
  subject='Re: ...' \
  body='...' \
  replyToMessageId='<existing message id>'
```

Recipient format is bare `email@domain` only — `Name <email>` is rejected by the schema. Easy gotcha.

## The `Cc effi@askeffi.ai` pattern (close the loop)

When an agent drafts an outbound email about team work — a status update, a customer follow-up, an internal decision — Cc `effi@askeffi.ai`. That mailbox is a team Cc Effi indexes; it makes the email visible in the dogfooding project so future Effi queries can cite it.

```bash
mcp__claude_ai_Gmail__create_draft \
  to=['external-contact@example.com'] \
  cc=['effi@askeffi.ai'] \
  subject='...' body='...'
```

The four core humans Cc it routinely. The product's transactional sender is `noreply@mail.askeffi.ai` — different role, not for agent draft Cc.

## Auto-send pipeline (optional, per-team-member)

The auto-send Apps Script lives in *each teammate's* own Google account — there's no shared setup. Each person who wants their drafts to actually send has to wire their own Apps Script once (~3 min, see `docs/claude-ai-connectors.md` § Apps Script auto-send).

**Before suggesting auto-send to the live human, assume they may not have set it up.** If they haven't, the marker is harmless (draft sits in Drafts as normal) but the agent's "I'll send this for you" promise silently doesn't deliver. Easiest probe: ask the human "is your Apps Script auto-send set up?" once, remember the answer for the session.

When set up, agent can mark a draft for automated sending:

1. **First body line**: `[auto-send]` — script strips before send
2. **Last body line**: `Sent from <Name>'s Claude Code` — convention, kept as honest disclosure

```
body =
  "[auto-send]\n\n" +
  "<your message>\n\n" +
  "Sent from Nitsan's Claude Code"
```

Apps Script picks it up within ~1 min, strips line 1, sends, leaves the disclosure footer.

**Only use when the human explicitly asks for auto-send** — otherwise the draft sits in Drafts as the safer default.

## Cross-references

- `team-people` — internal recipient lookup
- `team-customers` — external recipient lookup
- `docs/claude-ai-connectors.md` — full Apps Script auto-send setup
- `dogfooding-effi` — synthesis layer that *includes* email; this skill is the direct-access surface

## Not to be confused with

- **AskEffi's *product* Gmail source** — Effi indexes Gmail as a project data source for the product, separate from the agent-direct surface here
- **`nextjs-app/api/webhooks/mailgun/*`** — product inbound-email handling, completely different layer
- **Mailgun outbound** (`noreply@mail.askeffi.ai`) — used by the product for transactional email; agent doesn't touch it
- **`dogfooding-effi`** — synthesis across email + Drive; this skill is direct-access only
