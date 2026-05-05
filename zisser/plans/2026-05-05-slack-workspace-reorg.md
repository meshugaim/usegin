---
title: Slack workspace reorg — channel + bot + Slacker integration desired-state
date: 2026-05-05
author: sub-Zisser (DevOps track; Lihu mid-flight)
charter: parent-Zisser dispatch (this turn)
sibling: zisser/plans/2026-05-04-slack-ux-alignment.md (UX/UI track — product surfaces)
status: draft for Lihu — defaults fire if silent
related:
  - tools/dx/src/slack/registry.ts
  - usegin/research/slack-integration/SYNTHESIS.md
  - zisser/dispatched/2026-05-04-slack-autonomous-ops-zisser.md
  - zisser/plans/2026-04-29-slack-fully-functional.md
inventory_snapshot:
  - /tmp/slack-inventory/channel-detail.json
  - /tmp/slack-inventory/users.json
workspace: askeffiworkspace.slack.com (T09ND5V6T9S, Pro plan)
---

# Slack workspace reorg — desired-state plan

> **Two-faces.** Lihu-side = what you'll see. Zisser-side = what shifts under it.
> The UX/UI track (sibling plan) owns customer-facing Slack product surfaces.
> This plan owns **the AskEffi team's own Slack** as a working environment.

---

## 0. The click

Today's Slack is an unsorted pile of 14 channels — half are Slack-default
shapes (`new-channel` never renamed), half are real working channels with
inconsistent membership (Oria absent from GTM/brand, Courtney absent from
`effi-dev`, the Unified vendor channel mostly-external). Three test/spike
channels (`new-channel`, `spike-slack-unified`, `effi_spike` bot
sprinkled across) clutter the surface. Bot inventory is half-test
(`effi_spike`), half-real (granola, googledrive, inbound).

**The reorg target:** a lean workspace where (a) every channel name
declares its purpose (no `new-channel`), (b) every member's presence is
intentional, (c) Slacker (Zisser's voice into Slack) has three
dedicated channels matching `tools/dx/src/slack/registry.ts`, and (d)
the customer-facing-app spike (`effi_spike`) is removed pending the
real AskEffi-Slack production install.

---

## 1. The picture (post-reorg)

### Channel list — 13 channels, two zones

```
TEAM ZONE — humans + tools
├── #all-askeffi        — announcements, everyone (kept)
├── #social             — non-work (kept)
├── #effi-dev           — eng technical (kept; Courtney optional)
├── #product            — product, design, decisions (kept)
├── #brand              — brand, copy, marketing (kept)
├── #gtm                — GTM, sales, pipeline (kept)
├── #client-discovery   — renamed from #client-discovery-calls (kept)
├── #usability          — renamed from #usability-studies (kept)
├── #ocw                — OCW (kept; explanation in topic)
├── #related-tech       — adjacent-AI links, tools, papers (kept)
└── #site-inbound       — inbound from the marketing site (kept)

SLACKER ZONE — Zisser's voice into the team
├── #slacker-out        — Brown relays, durable artifacts, Lihu-should-see
├── #slacker-alerts     — Sentry, watchers, urgency
└── #slacker-log        — append-only daily summaries

EXTERNAL (Slack Connect)
└── #unified-askeffi    — Unified.to vendor channel (kept; archive after migration off Unified)

ARCHIVED
├── #new-channel        — Slack-template residue (5 humans inside — see §6)
└── #spike-slack-unified — throwaway test (lihu+effi_spike only)
```

**Total: 11 internal + 3 Slacker + 1 Connect = 15 active.** Two archives.

### Naming convention

| Prefix / shape | Meaning |
|---|---|
| `#<topic>` | Bare-name = canonical work channel (most channels) |
| `#slacker-<x>` | Slacker (Zisser-the-agent's voice into the team) |
| `#client-<x>` | Client-facing or client-derived (discovery, etc.) |
| Reserved (no use yet): `#proj-<x>` | Per-project channels if they ever appear; today projects are too few |

**No `slack-` prefix** for Slacker channels (would be redundant — we're
in Slack). Use `slacker-` so `#slack-*` stays available if we ever need
Slack-meta channels (e.g., `#slack-experiments`).

### Membership by role

| Channel | Lihu | Oria | Guy | Nitsan | Courtney | Slacker | granola | googledrive |
|---|---|---|---|---|---|---|---|---|
| `#all-askeffi` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| `#social` | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – |
| `#effi-dev` | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | ✓ |
| `#product` | ✓ | (✓?) | ✓ | ✓ | ✓ | – | ✓ | – |
| `#brand` | ✓ | – | ✓ | ✓ | ✓ | – | – | – |
| `#gtm` | ✓ | – | ✓ | ✓ | ✓ | – | ✓ | – |
| `#client-discovery` | ✓ | – | ✓ | ✓ | ✓ | – | ✓ | – |
| `#usability` | ✓ | – | ✓ | ✓ | ✓ | – | ✓ | – |
| `#ocw` | ✓ | ✓ | – | ✓ | ✓ | – | – | – |
| `#related-tech` | ✓ | (✓?) | ✓ | ✓ | ✓ | – | – | – |
| `#site-inbound` | ✓ | – | ✓ | ✓ | ✓ | – | – | ✓ |
| `#slacker-out` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| `#slacker-alerts` | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – |
| `#slacker-log` | ✓ | ✓ | – | – | – | ✓ | – | – |

**Two membership questions land as ↑Qs** (§6): does Oria join product/related-tech?

---

## 2. Diff from current

| Channel | Current | Action | Why |
|---|---|---|---|
| `#all-askeffi` | 6 members | **keep** | Canonical announcements |
| `#brand` | 4 (no oria) | **keep** | Already sized correctly (eng/business split) |
| `#client-discovery-calls` | 4 | **rename** → `#client-discovery` | Drop the redundant `-calls` suffix |
| `#effi-dev` | 5 (lihu, oria, guy, nitsan, effi_spike) | **keep + add Slacker; remove effi_spike** | Slacker eventually replaces effi_spike here once real-AskEffi-Slack ships |
| `#gtm` | 4 | **keep** | Already correct |
| `#new-channel` | 5 humans (real activity!) | **archive after extracting** | Slack-default name; if it has real history, parent-Zisser must read its purpose first — see §6 ↑Q1 |
| `#ocw` | 5 | **keep** | OCW = oria-crazy-world; topic should explain |
| `#product` | 4 (no oria) | **keep** | See ↑Q2 — should oria be in here? |
| `#related-tech` | 4 (no oria) | **keep** | See ↑Q2 |
| `#site-inbound` | 4 | **keep** | Inbound channel — googledrive bot already there |
| `#social` | 5 | **keep** | Everyone in |
| `#spike-slack-unified` | 2 (lihu+effi_spike) | **archive** | Throwaway test |
| `#unified-askeffi` | 12 (mostly externals) | **keep, plan archive** | Vendor channel; archive when we migrate off Unified.to (per SYNTHESIS DV1 — direct-Slack target) |
| `#usability-studies` | 5 | **rename** → `#usability` | Shorter; "studies" implies academic, we mean user-research |
| `#slacker-out` | doesn't exist | **create** | `tools/dx/src/slack/registry.ts:outbox` |
| `#slacker-alerts` | doesn't exist | **create** | `tools/dx/src/slack/registry.ts:alerts` |
| `#slacker-log` | doesn't exist | **create** | `tools/dx/src/slack/registry.ts:log` |

**Counts:** 14 → 15 active (11 kept, 2 renamed, 3 created, 2 archived).

### Topic + purpose for every kept/created channel

Every kept/created channel gets a one-line `topic` set via
`conversations.setTopic` so a new joiner reads "what is this for" in 5
seconds. Slacker can do this autonomously (reversible).

---

## 3. Bot inventory

| Bot | Real name | What it does | Recommend | Browser-only action needed |
|---|---|---|---|---|
| `granola` (U09NFEWMAUW) | Granola | Meeting recorder/notes | **keep** | – |
| `googledrive` (U09P1NK6NJG) | Google Drive | Drive link previews | **keep** | – |
| `inbound` (U0A2224G7PG) | Inbound | Site inbound (lives in `#site-inbound`) | **keep** | – |
| `effi_spike` (U0B098LR8EA) | Effi Spike | Customer-facing AskEffi-Slack **test app** | **remove** | Lihu deletes at `askeffiworkspace.slack.com/apps/manage` once the real AskEffi-Slack production install lands. Until then keep — removing now would break the spike. |
| (new) `useginslack` / Slacker | UseGin/Slacker | Zisser's voice into Slack | **add** (Lihu installs to real workspace per parent-Zisser's A1–A7) | – |

**Net after reorg:** 4 bots (granola, googledrive, inbound, slacker)
+ effi_spike removed once production AskEffi-Slack is installed.

---

## 4. Slacker integration plan

### Channel ownership

The three constants in `tools/dx/src/slack/registry.ts` are **already
named correctly** for Slacker — keep them as-is:

```ts
ZISSER_CHANNELS = {
  outbox: '#slacker-out',     // RENAME from '#zisser-out'
  alerts: '#slacker-alerts',  // RENAME from '#zisser-alerts'
  log:    '#slacker-log',     // RENAME from '#zisser-log'
}
```

**Argument for rename `#zisser-*` → `#slacker-*`:** Lihu's anchor today
named the agent **"Slacker"** (Zisser's voice when it speaks into
Slack). Zisser is the chief-of-staff; Slacker is the persona/voice in
this medium. Channel names should match the persona-in-medium, not the
underlying agent — same way we don't have `#claude-out`, we have
named-by-purpose channels. Wes does the rename in the registry file
(NOT this turn — Wes's domain). One commit, two-faces export-name kept
(`ZISSER_CHANNELS` → `SLACKER_CHANNELS` is a separate decision; default:
also rename, but defer to Wes per decision-rights).

**Counter-argument (kept for completeness):** if "Slacker" is just one
of many Zisser-personas-in-medium (Slacker for Slack, Linearer for
Linear, Mailer for email…), then keeping the export name `ZISSER_*` and
just renaming the channel strings is cleaner. **Recommended:** keep
export `ZISSER_CHANNELS`, rename the string values to `#slacker-*`. Wes
ships in one commit.

### What lands in each channel

| Channel | Posted by | Content |
|---|---|---|
| `#slacker-out` | Slacker (manual + Zisser-dispatched) | Brown relays, durable artifacts, "Lihu should see this" notes, daily summaries' headline |
| `#slacker-alerts` | Slacker (watcher-driven) | Sentry P1+, push failures, build breaks, deploy alarms, autonomous-Gin halts |
| `#slacker-log` | Slacker (cron / autosync) | Append-only: end-of-day summary, dispatch landings, charter completions |

### Membership

- **Lihu**: in all three.
- **Oria**: in all three (acting partner / chief-of-staff observer).
- **Guy, Nitsan**: in `out` + `alerts` (so they see urgent Slacker output and durable artifacts).
- **Courtney**: in `out` only (durable artifacts, not the dev firehose).
- **Slacker bot itself**: in all three (self-evident; required to post).

---

## 5. Reversible vs irreversible — action list for parent-Zisser

### Reversible (parent-Zisser can autonomously execute)

| # | Action | API | Reversal |
|---|---|---|---|
| R1 | Set topic + purpose on every kept channel | `conversations.setTopic`, `setPurpose` | re-set to old value (parent saves snapshot first) |
| R2 | Slacker self-joins `#slacker-*` (after Lihu creates them) | `conversations.join` | `conversations.leave` |
| R3 | Create `#slacker-out`, `#slacker-alerts`, `#slacker-log` (public) | `conversations.create` | archive (R6) |
| R4 | Invite humans to `#slacker-*` per §1 membership table | `conversations.invite` | `conversations.kick` |
| R5 | Post the inaugural message in each new Slacker channel (purpose statement) | `chat.postMessage` | `chat.delete` |
| R6 | (still reversible) archive `#new-channel`, `#spike-slack-unified` | `conversations.archive` | `conversations.unarchive` |

**Decision-rights:** parent-Zisser executes R1–R5 autonomously. R6
needs a Lihu nod for `#new-channel` (humans-have-real-history concern —
see ↑Q1).

### Needs Lihu nod (irreversible *socially*, not technically)

| # | Action | Why nod-needed |
|---|---|---|
| L1 | Rename `#client-discovery-calls` → `#client-discovery` | All members get a notification; existing references in Linear/docs may break (Slack rewrites links but copy-pasted IDs are fine). Trivial cost; Lihu approves once. |
| L2 | Rename `#usability-studies` → `#usability` | Same as above. |
| L3 | Archive `#new-channel` | Has 5 humans + real history (§6 ↑Q1). |
| L4 | Membership changes per §1 (e.g., adding Oria to `#product`/`#related-tech`) | Affects who-sees-what; Lihu's call. |

### Needs Lihu's browser (Pro plan = no `admin.*` API)

| # | Action | Where Lihu does it |
|---|---|---|
| B1 | Remove `effi_spike` bot | `askeffiworkspace.slack.com/apps/manage` → Effi Spike → Remove App. **Do AFTER** real AskEffi-Slack production install lands. |
| B2 | Install Slacker (UseGin-Slack) bot | Per parent-Zisser's A1–A7 in `zisser/dispatched/2026-05-04-slack-autonomous-ops-zisser.md`. |
| B3 | (Eventually) archive `#unified-askeffi` Connect channel | When/if we leave Unified.to per SYNTHESIS DV1. **Not now.** |

---

## 6. Open ↑Qs for Lihu (≤3, defaults fire if silent)

- **↑Q1** `#new-channel` has 5 humans actively in it but never renamed from Slack-template default. Archive, rename to declared purpose, or read its history first?
  *Default: parent-Zisser reads last 50 messages, proposes a rename in `zisser/inbox/`, doesn't archive yet. If empty, archive next turn.*
- **↑Q2** Add Oria to `#product` and `#related-tech`? Currently kept out of business-side channels (brand, gtm, client-discovery, usability) which seems intentional — but `#product` and `#related-tech` are eng-adjacent.
  *Default: yes — add Oria to both. Reversible.*
- **↑Q3** Slacker channel naming: `#slacker-*` (per-medium persona, this plan's default) vs keep `#zisser-*` (per-agent identity, current registry)?
  *Default: rename to `#slacker-*` (medium-specific persona is clearer for human team members; agent-internal export name `ZISSER_CHANNELS` stays).*

---

## 7. What this plan is NOT

| Out of scope | Where it belongs |
|---|---|
| `dx slack` admin-grade ops (channel create/archive/invite from CLI) | `zisser/dispatched/2026-05-04-slack-autonomous-ops-zisser.md` (Wes is shipping) |
| Customer-facing Slack product UX (workspace install + project binding) | `zisser/plans/2026-05-04-slack-ux-alignment.md` (sibling track) |
| Slack message ingestion (C4 events → `data_items`) | `zisser/plans/2026-04-29-slack-fully-functional.md` |
| Slack Marketplace listing | Same plan above (R4 in `recommendation.md`) |
| Real AskEffi-Slack production install (the customer app) | Lihu's clicks per parent-Zisser A1–A7 |
| Removing `effi_spike` test bot | After real AskEffi-Slack lands; Lihu's browser |

---

## 8. Inventory findings parent-Zisser may have missed

1. **`#new-channel` is not junk.** 5 humans, real activity since lihu created it. Slack-template name was never replaced — typical "first-channel-Lihu-made" residue. Don't archive blindly. (§6 ↑Q1)
2. **`#unified-askeffi` Connect channel has only 2 of our 5 humans (lihu, oria).** Guy/Nitsan/Courtney are not in our vendor channel — likely intentional (lihu owns vendor relationships). Worth confirming: do Guy/Nitsan ever need vendor visibility? Default: no, keep current.
3. **`effi_spike` bot is in 3 channels, not just one:** `#all-askeffi`, `#effi-dev`, `#spike-slack-unified`. Removing the bot via browser (B1) cleans all three; no per-channel kick needed.
4. **Membership asymmetry on Oria:** in `#all-askeffi`, `#effi-dev`, `#new-channel`, `#ocw`, `#social` — out of `#brand`, `#client-discovery-calls`, `#gtm`, `#product`, `#related-tech`, `#site-inbound`, `#usability-studies`. The eng/business split is consistent except `#product` and `#related-tech` (which are eng-adjacent and arguably should include Oria). (§6 ↑Q2)
5. **Courtney out of `#effi-dev`, Guy out of `#ocw`.** Both look intentional (eng vs business; OCW is a personal-world thing). Not flagging.
6. **Lihu and Oria are workspace owners + admins** (`is_owner: true, is_admin: true`); the others are members. So Lihu is the only one who can install apps / approve OAuth — confirms parent-Zisser's "Lihu's clicks" framing.
7. **`unified-askeffi` creator is `U057P9VD0DV`** — a Unified.to staff member, not someone in our team. Confirms it's their hosted Connect channel, not ours. Archive must be coordinated with them when we leave the platform.

---

*End of plan. Lihu reads → marks ↑Qs → parent-Zisser executes the
reversible actions and pings Lihu for the rest.*
