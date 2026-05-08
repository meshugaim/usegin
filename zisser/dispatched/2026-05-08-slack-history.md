---
date: 2026-05-08
charter_for: general-purpose sub-agent
caller: Zisser
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
output_path: zisser/dispatched/2026-05-08-slack-history-out.md
read: substrate (plans/dispatched/inbox/notes/zettels/sessions/Linear) — NOT code
mode: read-only, no commits, no edits outside output file
---

# Charter — History-Slack — what we *said* Slack-into-Effi should look like

## Purpose

Distill the team's accumulated **desired-state** for the Slack
integration into Effi. The user-facing flow is roughly: "a customer
connects their Slack workspace to Effi → channels they pick get
ingested → Effi can answer about what was said in those channels." From
every conversation, plan, dispatch, inbox note, zettel, and Claude
session over the past ~2 weeks, produce ONE clean picture: "here's what
we decided Slack-into-Effi should look like." Do **NOT** read application
code. Do **NOT** look at api.slack.com or the live Slack apps. Latent
intent only.

## End state

A single markdown file at `zisser/dispatched/2026-05-08-slack-history-out.md`
containing:

1. **The customer flow** — step by step, from "I want to connect Slack"
   to "Effi answers questions about my Slack content". Diagram or
   numbered list.
2. **The Slack apps we said exist** — what apps were named, what scopes,
   what redirect URLs, what tokens/secrets, who owns them.
3. **The internal Slack-for-team workspace reorg** — distinct from the
   customer flow; the AskEffi team's *own* Slack workspace shape.
4. **Decisions made** — each with one-line "why" + source path(s).
5. **Decisions still open** — each with where it surfaced and why it
   stalled.
6. **Contradictions / drift** — places two notes disagree.
7. **The "click"** — one paragraph: "what is Slack-into-Effi, in plain
   words?"

## Where to read (in order)

1. `zisser/plans/` — especially `2026-04-29-slack-fully-functional.md`,
   `2026-05-04-slack-ux-alignment.md`,
   `2026-05-05-slack-workspace-reorg.md`,
   `2026-05-05-slack-for-effi-app-creation.md`, anything else matching
   `*slack*`.
2. `zisser/dispatched/` — anything matching `*slack*`. Note especially
   `2026-04-29-slack-c4-message-ingestion-wes.md`,
   `2026-05-04-slack-autonomous-ops-*.md`,
   `2026-05-05-slack-arc-close-tikur-and-tests.md`,
   `2026-05-05-slack-slice1-modal-from-project-wes.md`.
3. `zisser/inbox/` — `2026-05-05-oria-slack-dev-channel-probe.md`,
   `2026-05-05-slack-private-channel-invite-automation.md`, anything
   else.
4. `zisser/notes/` — `2026-05-05-integration-naming-convention.md`,
   anything else slack-related.
5. `zisser/handoff/` — anything Slack-related, especially OAuth probes.
6. `zisser/log/` — recent entries mentioning Slack.
7. `usegin/research/slack-integration/` — synthesis docs.
8. `usegin/zettel/zettels/` — grep for slack.
9. `~/.claude/projects/-workspaces-test-mvp/` — JSONL session transcripts;
   `rg -l -i slack` to find sessions; read the ones that show real
   conversational decisions, not just artifacts.
10. Linear via `plan list | grep -i slack` and `plan search slack`.
11. Files in `_NEEDS-FROM-LIHU.md` references are signal — what's stuck
    on humans.
12. The `oria-crazy-world/ground/oria-crazy-space/slack-ingest-poc/`
    parallel-JSONL POC — what it represents and what it doesn't.

## What you must NOT do

- Do NOT open `nextjs-app/`, `python-services/`, `tools/dx/src/slack/`,
  or any code that consumes Slack tokens. Latent-only.
- Do NOT call api.slack.com. Do NOT run `dx slack` or `effi slack`.
- Do NOT commit anything. Do NOT edit existing files.
- Do NOT propose fixes — describe what was *intended*.
- Do NOT load any persona, principle, or skill beyond defaults.

## Investigative posture

- All time, all resources. Thoroughness over speed.
- When two docs conflict (esp. about which Slack app is canonical, which
  redirect URL is right, which workspace), list both with dates and
  flag.
- Quote sparingly — link by path:line.
- Names: Oria, Lihu, Nitsan. Brown is "the human at the keyboard who
  Lihu relays to" (a relay protocol, not a person).

## Scope guardrails

- TWO distinct flows are in play — keep them separate in the output:
  - **Customer-Slack-into-Effi** (the product feature).
  - **AskEffi-team-Slack-workspace** (our own working environment;
    `useginslack` bot, channel reorg, dev-team channel).
- Do not include Doppler unless it directly bears on Slack (e.g.
  `SLACK_*` secrets needing a Doppler home).
- Do not propose work — desired state + gaps only.

## Stop condition

Output file exists with the seven sections filled.
Return to caller: just the path + a one-line summary.
