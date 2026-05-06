---
name: morning-brief
description: Pull-on-demand cross-Gin synthesis at the start of a session — overnight commits, open zettels (especially open-to-empty / decisions-pending), Sentry deltas, Linear changes, active sub-Gin state. The cadence is the load-bearing piece, not the artifact (per war research C5 + DL1 lean B). Triggered by phrases like "morning brief", "what happened overnight", "catch me up", "/morning-brief", or by your own judgment when the live user is opening a fresh session and the substrate has moved.
---

# Morning Brief

Pull-on-demand session-start synthesis. Battle rhythm at our scale, kept light: no enforced cadence, no hook-driven alarm, just an artifact the live user reaches for when they open a session and want to know what moved while they were away.

## Why

The war research (`usegin/research/war-management/SYNTHESIS.md` C5 + DL1) converges on three independent findings: PO"SH says we lack a battle rhythm; Modern Application says McChrystal-style O&I is the load-bearing missing ritual; IAF tikkur says daily is non-negotiable. Mission Command warns the opposite — at our scale (1 human + N Gins), enforced cadence collapses into ceremony.

Synthesis: build the artifact, skip the cadence. Lihu pulls it on demand. If after 2 weeks of use it has compounded, upgrade to enforced cadence (Pitfall-2-aware); if not, kill it cleanly.

## When to use

- Lihu opens a session after >12h of asynchronous work (overnight, weekend, return from a different track).
- Multiple sub-Gins have been running in parallel; Lihu wants the in-flight COP (per D3 — pull-on-demand, not default-on stream-watching).
- Before a non-trivial decision, to ensure the substrate has been read.

Don't use for: micro-syncs ("what just happened in the last 5 min" — read the chat); deep retros (use `session-retro`); incident response (use `tikur`).

## What it produces

A single markdown block, top-down read. Each section stays terse (laconic, principle z032) and points at deeper artifacts for "investigate without limit" (z018) when needed.

```markdown
# Morning Brief — YYYY-MM-DD HH:MM

## Since last brief
- N commits to main (range <SHA>..<SHA>); the load-bearing 3 are <SHAs> for <reasons>.
- N pushes by other Gin sessions; conflict / collision count from `tikur-records/` since cutoff.
- N new zettels (z<N>..z<M>); the load-bearing 1–3 are <ids> for <reasons>.

## In flight
- Active sub-Gins: <IDs from agent-records>, charters at <paths>.
- Open-to-empty zettels created this window (need eyes from Lihu).
- Pending decisions in z020 shape (look for `dilemma` or `for you to weigh` markers).

## Friction window
- New tikur-records/ files since cutoff.
- New friction-zettels (anything tagged friction or with frustration_high).
- `dx his` aspects worth flagging from the cutoff window.

## External
- Sentry delta (top-3 issues by event-count or new-fingerprint since cutoff).
- Linear: status changes on issues Lihu is assigned to or watching.
- CI: red runs on main since cutoff.

## Suggested first move
One line. Per principle 6 (Lihu's attention is the COG), name the *one* thing whose absence Lihu would later regret. Not a list — the click.
```

## Cadence

**Pull-on-demand.** No hook fires it. No daily alarm. Lihu reaches for it (or asks UseGin to). The discipline is in the *use*, not the trigger.

If after 2 weeks of organic use Lihu is reaching for it daily, *then* propose upgrading to a session-start hook (DL1 option C). Until then, ceremony risk > absence cost.

## Implementation

Until `dx morning-brief` lands as a CLI primitive (slice for ENG follow-up), produce the brief by composing existing surfaces — UseGin runs the queries inline:

```bash
# Time cutoff = last brief, or 24h ago if no prior brief
SINCE="24 hours ago"

# Commits
git log --oneline --since="$SINCE" main

# Tikur records since cutoff
find .claude/tikur-records/ -newer-than 1d  # rough proxy

# Zettels since cutoff
ls -t usegin/zettel/zettels/ | head -20

# Sentry delta
sentry list-issues --since 1d --top 3   # via reference_sentry_cli

# Linear
plan list --assignee @me --since 1d
plan list --watching --since 1d

# CI red
gh run list --branch main --status failure --created ">$(date -d '24 hours ago' -Iseconds)"
```

The *synthesis* is the value-add — UseGin reads the raw data and produces the structured brief above. Don't dump raw command output; that's the failure mode (Pitfall 2 — ceremony without decision).

## Pitfall guards

- **No decisions = no point.** If three consecutive briefs land without a single "today we will X because of Y" delta, kill the skill. Pull-on-demand exists to surface deltas; without deltas, it's noise.
- **Don't dump raw output.** Per laconic — investigate without limit, output the click. The raw `git log` belongs in evidence; the brief carries the meaning.
- **Don't tell Lihu what he already knows.** If the answer is "you know all this already," say so and offer the suggested first move only.
- **No formatting fluff.** No banners, no emojis, no "good morning". The brief is a tool, not a greeting.

## Threading
↑z028 · ~principle 05 (#5 orient + #6 COG) · ~Gin.md (process over outcome) · ~`tikur` skill · ~`session-retro` skill · ~`use-gin` skill (capabilities handbook).

## Source
War research SYNTHESIS C5 + DL1 (`usegin/research/war-management/SYNTHESIS.md`). Whiteboards from PO"SH (battle rhythm), Modern Application (McChrystal O&I), Mission Command (Pitfall 2), IAF tikkur (daily ritual).
