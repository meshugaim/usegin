# AskEffi-Slack — Marketplace Security Questionnaire (draft)

**Linear:** ENG-5414. **Source of truth for every answer below:**
`docs/security/reports/`. Where the existing posture has a known gap, the
answer says so honestly and links to the gap. **Nothing in this doc is
fabricated** — when an answer is genuinely unknown to the author, it's
flagged `[LIHU UNKNOWN]` for Lihu to fill before submitting.

Slack's questionnaire fields evolve; this doc covers the topic universe per
the Marketplace requirements page (fetched 2026-04-27): OAuth handling, TLS,
request authentication, AI/LLM disclosure, retention, tenancy, incident
response, plus standard reviewer follow-ups (data export, deletion, breach
notification, subprocessors).

---

## 1. OAuth token storage and handling

**Q: How are OAuth tokens stored?**

Slack bot tokens (`xoxb-`) are stored in Postgres column
`slack_installs.bot_token_encrypted` (Supabase). Per ENG-5410's recommendation
(`usegin/research/token-encryption/recommendation.md`), the column is
encrypted at rest using AES-256-GCM with a per-row random nonce; the data
encryption key (DEK) is held in Railway sealed environment variables, never
committed to source, never logged. Supabase additionally encrypts the
underlying disk via cloud-provider defaults
(`docs/security/reports/2026-04-02-internal-security-posture-post-hardening.md`
§Encryption).

> **Honest gap (active remediation):** Token encryption helper is being
> rolled out in ENG-5410. Until that ships, tokens written by the C1 callback
> are stored as raw text in the `_encrypted` column (see header comment on
> `nextjs-app/app/api/slack/callback/route.ts`). All tokens written before
> the helper lands are backfilled in the same slice. Submission to Slack
> Marketplace is gated on this remediation completing. Tracked: ENG-5410.

**Q: Are tokens ever exposed client-side?**

No. Tokens never leave the server. The OAuth callback
(`nextjs-app/app/api/slack/callback/route.ts`) executes server-side; the
`oauth.v2.access` exchange happens server-to-server. Bot-token-using calls
happen from `python-services/` over Railway's private network. Sentry has
`beforeSendScrubAuth` to strip Authorization headers from any error reports
(post-hardening §2).

**Q: Token revocation handling?**

We handle Slack's `app_uninstalled` and `tokens_revoked` events:
when received, we set `slack_installs.status = 'error'`, stop the sync
worker for that install, and queue deletion of indexed messages. This
matches the existing `AuthRevokedException` pattern used for Drive / Fathom
/ Linear (post-hardening §1, "AuthRevokedException Implemented").

**Q: Token refresh?**

Not applicable to Slack bot tokens — `xoxb-` tokens do not expire and have
no refresh flow. (Slack rotated-token model is opt-in; we are not opted in
at MVP.)

---

## 2. TLS / encryption in transit

**Q: TLS version on inbound and outbound?**

TLS 1.2+ on all external connections. Enforced by Railway's HTTPS edge for
inbound; outbound calls to `slack.com/api/*` use Node's default TLS config
which negotiates TLS 1.2 minimum
(`2026-03-30-external-security-posture-and-roadmap--sent-to-client.md` §1.3,
"TLS on all external connections").

**Q: Internal service-to-service?**

Next.js → Python API runs over Railway's private network. Railway documents
this as encrypted internal transport; we do not currently independently
verify the cipher (post-hardening §Confidence: "infrastructure-level claims
not independently verified"). [LIHU: confirm Railway transport encryption
posture in writing if reviewer pushes.]

---

## 3. Request authentication (Slack Events / webhooks)

**Q: How do you verify Slack-signed requests?**

Slack signing-secret verification per Slack's documented HMAC-SHA256 scheme.
Per SYNTHESIS CF8, ingress lands at Next.js (`/api/slack/events`, shipped
under ENG-5409 — commit `833f0e159`, see
`nextjs-app/app/api/slack/events/route.ts`) which verifies the
`X-Slack-Signature` header against `SLACK_SIGNING_SECRET` and the raw body,
with a 5-minute timestamp window. On verify failure the request is rejected
with 401.

This pattern mirrors `nextjs-app/app/api/webhooks/unified/` and
`nextjs-app/app/api/webhooks/mailgun/inbound/` — both fail-closed on missing
secret (post-hardening §2 "Webhook fail-closed: Implemented"). The Slack
endpoint follows the same shape.

**Q: Verification tokens or signed secrets?**

Signed secrets only. Verification tokens (deprecated by Slack) are not used.

---

## 4. AI / LLM disclosure

**Q: Do you use Slack data with LLMs?**

Yes, scoped per the principle in `2026-04-02-subprocessor-inventory.md`:

- **Anthropic (Claude)** — Slack messages bound to an AskEffi project are
  passed as context to Claude when a user asks Effi a question grounded in
  that channel's content. Claude does not train on this data (per Anthropic
  enterprise terms; see Anthropic listed as SOC 2 Type II subprocessor).
- **Google (Gemini / Vertex AI Search)** — message text is indexed in our
  Vertex AI Search datastore for retrieval grounding. Google does not train
  on enterprise customer data per their Vertex AI terms.

**Q: Is Slack data used to train models?**

No. We do not train any model on Slack data. We do not fine-tune. We pass
data as ephemeral prompt context to enterprise-tier APIs that contractually
exclude training. (This directly addresses the Slack reviewer-flagged
blocker "Using Slack data to train LLMs.")

**Q: Where does AI processing happen?**

Anthropic's API endpoints (US region) and Google Cloud Vertex AI (US
region). Both are listed subprocessors with SOC 2 Type II / ISO 27001
certifications.

---

## 5. Data retention & tenancy

**Q: What Slack data do you store, and for how long?**

| Data | Storage | Retention |
|---|---|---|
| Bot OAuth token | `slack_installs.bot_token_encrypted` | Until disconnect or `tokens_revoked` event, then deleted |
| Workspace metadata (team_id, team_name, app_id) | `slack_installs` | Same |
| Channel-binding mapping | `slack_channel_bindings` (project ↔ channel) | Until admin unbinds or project is deleted |
| Indexed messages | `data_items` + Vertex AI Search datastore | Until disconnect, channel unbind, or admin-initiated deletion |
| Raw event payload (for debugging) | Sentry breadcrumbs only | Sentry's default 30-day retention; PII-scrubbed |

**Q: Tenancy / multi-tenant isolation?**

Strict workspace-level Postgres Row-Level Security on every table. The
`slack_installs` and `slack_channel_bindings` tables use the same
`askeffi_workspace_id` scoping pattern as every other user-data table. CI
enforces RLS coverage on every code change (`db-checks.yml`). 68/69 tables
are RLS-enabled; the one exception is a metadata table with `REVOKE ALL`
(`2026-03-30-external-security-posture-and-roadmap--sent-to-client.md`
§1.2).

**Q: Cross-tenant lock?**

The `slack_installs` schema enforces a unique constraint such that a single
Slack workspace cannot be bound to two different AskEffi tenants
simultaneously. The C1 callback surfaces this as `?slack=error&reason=already_bound`
(see `nextjs-app/app/api/slack/callback/route.ts:264-275`).

---

## 6. Customer data export / deletion

**Q: How does a customer delete their Slack data?**

Three paths, all complete:

1. **Disconnect from AskEffi** — workspace settings → Slack → Disconnect.
   Sets `slack_installs.status = 'pending_deletion'`; the sync worker
   deletes the bot token, all indexed messages from Vertex AI Search, and
   the corresponding `data_items` rows. Mirrors the Drive / Fathom /
   Linear / SharePoint disconnect flows
   (post-hardening §4 "Disconnect flows: Implemented").
2. **Uninstall from Slack** — admin removes app from Slack workspace.
   Slack delivers `app_uninstalled`; we treat it identically to (1).
3. **Delete the AskEffi workspace** — `auth.users` cascade deletes
   workspace + projects + slack_installs + bindings + data_items
   (post-hardening §4).

**Q: Bulk export?**

We do not expose a bulk-export endpoint for Slack data, consistent with our
broader posture: "No bulk data export endpoints exist" (external posture
doc §1.3). Customers can extract individual answers (with citations) via
the AskEffi UI; if a regulatory portability request comes in, the team
processes it manually via the support channel
(`support@askeffi.ai`).

> **Honest gap (Slack-data-specific):**
> `docs/security/reports/2026-04-02-internal-security-posture-post-hardening.md`
> §4 D1 notes that conversation-storage blobs may not be cleaned on user
> deletion in some edge cases. Slack messages are stored in Vertex AI
> Search + the `data_items` table, not in a Storage bucket, so D1 does not
> directly apply to Slack data. We confirm this on a per-integration basis
> when the slice ships.

---

## 7. Incident response

**Q: Do you have an incident response plan?**

Per `2026-03-29-audit-dpa-exhibit-3.md` Commitment 1: a documented incident
response *runbook* is one of the "administrative gaps" in the current
program. Sentry alerting is live across all layers, and the team has an
informal escalation flow (engineering on-call → Lihu), but a formal IR
document is not yet published.

**[ORIA] hole.** A formal IR runbook is tracked as ENG-4241 (Backlog as of
2026-04-28). If Slack reviewer requires a written IR plan for Marketplace
approval, ENG-4241 needs to ship before submission. Recommended scope:
short IR runbook (1–2 pages, ~half-day) that describes detect → triage →
contain → notify steps, named on-call, breach-notification SLAs (see §8).
Captured in `submission-checklist.md` as a pre-submit item.

**Q: Breach-notification SLA?**

Per the customer DPA (Attachment 3): we commit to notifying customers of a
confirmed personal-data breach without undue delay and within the timelines
required by applicable Data Protection Law (e.g., 72 hours under GDPR
Article 33).

**[ORIA] hole.** Confirm the exact SLA wording stated in the live customer
DPA before pasting this answer (likely "without undue delay, and where
feasible no later than 72 hours" — but verify against the executed DPA).

**Q: Have you had a breach?**

No reportable security incidents to date. (If this changes before
submission, update.)

---

## 8. Subprocessors

**Q: Who else processes customer Slack data?**

Per `2026-04-02-subprocessor-inventory.md`:

| Subprocessor | Role for Slack data | Certification |
|---|---|---|
| Supabase | Postgres storage of `slack_installs`, `slack_channel_bindings`, indexed messages metadata | SOC 2 Type II |
| Railway | Application hosting (Next.js + Python services) | SOC 2 Type II |
| Anthropic (Claude) | LLM context for retrieval-grounded Q&A | SOC 2 Type II |
| Google Cloud | Vertex AI Search index, GCS for raw blobs | ISO 27001, SOC 2/3 |
| Sentry | Error monitoring (PII-scrubbed) | SOC 2 Type II |

**Notably absent:** Unified.to. AskEffi-Slack uses **direct** Slack OAuth
(SYNTHESIS R1 lean (a)), not Unified-mediated. Unified.to is in our DPA
for Drive/Fathom/Linear/SharePoint but does **not** process Slack data.

**Q: Any sub-subprocessors specifically for Slack?**

None. The Slack integration adds no new subprocessor to the inventory
(consistent with R1's reasoning for going direct).

---

## 9. Authentication & access control (your platform)

Standard cross-references to the existing posture doc — Slack reviewers
typically read but rarely deeply probe these:

- **Customer auth:** Passwordless OTP via Supabase Auth, ES256 JWT via
  JWKS, ~1h access tokens, ~30d refresh
  (external posture §1.2).
- **Tenant isolation:** Postgres RLS on 68/69 tables, CI-enforced
  (post-hardening §1).
- **Admin actions:** Gated app + DB layer, audit-logged via
  `admin_audit_log` (post-hardening §1, audit-DPA Commitment 1).
- **OAuth callback hardening:** UUID validation, CSRF state with
  `crypto.timingSafeEqual`, RLS-gated workspace access — exact pattern
  from Drive/Fathom/Linear/SharePoint, applied in C1's Slack callback
  (post-hardening §1).

---

## 10. Vulnerability management

Phase-3 hardening (ENG-4217, see
`docs/security/reports/2026-04-02-phase3-hardening-implementation-report.md`)
landed automated scanning in CI:

- **Dependabot** (`.github/dependabot.yml`): weekly scans of npm (root +
  `nextjs-app/`), pip (`python-services/`), and GitHub Actions; grouped PRs
  for related packages (react, supabase, etc.).
- **`bun audit`** in `.github/workflows/security-audit.yml`: runs on every
  push and PR to `main`/`staging`/`production`; **fails CI on
  high/critical** vulnerabilities. Low/moderate transitive dev-dep
  vulnerabilities are temporarily excluded via `--audit-level high`
  (tracked in the workflow's TODO comment to tighten once dev-dep vulns
  are resolved).
- **`pip-audit`** in the same workflow for the Python services tree.

The audit-DPA Commitment 4 ("Non-Compliant" as of 2026-03-29) predates this
hardening; for Slack submission, the honest current state is **automated
scanning in CI, gated at high/critical severity**, with formal patch-SLAs
still informal (humans review Dependabot PRs as they land).

> **[ORIA] hole.** If a Slack reviewer asks for a written patch-management
> SLA (e.g. "critical vulns patched within X days"), we don't have one.
> Either commit a number you can defend or note "informal review-on-arrival,
> formal SLA on roadmap."

---

## 11. Logging & monitoring

- Sentry across Next.js client / server / edge / Python with PII scrubbing
  (`maskAllText`, `beforeSendScrubAuth`, `send_default_pii=False`)
  (post-hardening §5).
- Admin audit log for GFS / VAIS admin actions; **no** dedicated
  security-events table (post-hardening §5 L1 — gap).
- All Slack-related operations (callback success/failure, sync errors)
  emit structured logs and Sentry events.

---

## 12. Compliance certifications

- **SOC 2:** Not yet certified. On the roadmap (external posture §2).
- **GDPR:** AskEffi follows GDPR principles; DPA available
  (`docs/security/reports/2026-03-29-audit-dpa-exhibit-3.md` references
  customer DPA v.01.08.2026).
- **CASA:** Gap analysis exists for Drive integration
  (`2026-03-29-gap-analysis-casa-drive.md`); not extended to Slack yet.
- **ISO 27001 / HIPAA:** Not in scope.

---

## Appendix: items genuinely unknown to this draft (`[LIHU UNKNOWN]` consolidated)

For Lihu's pre-submit pass:

1. **§3** — ✓ resolved 2026-04-28: Events receiver shipped under ENG-5409
   (commit `833f0e159`); answer text updated to cite the shipped file.
   The original question conflated ENG-5415 (inbox, in progress) with
   ENG-5409 (Events receiver + lifecycle handlers, shipped).
2. **§7** — does a written incident response runbook exist now? If no,
   draft one before submitting (half-day).
3. **§7** — exact breach-notification SLA wording from customer DPA.
4. **§10** — ✓ resolved 2026-04-28: dependency scanning IS in place
   (Dependabot weekly + `bun audit` / `pip-audit` gating CI on
   high/critical). Section text rewritten. Remaining `[ORIA]` hole:
   written patch-management SLA — either pick a number or declare
   "informal, on roadmap."
5. **§2** — Railway internal-transport encryption posture (in writing) if
   reviewer asks.
6. **§5 D1 carve-out** — confirm Slack data is NOT in a Storage bucket
   path that's covered by D1's orphan-blob gap.

These are not invitations to invent answers. Each is either a
lookup-against-current-state ((1), (4), (6)) or a genuine pre-submit
artifact ((2), (3), (5)).
