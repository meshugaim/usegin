---
name: team-customers
description: Use this when an agent needs context on AskEffi's customers, design partners, or prospects — who is X, what's the latest with Y, what's the active pipeline. Triggered by "who is Elsante", "what do we know about Urban Insight", "what's our active design partners", "who do we have in discovery". NOT for: AskEffi production user records (different scope — that's product data), the internal team (`team-people`), random people mentioned in passing.
---

# Team customers

Design partners, prospects, paying customers, friends-and-family testers — the external organizations and people we're talking to about adopting AskEffi.

## Where the data lives

| Source | What's there | How to query |
|---|---|---|
| Slack `#client-discovery` | Granola/Fathom intake notes after every customer call. Densest single channel | `slack_search_public query='in:#client-discovery after:<date>'` |
| Gmail | Outbound from Guy to `@*.com`; inbound from external; Fathom recap emails (`from:no-reply@fathom.video`); calendar invites | `search_threads query='from:guy@askeffi.ai newer_than:60d'` |
| Effi (dogfooding) | Synthesizes across emails + Drive; surfaces internal-meeting refs | `effi --profile dogfooding ask "..."` |

Effi is the right starting point for "what's the latest on X" — denser than any single source.

## Status legend

When characterizing a customer, use one of:

- `prospect` — top of funnel, intro made, no demo yet
- `discovery` — had a call, learning each other
- `design-partner` — committed to active feedback loop, often unpaid
- `friends-and-family` — informal testers, usually small / personal connection
- `paying` — paying customer
- `dormant` — went quiet, unclear if it'll resume

As of 2026-05-06: **no paying customers yet**. Two active design-partner pilots: **Mkenga** (Elsante Mnzava) and **Epsilon** (Ricky Green). **Critical Loop** (Andrew Grinalds, COO) joined 2026-05-01.

## Active threads (snapshot — these change weekly, re-query before relying)

- **Mkenga / Elsante** — Mon May 11 2026 call; Slack rollout is the next product moment
- **Epsilon / Ricky Green** — weekly Friday "grumpy feedback loop"; Slack integration unblocks
- **Critical Loop / Andrew Grinalds** — first call May 1; recurring Friday 6:30pm CEST
- **Pure Integration / Matt Gay → Mike Lenz** — Teams integration is the gate
- **SAP / Thomas Pfiester** — top-of-funnel; intro from Manoj Swaminathan

## Recurring themes from discovery

- **MSFT/SharePoint/Teams stack** keeps coming up — gating integration for mid-market
- **Slack integration** = #1 product ask from existing design partners
- **Mid-market sweet spot** — complex enough to have silos, small enough to move fast (Patrick @ Boostr's framing)
- **$1,600/mo for 20 projects** is too high for the smallest design-partner candidates (Elsante, Emergent Connext)

## Key referrers (track separately from customers)

| Name | Channel |
|---|---|
| Noela Nakos | ex-Oracle, J-Ventures VC; top connector — 5+ named intros |
| Manoj Swaminathan | SAP exec (GM & CPO Business Suite); intro'd Thomas Pfiester |
| Bill King | Movi Partners; intro'd Critical Loop |
| Dror Sharon | Intro'd Andrea Jones / AJC |
| Chetan Bhatnagar | Ex-ERP-vendor SVP turned advisor; offered partner intros |

## Looking someone up

```bash
# Effi first
effi --profile dogfooding ask "What do we know about <Company> / <Person>? Status, last touch, next step."

# Triangulate
mcp__claude_ai_Slack__slack_search_public query='in:#client-discovery <name>'
mcp__claude_ai_Gmail__search_threads query='<name> OR <company-domain>'
```

## Not to be confused with

- **AskEffi production user records** — production user database. Different scope; this skill is sales/design-partner intelligence
- **The internal team** (`team-people`) — Lihu, Nitsan, Oria, Guy, Chris Baum
- **Random mentions** — someone Cc'd once, a name in a Granola transcript referring to a third party. Lean toward "in the ledger" only when there's an active or recent thread

## Source queries (re-run for freshness)

```bash
# Full meta-pull
effi --profile dogfooding ask --new "Give me a complete list of every external company or individual we're talking to about AskEffi — design partners, prospects, referrers, dormant. For each: name, primary contact, status, last touch."

# Slack #client-discovery sweep
mcp__claude_ai_Slack__slack_search_public query='in:#client-discovery after:2025-10-01' sort=timestamp

# External Gmail outbound
mcp__claude_ai_Gmail__search_threads query='from:guy@askeffi.ai -to:@askeffi.ai newer_than:90d'
```
