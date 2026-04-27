# Slack Integration R&D — Synthesis

**Round:** ENG-5399. 8 whiteboards (A unified-platform, B slack-direct, C customer-binding, D usegin-slack, E askeffi-slack-team, F comparative-paths, G risks, H auth-cardinality). E collapsed mid-round into C.

---

## The load-bearing finding

**Slack's May-2025 ToS change is the cliff that drives every other decision.** `conversations.history` and `conversations.replies` are now throttled to **1 req/min × 15 msgs/page** for any non-Marketplace, non-internal app — full enforcement on existing installs by **2026-03-03**. Math: a 6,000-msg channel = ~6.7 hours of single-channel backfill; a 50-channel workspace = ~14 days. Customer-facing Slack at scale is **physically impossible** without (a) Marketplace listing, or (b) an events-first ingestion posture that treats `history` as a rare cold-backfill primer, not the spine. This is not a "later" concern — it shapes the data model, the UX promise, the spec, and the calendar. Internal apps (UseGin-Slack, dogfood) are unaffected.

---

## Convergent findings (3+ angles independently agree → high-confidence facts)

These are NOT dilemmas. They're settled.

| # | Finding | Where it shows up |
|---|---|---|
| **CF1** | **Marketplace listing is critical-path** for any commercial customer surface. Submit early; expect 2–6 wk review. | B (D1), F (D1), G (Top #1, D1) |
| **CF2** | **Bot token (`xoxb-`) is the spine.** User tokens (`xoxp-`) are opt-in per feature, never the default. | B (scopes table), D (one bot, attribution in payload), H (token matrix) |
| **CF3** | **Connection-at-workspace, binding-at-project — two-table split from day one.** One Slack OAuth covers many channels which can each bind to different AskEffi projects. Single-table shape from Drive/Linear precedent does NOT fit. | B (D4), C (schema split), G (#2), H (slack_installs proposal) |
| **CF4** | **Events API (HTTP), not Socket Mode.** Marketplace forbids Socket Mode; HTTP fits our Next.js-public / Python-internal invariant. Ack-then-process within 3s. | B (D3), F (matrix row), G (B9) |
| **CF5** | **Per-message data items**, with thread bundling at retrieval time. Per-channel rollups break citations + RLS; per-thread breaks per-message access tier. | C (granularity table), F (data shape diff), G (B5 idempotency on `(team_id, channel_id, ts)`) |
| **CF6** | **No LLM in ingestion.** Mrkdwn → plain via regex (email-splitter ENG-5197 precedent applies). | C (anti-decisions), G (cross-references) |
| **CF7** | **Multi-Slack-workspace per AskEffi-workspace is normal**, not edge. Schema must accept N installs under one workspace from day one (Fathom-per-recorder precedent). Reverse direction (one Slack → two AskEffi tenants) MUST be locked. | B (D4), C (cardinality), G (B1), H (Top + D2) |
| **CF8** | **Webhook ingress stays via Next.js → Python proxy.** Preserve the public-surface invariant; Slack signing-secret verify on Next.js, internal-RPC sign forward to Python. Mirrors `webhooks/unified` and `webhooks/mailgun`. | A (`_DISPATCH` seam), B (D3), F (matrix) |
| **CF9** | **Channel rename / archive / `tokens_revoked` / `app_uninstalled` lifecycle is mandatory**, not nice-to-have. Channel-rename especially is an RLS-leak vector (renamed-into-`#exec` follows the id silently). | B (event types), C (lifecycle table), G (D3, Top #3) |
| **CF10** | **E (AskEffi-Slack on team tenant) collapses into C.** Team is a customer at the integration boundary; no separate code path. The genuinely team-flavored want (Gin-mediated R/W) is D. | E (Top — entire angle), D (CLI shape), F (D and C are different products, not A/B) |

---

## Divergent points (real dilemmas — angles disagree or frame differently)

These need a Lean from synthesis or a call from Lihu. Promoted to `recommendation.md` where they need Lihu input; resolved here where the disagreement is shallow.

### DV1 — Unified.to vs Slack-direct, framed as a path not a one-shot
- **A** says Unified is paved-road for ~70% of customer ingestion (~1.5–2.5 wk to MVP); messaging connector is real; webhook seam already exists.
- **F** says Unified is **viable for customer surface C only**, **not viable for D**: connector is `Channel(list,get) | Message(CRUD) | Employee | Passthrough`, no reactions, no files, no Block-Kit, no slash commands, polling-shaped not push-shaped for messages. Migration cost grows monotonically with customer count.
- **G** says Unified sidesteps token-storage risk (B4) — a real value, not just convenience.
- **B, D, H** all assume direct.
- **Resolution:** **ESCAPE pattern, not HEDGE.** Unified-mediated for C as a v0 scaffold ONLY IF the calendar pressure justifies it; direct Slack for D unconditionally; migrate C onto direct once D is proven. **Or skip the Unified scaffold entirely** if Marketplace timeline aligns. → Becomes recommendation R1.

### DV2 — Read-only or bidirectional in customer Slack?
- **C (D1)** leans read-only at MVP, defer bidirectional to angle D (UseGin-Slack) first then graduate.
- **E (Dilemma 1)** lifts the same question and leans option C: read-only for customers; team gets bidirectional via Gin (D), not via the Effi connector.
- **No angle disagrees** — convergence is "read-only at MVP." → Becomes recommendation R2.

### DV3 — 1:1 channel↔project, or N:1?
- **C (D2)** leans strict 1:1 for MVP, fast-follow N:1.
- **E (Dilemma 2)** leans N:1 immediately because the team's own usage spans ≥3 channels per project, and that pattern likely generalizes.
- **G** flags N:1 as a cardinality cleanup that affects RLS; cheap if designed in, expensive to retrofit.
- **Resolution:** **schema is N:1 from day one** (drop the project_id unique index from C's sketch); UX defaults to one channel per project at MVP; surfaces "add channel" once a customer asks. Cheap to ship; matches E's team usage; preserves C's clean MVP UX. → Becomes recommendation R3.

### DV4 — Marketplace timing
- **B** leans "ship unlisted for pilot + Marketplace track in parallel from day one."
- **F (D1)** leans "submit once direct-Slack ships and is validated on D for ~1 month."
- **G (D1)** leans "events-first MVP that doesn't promise history; Marketplace required for GA."
- **Resolution:** Marketplace track starts the day we have a stable direct-Slack OAuth flow on D (internal). Pilot customers can use unlisted-distributed for events-only ingestion (no historical search promise). → Becomes recommendation R4.

### DV5 — Bolt SDK choice (Python vs TS)
- **B** leans Bolt-Python (sync workers live there, FastAPI adapter is mature).
- **F (D2)** leans Bolt-TS (OAuth callback already in Next.js, type-share with frontend).
- **D** is CLI-only, sidesteps the question.
- **Resolution:** **Bolt-Python in `python-services/`** for receive (signing-secret middleware, OAuth installation store) + raw `slack_sdk.AsyncWebClient` from sync workers. Why: ingestion is Python-shaped (Drive/Fathom/SharePoint precedent); Next.js handles OAuth callback + webhook-proxy ONLY (matching `webhooks/unified`). F's "OAuth callback in Next.js" requirement is preserved without putting Bolt there. → Becomes recommendation R5.

### DV6 — Pull-only vs Events-API receiver for UseGin-Slack
- **D (D2)** leans pull-only (`dx slack inbox` polls on Gin invocation), upgrade to a small Events receiver only if `@usegin` mention staleness becomes painful.
- No other angle covers this surface. → No Lihu call needed; ship pull-only first.

---

## Biggest surprises this round produced

1. **E disappears as a separate build.** All five candidate distinctions (tenant, scope, RLS, write-back, auth) collapse on inspection. The team uses C the same way customers do; the genuinely team-flavored want is Gin-mediated R/W, which is D. **One less artifact, one fewer migration in flight.**
2. **Marketplace is critical-path because of May-2025 ToS, not just ergonomics.** The 1-req/min cap is a backfill killer, not a nuisance. This wasn't on the table when the round started; it dominates the architecture.
3. **Channel-rename is an RLS-leak vector**, not a UX bug. A bound channel renamed `#hr-only` → `#general-temp` keeps its id and silently re-points the indexing target. Strict-break-on-rename is the safe default, even at UX cost.
4. **Unified.to is genuinely two different products vs direct Slack**, not the same product through two pipes. They share zero auth/webhook/normalization code. "Build twice" is real if we go that route — there is no shared layer below `data_items`.
5. **Token-storage risk is a real Unified.to value, not just convenience.** G's B4 makes the case: storing `xoxb-*` plaintext is the easy mistake; Unified holds tokens for us. This raises Unified's stock for surface C even when we know we'll migrate later.
6. **Slack Connect / shared channels** introduce foreign-workspace user IDs that won't resolve via our local token. Stub-user model needed in C's data shape, not "fail to lookup." H surfaced this; not yet wired into C's schema sketch.
7. **`UseGin-Slack` is a separate Slack app from customer-facing AskEffi-Slack** (different `app_id`, different scope surface, different review track). H's call; means two app_ids in env from day one.

---

## Per-surface recommendation

| Surface | Path | Reasoning |
|---|---|---|
| **Customer C** (channel ↔ project ingestion) | **Direct Slack via Bolt-Python** at the destination. **Optionally** Unified-mediated v0 if customer-pilot calendar pressure forces it; migrate to direct before scale. | Unified covers ~70% of read-only ingestion shape and sidesteps token-storage risk, but ceiling is hard (no reactions/files/Block-Kit) and lock-in cost grows with customer count (F). Marketplace listing is required either way; once we own the auth surface we can pursue it. |
| **UseGin-Slack D** (Gin-mediated team R/W) | **Direct Slack, separate app from AskEffi-Slack.** CLI-shape (`dx slack send/read/inbox`) mirroring `plan`. Pull-only baseline; Events receiver only if mention-latency hurts. | Unified's connector cannot deliver D's surface (no slash commands, no Block-Kit). This is the surface that forces direct-Slack work. Build D first; let direct-Slack mature on internal blast radius before customer surface migrates onto it. |
| **AskEffi-Slack on team tenant E** | **Does not exist as a separate build.** Team installs C on its own tenant (dogfood); team uses D for Gin-mediated coordination. | E collapses (whiteboard E, Top — entire angle). |

**Default sequence:** D first (zero customer blast radius, validates direct-Slack stack) → C on direct (Marketplace track in parallel from D's start) → optionally a Unified-mediated C v0 in parallel only if customer #1 is signed and waiting.

---

## Pointers (don't re-read unless drilling in)

- Cliffs and rate-limit math: G Top #1
- OAuth flow + scope inventory + Bolt shape: B
- DB schema sketches: C (slack_connections, slack_channel_bindings, slack_messages), H (slack_installs)
- Lifecycle table (rename / archive / revoke / edit / delete): C
- ESCAPE-vs-HEDGE reasoning + cost-per-call math: F
- E-collapses argument: E (entire whiteboard)
- Cross-workspace user identity (Slack Connect): H Open end
- Risk catalog (12 platform + 9 integration + 7 ops items): G

## Friction zettels captured this synthesis

None this turn. The whiteboards converged cleanly; the divergence points were real product/calendar dilemmas, not platform surprises. The seven listed under "Biggest surprises" are findings, not friction. If implementation surfaces friction (most likely: Slack Connect external-user resolution, or Marketplace-review surprise rejection), capture then.
