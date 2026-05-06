---
name: use-gin
description: Gin's own toolkit handbook — the FIRST place to check when asking "can I/Gin do X?" about session resume, cross-env continuity, history queries, or any capability that lives in our `tools/` and `.claude/` layer rather than upstream Claude Code. Triggered by "can we resume", "can Gin", "from another env", "across machines", "is there a tool for".
---

# Use Gin

> **Speaker convention:** "Lihu" in this file is the *primary* speaker; the
> actual live user may be Oria, Lihu, or Nitsan. Check the LIVE USER banner /
> userEmail / in-chat signals before binding to a name (root `CLAUDE.md`
> "Live user — who's in the chat" precedence rule).

Gin's repo-local capabilities — what *this* agent can do here that upstream Claude Code can't on its own.

## Principle: First-place capture

> When we miss something, put it in the first place we looked.

If you (Gin) catch yourself answering "no, can't be done" and the answer turns out to be "yes, via our tooling", the fix is not a memory note buried in the index — it is an entry **right here**, in the file you would have opened first. Add it the same turn you discover the gap.

This file is that first place. Keep it terse. One bullet per capability, link out for depth.

## Capabilities

### Resume a session from a different environment

**Yes.** Sessions are auto-synced to GitHub via the conversation-watcher into `~/agent-records/`, and the `session` CLI fetches them on demand.

```bash
session list --all-projects --remote --since 1d   # find the id
session resume <id>                                # fetch from agent-records + claude --resume
```

Works from any env (devcontainer, laptop, fresh checkout) where `~/agent-records` is synced. `session fork <id>` makes a copy and resumes that instead — like `git branch` for sessions.

See `tools/session/CLAUDE.md` and `session --help`.

### Find why a line of code exists

`session code-history <file>:<line>` — surfaces the authoring commit plus the Claude session's intent/trigger/outcome and any linked Linear issue. `git blame` says who; this says why.

### Pull a meeting transcript directly (when `effi ask` loops)

When you already know the meeting entity id (often surfaced by Effi's own first search), skip `effi ask` and go direct:

```bash
effi --profile <you>:prod meetings show <meetingId> --transcript > /tmp/meeting.json
jq -r '.meeting.transcript' /tmp/meeting.json > /tmp/transcript.txt
grep -nE 'מחר|priorit|tomorrow|<keyword>' /tmp/transcript.txt
```

Why this beats `ask`: Hebrew-heavy transcripts make semantic search miss paraphrased English queries; intermediate result files exceed Effi's per-tool token budget and get saved to local paths Effi can't read back. The CLI direct path returns the whole transcript as one JSON blob, then `jq | grep` does the real search. Use when Effi loops 5+ times on the same query.

### Browse / search past sessions

- `session find` — interactive fzf browse
- `session search-in <id> <query>` — search within a session's turns
- `session bash [id] --grep <p>` — browse Bash commands across sessions

### Rate session vibe mid-session

`dx his rate --as=claude` / `dx his note --as=claude` — file telemetry without waiting for `/end`. See `.claude/skills/his-self-rating/SKILL.md`.

### Read / write the team Slack via Gin

**Yes.** UseGin-Slack is the team's Gin-mediated Slack surface. Same shape as `plan` (Linear-via-Gin): one shared bot token in `USEGIN_SLACK_BOT_TOKEN`, attribution in the message via `*[via <human>]*` prefix, NOT per-user OAuth. ENG-ids in outbound messages auto-link to Linear.

```bash
dx slack whoami                          # bot identity, workspace, scopes
dx slack post "<msg>"                    # post to #usegin outbox (ENG-IDs auto-linked)
dx slack send <#channel> "<msg>"         # post to a specific channel
dx slack send <#ch> --thread <ts> "msg"  # thread reply
dx slack read <#channel> [--since 1d]    # recent messages
dx slack inbox [--unread] [--since 1d]   # @usegin mentions queue (poll-on-invoke)
```

All commands honor the dx output convention (human → stderr, JSON → stdout, `--json` flag, `DX_OUTPUT=json` env). Token is masked in every error path.

Outbox channel is `#usegin` by default; override with `USEGIN_OUTBOX_CHANNEL`. Linear org URL for ENG-ID auto-link is `https://linear.app/askeffi` by default; override with `LINEAR_ORG_URL`.

Cross-surface ENG-id awareness is symmetric:
- **Send-side** (D4): outbound messages auto-link `ENG-\d+` tokens to Slack mrkdwn pointing at the Linear issue.
- **Read-side** (D5): `dx slack read` and `dx slack inbox` annotate each message's header line with `(refs: ENG-X, ENG-Y)` when the body references Linear issues — even if the references arrived already-wrapped in Slack mrkdwn.

See `tools/dx/src/slack/README.md` for setup recipe and `usegin/research/slack-integration/DEMO.md` for the end-to-end demo (UseGin + customer-facing AskEffi-Slack on the same page).

### Commit safely under multi-Gin pressure

When two or more Gins share `/workspaces/test-mvp/`, the shared `.git/index` lets a sibling's `git add` slip into your commit between message-formation and `git commit` — the Mode-1 attribution swap (z081 / z096 / z097, tikur 2026-04-28). Until per-session worktrees ship (CLOSE.md § D5.1), use the snapshot tripwire:

```bash
# 1. Stage your files; draft your commit message based on:
git diff --cached --name-only

# 2. Snapshot the staged set (records `.git/last-staging-snapshot`):
bash scripts/hooks/snapshot-staged.sh

# 3. Commit — `.husky/pre-commit` now runs `check-staging-drift.sh`,
#    which aborts loudly if a sibling staged anything between (1) and (3).
git commit -m "..."
```

The hook is a no-op if no snapshot was recorded (interactive humans, recovery flows). For autonomous runs, treat the snapshot step as mandatory before every commit. See `.claude/tikur-records/2026-04-28-multi-gin-checkout-collisions.md` for the full mechanism and the structural fix that supersedes this.

### External-system configuration — probe before trust

When a human collaborator says **"I added the X scope" / "I registered the Y URL" / "I set the Z field"** on an external system you cannot read directly (Slack admin console, Stripe dashboard, OAuth provider settings, Linear webhook config, DNS records, Cloudflare ingress), **trust is not enough — you must probe the live state before claiming the configuration is correct in any downstream artifact** (a map, a status report, a dispatched prompt, a charter).

This is a 2-touch cluster as of 2026-04-28 — see `.claude/tikur-records/2026-04-28-slack-redirect-uri-not-registered-cluster-touch-2.md` and `feedback_preflight_external_identifiers_in_dispatched_prompts` (which the prior 2026-04-27 tikur produced and which did NOT prevent the recurrence because it lived in deep memory). The lekach belongs here, in the front-door handbook.

**Probe shapes by category:**

| External config | Probe |
|---|---|
| Slack OAuth redirect URIs | Run the OAuth init (e.g. `connectSlackAction` via playwright). Slack will reject with `redirect_uri did not match any configured URIs. Passed URI: <yours>` if your URL isn't on the list — exposing both *that* it's missing and *what string* the app saw. |
| Slack bot scopes | Same OAuth init. Slack rejects with `invalid_scope: <scope>` if any requested scope isn't on the app. |
| Slack Events Subscription URL | When Lihu saves the URL Slack-side, Slack POSTs `{type: "url_verification", challenge: "..."}` to it. Tail the dev-server log for that request; absence of a 200 response = URL never registered or signing-secret mismatch. |
| Linear API token | `plan list --limit 1` — non-zero exit + auth error = bad token. |
| Cloudflare tunnel ingress | `just tunnel status` shows CONNECTED + `curl https://local-dev.askeffi.ai/api/health` returns the live status JSON. |
| Doppler secret | `doppler --project <p> --config <c> secrets get <NAME> --plain` — empty output = not set. |
| Supabase RLS policies | `EXPLAIN` the query as the target role; missing policy = no rows. |
| OAuth client_id at any provider | Running the auth flow always reveals it via the redirect chain or error message; never trust "I set it" on the value. |

**Anti-pattern:** "I asked Lihu, he said yes." That counts as evidence-of-intent, not evidence-of-state. Yesterday's tikur was triggered by exactly this pattern; today's tikur was triggered by exactly this pattern after yesterday's lekach landed only in memory. **The minute someone says "I did" on external config, the next action is the probe — not a status update.**

When the probe surfaces a mismatch, the diagnostic question for the human is "read me the exact string from the admin console" — never "did you really add it?" (which yields the same verbal-yes the original assertion did).
