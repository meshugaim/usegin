# Slack Integration — Recommendations for Lihu

**Round:** ENG-5399. **Inputs:** `SYNTHESIS.md` + 8 whiteboards under `usegin/research/slack-integration/`.

Five decisions below in z026 shape. Lean is named on each. After Lihu picks, `slicing-specs` can decompose.

---

## R1 — Unified.to scaffold for customer C, or skip and go direct?

**Decision needed:** do we ship a Unified-mediated v0 for customer surface C as scaffolding, or commit to direct Slack from the start?

**Options:**
- **(a) Direct from day one.** Build Bolt-Python OAuth + Events ingestion against direct Slack. ~10–15 days to MVP. Marketplace track starts in parallel.
- **(b) Unified-mediated v0, migrate later.** ~3–5 days to a working v0 (reuses existing `webhooks/unified` seam + Fathom callback shape). Customer migration ~3–4 weeks per `cloud_connections`-fan-out + re-OAuth-every-customer when we cut over. Pay $1/1k API-call overage at scale.
- **(c) Unified-mediated forever.** Ceiling is hard (no reactions/files/Block-Kit/slash commands); permanent two-codepath if we also build D direct.

**Lean: (a).** Skip the Unified scaffold. We'll build direct anyway for D, and migrating C off Unified is the most expensive shape — pay the migration cost up front by not creating it.

**Why:** Unified buys ~1 dev-week, costs a per-customer re-OAuth migration + $1/1k overage at scale + a permanent subprocessor on customer DPAs. The 70% paving (F's number) is read-only ingestion only — the moment a customer asks "where are reactions?" or we want to do anything beyond raw history, ceiling fires. F's verdict was ESCAPE, but ESCAPE only beats direct-from-start if calendar pressure makes the 1-week-saved load-bearing.

**Price:** ~10 extra days before first customer ingest works. We pay this anyway for D, so the marginal cost is mostly calendar-shaped.

**Risk if wrong:** A flagship customer signs and the 10-day delta loses the deal. Mitigation: keep Unified-as-fallback as a known shape — if calendar pressure spikes, reach for it.

**For Lihu to weigh:** is there a customer signed today who's waiting on Slack? If yes → (b) and accept the migration debt. If no → (a) is cleaner.

---

## R2 — Read-only customer Slack at MVP, or bidirectional?

**Decision needed:** does the customer-facing surface include `@Effi` mentions and slash commands at MVP, or strictly ingest?

**Options:**
- **(a) Read-only ingest only at MVP.** Customers ask Effi via the web UI. Bidirectional is a v2 product surface.
- **(b) Bidirectional from day one.** `chat:write` + `app_mentions:read` + `commands` scopes; Block-Kit; Slack-app-distribution review pressure intensified.
- **(c) Read-only for customers; team uses Gin (D) for bidirectional, prove out, graduate to customer later.**

**Lean: (c).**

**Why:** Bidirectional in a customer Slack means clearing a different scope set in Marketplace review, designing prompt-injection defenses for hostile channel content, and figuring out billing for "ask-Effi-from-Slack." D is the safe sandbox — our own Slack, our own blast radius — to harden the Gin-mediated bidirectional pattern. Customer bidirectional graduates from there.

**Price:** Customers will ask "can I just ask Effi in Slack?" on day one. Honest answer: "v2." Sales will eat that question.

**Risk if wrong:** Glean / Notion / similar ship native bidirectional, win on demos. Track competitor pace; reopen if they pull ahead on this exact axis.

**For Lihu to weigh:** competitive pressure tolerance + sales appetite to defer.

---

## R3 — Channel↔project cardinality: 1:1 or N:1 schema?

**Decision needed:** does a project's Slack binding allow N channels (e.g. `#proj-acme-eng`, `#proj-acme-design`, `#proj-acme-pm`)?

**Options:**
- **(a) Strict 1:1, schema and UX both.** C's stated charter rule.
- **(b) Schema N:1, UX defaults to 1.** Drop project_id unique index. UI shows "1 channel" until customer asks for more.
- **(c) N:1 everywhere.** Multi-channel UX from day one.

**Lean: (b).**

**Why:** E's whiteboard showed the team genuinely wants N:1 (we span ≥3 channels per project). G says cardinality cleanup is cheap-designed-in / expensive-retrofit. (b) gets both: clean MVP UX + escape hatch ready when first customer asks.

**Price:** One-line schema change vs C's sketch. UX path needs an "add another channel" affordance later (cheap).

**Risk if wrong:** (a) leaks data-blindness when customers can't bind multiple channels; concrete trigger to upgrade is "≥30% of customers ask in first month" — too slow if it happens. (c) ships UX complexity before we know how customers think about projects.

**For Lihu to weigh:** none — Lean is technical not strategic. Default unless objection.

---

## R4 — Marketplace listing timing

**Decision needed:** when does Marketplace submission start?

**Options:**
- **(a) Submit immediately when direct-Slack OAuth + Events flow is stable on D (internal).** ~2–3 weeks into the build.
- **(b) Submit when first customer is signed.** Reactive.
- **(c) Stay unlisted-distributed forever; cap customer count manually at ~10 workspaces.**

**Lean: (a).**

**Why:** May-2025 ToS cliff means commercial customer surface is broken without listing — the 2026-03-03 full-enforcement date applies to *existing* installs, not just new ones. Review takes 2–6 weeks; calendar-shaped pain is the dominant cost. Start the moment the OAuth flow is real enough to demo. Reuse our existing security posture (`reference_security_reports`) for the questionnaire.

**Price:** A few hours/week through review for questionnaire and reviewer follow-up. Calendar lag of 2–6 wk before we can actually onboard customer #2 onto the listed app.

**Risk if wrong:** (b) leads to "first customer ready, listing not approved, scramble." (c) is a hard ceiling on the business.

**For Lihu to weigh:** confirm we're committed to a customer-facing Slack integration that can scale. If yes, (a). If "internal-only forever," skip.

---

## R5 — Default ingestion posture: events-first, history-as-cold-backfill

**Decision needed:** is the data model and UX promise built around "we have everything from your channel" or "we have everything from when you connected, plus a budgeted backfill window"?

**Options:**
- **(a) Events-first, bounded backfill window (lean: 90 days default, 30/90/all options).** UI clearly states the freshness floor.
- **(b) Best-effort full history.** Try to backfill everything; report progress; don't promise.
- **(c) Events-only, no historical ingest.** Cleanest, weakest demo.

**Lean: (a).**

**Why:** G's Top #1 + A4 (free-plan 90-day retention) + the Marketplace-throttle math all converge: bounded-backfill is the honest UX. 90 days aligns with free-tier retention floor (we can't promise older data even if we wanted to — Slack literally deletes it for free workspaces). Z084's "honor the original date, source the backfill" ethos applies inverted: don't pretend we have history we don't.

**Price:** Customers expect "search-everything"; we deliver "search-recent-plus-everything-since-connect." UX work needed to make the gap legible.

**Risk if wrong:** (b) builds expensive backfill machinery for unbounded windows that hits the throttle wall and fails ugly. (c) demos badly ("I just connected, why is there nothing?").

**For Lihu to weigh:** is "search recent Slack history (90d) + everything from now on" a sellable product framing?

---

## Default sequence (if Lihu green-lights everything)

```
WEEK 1–2 ─────────────────────────────────────────────
  D (UseGin-Slack) build:
    - new Slack app for UseGin (separate app_id from AskEffi-Slack)
    - dx slack send/read/inbox CLI in tools/dx/
    - bot installed on team Slack, #usegin channel created
    - Bolt-Python OAuth + Events scaffold validated end-to-end
  Output: Gin can read/write team Slack via CLI.
  Marketplace track: start the (separate) AskEffi-Slack app submission paperwork the moment OAuth flow demos.

WEEK 3–5 ─────────────────────────────────────────────
  C (customer channel-binding) build on direct Slack:
    - slack_installs (workspace-level) + slack_channel_bindings (project-level) tables
    - schema N:1 from day one (R3 — drop project_id unique)
    - per-message data_items, born-together pattern
    - lifecycle (rename strict-break / archive / revoke / edit / delete)
    - 90-day default backfill window (R5)
    - read-only at MVP (R2 lean c — bidirectional comes via D)
  Output: first pilot customer can connect a channel and see messages indexed.

WEEK 6+  ─────────────────────────────────────────────
  Marketplace review iteration + scale-out:
    - reactions ingestion (signal layer)
    - Slack Connect / shared-channels stub-user model
    - admin UI per-(team_id, channel_id) health panel (G C1)
    - bidirectional graduation path from D → C if competitive pressure fires (R2)
```

**Slice-1 candidate for `slicing-specs` if Lihu says "go":** D's `dx slack send` + `dx slack read` against bot token, no Events API receiver. ~1 week. Validates the OAuth + Bolt-Python + token-storage spine on internal blast radius before C touches a customer.

---

## What's NOT in this recommendation (deliberately deferred)

- **Enterprise Grid org-wide installs** — H D1 leans N-rows-at-install but punts to "v1 vs v2 target" question. Not on critical path.
- **Per-user xoxp tokens** — H D3, default off; revisit only if "Gin posts as me" becomes a product line.
- **Cross-channel team-wide search** — would require workspace-level data items, not a Slack-integration question.
- **Reactions as signal** — capture in schema (`raw` field), don't index at MVP.
- **DM / mpim ingestion** — refused at customer surface; Gin can read team DMs internally if useful.
