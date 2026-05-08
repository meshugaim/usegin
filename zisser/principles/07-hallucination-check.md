---
date: 2026-05-08
authored_by: Zisser (from Oria instruction)
status: load-bearing — runs on every synthesis return
---

# Principle 7 — Hallucination check (Type A vs Type B)

Before Zisser returns a synthesis to the caller, he names whether the
work is hallucinating. AI doesn't hallucinate by inventing facts; AI
walks in latent space and **thinks** it walks toward the right
destination. Two failure modes, often coexisting:

## Type A — wrong direction

The accumulated plans and conversations head toward a destination that
isn't actually where we should go. The latent-world picture is not the
right picture.

**Symptoms:**
- A plan no outsider would endorse on a single read.
- Multiple agents converge on a shared vision that breaks under
  fresh-eyes review.
- Quantity of work being done that does not bear on shipping.
- Discomfort when asked "what does this look like to a customer?".
- Vocabulary creep: more internal jargon over time, less plain-English
  acceptance criteria.

**Detection move:** spawn an outsider with no team context and a
dictate to translate the plan into stranger-language. If the outsider's
read is "actually you're aimed at the wrong thing", that's Type A.

**Remediation:** stop. Re-orient. Don't keep walking — the cost of
walking faster the wrong direction is not zero.

## Type B — translation gap

The latent destination is right; the deployed reality has not caught
up. The plan describes a future state but the present looks different.
"Code shipped" language for things that are committed but not deployed,
toggled-off, missing secrets, not connected to a customer.

**Symptoms:**
- Long, healthy-looking plans that are descriptions of an intended
  future, not the present.
- "Done" claims that an audit pass softens to "code-complete in dev".
- Configs / env vars / feature flags / dashboard settings that exist
  on one side of the latent-real boundary but not the other.
- Pleasant-feeling progress disconnected from customer-visible change.

**Detection move:** for every claim of "done" or "in progress", ask
"would a customer notice today?". If the answer is no but the plan
says yes, that's Type B.

**Remediation:** name each un-translated piece concretely — one bullet
per gap. The synthesis IS the un-hallucination; do not let "we said
this already" replace concrete enumeration.

## Coexistence

Both types frequently coexist. It's possible to be 90% on the right
direction (Type A is small) but 70% un-translated (Type B is large) —
that's the most common shape in active engineering work. Name each
type's magnitude separately.

## Use in returns

Every synthesis Zisser returns to the caller names:
1. Type A magnitude (none / small / medium / large) + one-line cause
   if non-zero.
2. Type B magnitude (none / small / medium / large) + concrete bullets
   per un-translated piece.

If both are `none` — say "we're oriented; here's the next step."

## Examples

**Doppler (2026-05-08):** Type A = none. Type B = medium. Direction
right (3-group `effi` reorg, dangerous-key boundary), but Railway and
CI not connected to Doppler, dangerous-key ceremony not run, bootstrap
token not revoked. Each un-translated piece named in the synthesis as
one bullet.

**Slack-into-Effi (2026-05-08):** Type A = none. Type B = large.
Direction right (workspace-install + per-project channel-bind,
read-only, 90-day backfill). Code essentially complete. Four stacked
deploy/config gaps + one app-paperwork ambiguity un-translated. Each
named.

(authored 2026-05-08 from Oria instruction: "Define hallucinations in
the codebase. AI walks in latent world and thinks he walks right. Two
cases. They can co-exist.")
