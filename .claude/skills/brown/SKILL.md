---
name: brown
description: Working-with-Brown protocol — Lihu is a pure message-passer between Gin and an external human (Brown) who is at a keyboard with credentials, browser sessions, dashboards, or physical access Gin doesn't have. Lihu does not interpret, edit, summarize, or act; he only forwards. Gin must therefore write each turn so it lands cleanly on the *other side* — never ambiguous about who acts next, never expecting Lihu to fill gaps, never burying the ask. Triggered by "/brown", "we're working with Brown", "use the brown protocol", "Lihu is just relaying", "pass this to <person>", or by your own judgment when Lihu signals he's a relay rather than the actor.
---

# brown — pure message-passer protocol

**Lihu is a router, not an actor.** When this skill is engaged, every turn from Gin is either:

1. **For Lihu** — something only Lihu can do (sign in, paste a credential, click a button on his own machine, decide).
2. **For Brown** — something the other human must do; Lihu will copy/paste it across.

Never both. Never ambiguous. The human in the loop is bandwidth-limited and won't reconcile a mixed message — he'll forward whatever Gin wrote verbatim, and a muddled ask becomes a muddled answer.

## The contract

**Each turn opens with the addressee.** First line of every Gin reply names the recipient — `**For Brown:**` or `**For you (Lihu):**`. No mixed turns; if both are needed, send two separate messages or stage them sequentially.

**Self-contained per message.** Brown does not have Gin's context, the codebase, the chat history, or the prior turn. Every Brown-bound message must:
- State what to do in numbered, atomic steps.
- Name every external identifier explicitly (app name, workspace, channel, URL, token shape).
- Say what to send back, in what shape (paste the token, paste the screenshot, reply "done").
- Avoid pronouns that resolve only in Gin's context ("the app", "the channel" — say *which* app, *which* channel).

**No interpretation budget for Lihu.** Don't ask Lihu to "tell Brown to figure out X" or "ask Brown if Y." If Gin needs information from Brown, write the literal question Brown will read.

**Credential handling stays out of chat.** When Brown produces a secret (token, password, key), the message back to Brown tells him to put it directly into the destination (Doppler, env file, password manager) — not paste it into chat for Lihu to relay. Lihu confirms "in Doppler" or "set" without echoing the value.

**Acknowledge before next ask.** When Lihu relays "Brown did step N", Gin confirms receipt and either advances to step N+1 (Brown-bound) or switches to a Lihu-bound action. Don't pile new Brown asks on top of unconfirmed ones.

## Message shape

For Brown-bound:

```
**For Brown:**

Context (1 line — only what's needed to act).

1. <atomic step with full identifiers>
2. <atomic step>
3. Reply to Lihu with: <exact thing to send back>
```

For Lihu-bound:

```
**For you (Lihu):**

<the action only Lihu can take, in one or two sentences>
```

## When to invoke

| Signal | Why |
|---|---|
| Lihu says "I'm just passing messages" / "I'm the relay" / "/brown" | Direct trigger |
| The actionable steps live on someone else's machine (their Slack admin, their Google Workspace admin, their laptop) | Brown is the only one who can act |
| Lihu has been quoting another human's replies verbatim | He's already in relay mode, formalize it |
| A workflow needs OAuth/install/admin-console steps that require a different identity | Brown owns the identity |

## When NOT to invoke

- Lihu is doing the work himself (default mode).
- The "other person" is an agent, not a human (use Agent/SendMessage).
- The work is in-codebase or in-Gin's-tools (no human relay needed).

## Anti-patterns

- ❌ "Tell Brown to install the app and grab the token." → Lihu has to translate. Write the steps Brown will read.
- ❌ "Once Brown is done, also ask him about X." → Mixed asks; X gets dropped.
- ❌ "Paste the token here so I can put it in Doppler." → Credential in transcript. Tell Brown to put it in Doppler directly.
- ❌ Vague pronouns: "the app", "the channel", "that page". → Brown doesn't have the referent.
- ❌ Long preamble before the ask. → Brown skims; bury the lede and it gets missed.

## Exit

The skill ends when Lihu says the relay is over, or when the workflow Brown was helping with is done. Until then, Gin holds the discipline every turn.
