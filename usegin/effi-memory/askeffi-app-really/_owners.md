---
status: v0 proposal — needs Lihu sign-off (decides O-1 from _lifecycle.md)
decided: 2026-05-08
decided-by: claude (effi-memory R&D, this session); pending Lihu confirm
---

# Topic owners

The reconciler routes conflict-pending claims and high-stakes gaps to a
human owner per topic. This file is the routing map.

## Resolution rules

- **Primary owner answers** by default. Secondary is fallback if primary is
  unreachable (e.g. travel, OOO, dormant — see [activity](notes/activity.md)).
- **`team`** means *anyone reviews on cadence* — not DM'd to one human;
  goes to the queue surface that whoever's-on-rotation reviews.
- A human edit to a `Current` line overrides the reconciler's pending state
  and pins the claim (per `_conventions.md` "Reconciler is the only writer
  *to notes*… don't clobber a human's `Current` line").
- Owner doesn't have to *be* the source of truth. They're the **routing
  destination** — the person who can either answer directly or knows who
  can.

## Map

| Topic | Primary | Secondary | Notes |
|---|---|---|---|
| `founders` | Guy | Lihu | Each owns their own bio |
| `team` | Guy | Nitsan | CEO sets team shape; Nitsan owns engineering hiring |
| `activity` | `team` | — | Reconciler-driven from observable cadence; rare human pin |
| `product` | Lihu | Nitsan | CTO owns the product surface |
| `data-sources` | Nitsan | Lihu | Engineering owns integrations |
| `competitors` | Guy | `team` | Courtney was secondary pre-silence |
| `design-partners` | Guy | `team` | Guy is primary contact for all 8 |
| `prospects` | Guy | `team` | Same — Courtney was secondary pre-silence |
| `gtm` | Guy | `team` | Cleverly is a vendor, not an owner |
| `financials` | Guy | Lihu | CEO owns raise/burn; CTO owns eng cost-of-goods |
| `roadmap` | Lihu | Nitsan | Product roadmap → CTO |
| `tech-stack` | Nitsan | Lihu | Backend lead is closest to ground truth |
| `compliance` | Lihu | Guy | CTO owns security posture; CEO owns customer-facing claims |
| `positioning` | Guy | `team` | |
| `icp` | Guy | `team` | |
| `pricing` | Guy | — | Pre-revenue; pricing is purely Guy's call |
| `north-star` | Guy | Lihu | |
| `raise` | Guy | — | Investor relationships are CEO's |
| `investors-and-advisors` | Guy | — | Same |
| `customer-outcomes` | Guy | Lihu | CEO observes commercial; CTO observes engineering signal |

**Default fallback for any unmapped topic**: `team`.

## When the owner is unreachable

`activity.md` is the cadence ground-truth. A reconciler implementation
should:

1. Check `notes/activity.md` for the primary owner's status.
2. If primary is `🟢 Core active` or `🟢 Hyperactive` → route to primary.
3. If primary is `🟡` / `⚠️` / `⚪` → route to secondary (or `team` if no
   secondary).
4. Always keep the audit trail — the reconciler logs the routing decision
   so a later read shows *why* a particular human was asked.

## Topic→owner conflicts to expect

- **`compliance` and customer-facing claims.** Lihu owns posture; Guy
  owns what we *say* to customers. When a customer asks "do you have
  SOC2", the answer goes through Guy first (commercial framing) but Lihu
  is the ground truth on whether we actually have it.
- **`gtm` and Cleverly outputs.** Cleverly is a paid vendor producing
  outbound; the *interpretation* of their results is Guy's. Don't route
  conflicts about Cleverly performance to Cleverly.
- **`activity` self-referential edge case.** If the reconciler needs to
  pin an activity claim about Guy, and Guy is unreachable, Lihu is
  secondary. Don't ask the subject of the claim about the claim — that's
  same-source restatement.

## Open

- **O-1a** — should owners get notified per-conflict, or batched on a
  cadence? Per-conflict gives faster resolution; batching avoids
  notification fatigue. Hold open until we measure conflict rate.
- **O-1b** — should the owner-ask channel be Slack DM, dedicated channel,
  or in-Effi-conversation? See [_lifecycle.md](_lifecycle.md) O-2.

## See also

- [_lifecycle.md](_lifecycle.md) — feature lifecycle; O-1 is what this
  file resolves
- [_conventions.md](_conventions.md) — note shape, reconciler rules
- [notes/activity.md](notes/activity.md) — cadence ground truth used by
  the unreachable-owner fallback
