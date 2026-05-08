---
date: 2026-05-08
charter_for: general-purpose sub-agent
caller: Zisser
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
output_path: zisser/dispatched/2026-05-08-slack-state-out.md
read: code/configs/live Slack apps/env — NOT zisser/plans or substrate
mode: read-only against external systems and code, no commits, no edits outside output file
---

# Charter — State-Slack — what Slack-into-Effi actually IS, right now

## Purpose

Ground truth. What Slack apps actually exist, what's in their config
on api.slack.com, what's in our code that handles Slack OAuth + events
+ ingestion, what's in Doppler/Railway/local-env for Slack secrets,
what redirect URLs are registered, what tickets are open. Latent intent
and historical plans are out of scope — sibling charter handles that.

## End state

A single markdown file at `zisser/dispatched/2026-05-08-slack-state-out.md`
containing:

1. **Slack apps inventory** — every Slack app the team has registered
   (api.slack.com), with: app id, name, workspace, who can admin it,
   redirect URLs configured, OAuth scopes, event subscriptions, install
   status. Use the Slack API or `dx slack`/`effi slack` CLI tooling
   if available; do NOT register anything new. If a credential is
   missing, list the app by name + what is unknown.
2. **Slack workspaces** — askeffi.slack.com etc., team ids, what bots
   live there.
3. **Code that handles Slack** — every file under `nextjs-app/`,
   `python-services/`, `tools/dx/src/slack/` that consumes Slack
   tokens or handles events. Path:line + role.
4. **OAuth flow trace** — given a customer clicks "Connect Slack" in
   Effi, follow the actual code path from button → authorize → callback
   → token storage. Note exact env vars read at each step.
5. **Event ingestion** — does the code actually receive `message.*`
   events and write them anywhere? Trace it. If gated/parked, say so
   with file:line.
6. **Slack secrets in Doppler** (use the doppler CLI read-only;
   `doppler secrets --only-names`) — every key matching `SLACK_*` or
   `USEGIN_SLACK_*`, in which project/config it lives.
7. **Railway / staging / production** — which Slack secrets are present
   in deployed environments, which are missing.
8. **Linear tickets** — open Slack-related tickets via `plan list | grep
   -i slack` and `plan search slack`; status, who's assigned (note:
   per memory `feedback_linear_assignee_not_ownership`, assignee≠owner;
   just record what's there).
9. **Real-world humans-in-the-loop** — items in `_NEEDS-FROM-LIHU.md`
   that block Slack progress. Just enumerate.
10. **Two-line summary** — "Slack today is X; the customer flow is Y%
    landed."

## Tools you may use

- `doppler` CLI read-only.
- `dx slack` / `effi` CLI for read-only probes (`dx slack whoami`,
  `dx slack read`, etc.). Do NOT post or write.
- Slack API direct via `curl https://slack.com/api/...` for reads
  (`auth.test`, `apps.list`, `apps.permissions.info`) — only if a
  bot/user token is in env. Do NOT call any write methods.
- Ripgrep.
- `plan` (Linear).
- `gh` for tracking workflows.
- `railway` CLI read-only.

## What you must NOT do

- Do NOT read `zisser/plans/`, `zisser/dispatched/`, `zisser/inbox/`,
  `zisser/notes/`, agent sessions, zettels, personas, principles.
  You're the reality team; substrate contaminates.
- Do NOT register Slack apps, change redirect URLs, install bots, or
  modify any external config.
- Do NOT commit. Do NOT edit any file outside your output path.
- Do NOT propose fixes.

## Investigative posture

- All time. Thoroughness over speed.
- Distinguish three Slack contexts cleanly:
  - **Customer-facing app** (the one Effi customers OAuth against)
  - **AskEffi-team-internal bot** (UseGin-Slack / `useginslack`)
  - **Spike/POC apps** (`ingest-poc`, `Effi Spike`, etc.)
- When unsure, query and record. Negative findings ("no events
  subscribed") are as valuable as positive.

## Stop condition

Output file exists with all ten sections filled. Return to caller:
the path + a one-line summary.
