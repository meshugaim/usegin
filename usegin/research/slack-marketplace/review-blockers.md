# AskEffi-Slack — Known Marketplace Review Blockers

**Linear:** ENG-5414. **Inputs:** Slack Marketplace requirements page
(api.slack.com/slack-marketplace, fetched 2026-04-27), May-2025 ToS
changelog, SYNTHESIS R4 / G's risk catalog, our security posture gaps.

These are issues Slack reviewers historically flag — sorted by likelihood
of hitting us given current state. For each: what triggers it, what our
posture is now, and the planned response. Use this doc as a **canned
response library** when a reviewer pings during Phase 7 of the checklist.

---

## A — Hard blockers (would cause rejection if hit at submission)

### A1 — May-2025 ToS scope-deprecation rate limits

**Trigger:** Submitting an unlisted commercial app that uses
`conversations.history` / `conversations.replies` is now rate-limited to
**1 req/min, 15 msgs/page** (per
https://api.slack.com/changelog/2025-05-29-marketplace-conversations-api-changes).
Existing unlisted-app installs face full enforcement on **2026-03-03**.
Marketplace approval is the only path back to standard rate limits for a
commercial offering.

**Our state:** Direct exposure. SYNTHESIS load-bearing finding. Math: a
6,000-msg channel = ~6.7 hours single-channel backfill at the throttled
rate; a 50-channel workspace = ~14 days.

**Response:** This is exactly why we're submitting now (R4 lean (a)). The
listing **is** the remediation. Until approved, we cap pilot customers at
≤10 workspaces and operate "events-first, bounded backfill" (R5) to stay
under the throttle wall. Internal apps (UseGin-Slack, dogfood) are
unaffected.

### A2 — Socket Mode is forbidden for Marketplace

**Trigger:** Marketplace apps must use the **Events API over HTTPS**.
Socket-Mode-shaped apps (WebSocket-based event delivery) are rejected.

**Our state:** Compliant. SYNTHESIS CF4 + checklist 1.9 explicitly disable
Socket Mode. Ingress is HTTPS Events API via Next.js → Python proxy
(SYNTHESIS CF8).

**Response:** N/A — we don't use Socket Mode. Confirm Phase 1.9 is ☑
before submit.

### A3 — App not installed on ≥5 active workspaces (28-day window)

**Trigger:** Marketplace requires demonstrated production use — ≥5
workspaces installed and active in the past 28 days.

**Our state:** [ORIA] At submission time, will the team's dogfood
workspace + N pilot customers add up to ≥5? If not, this is a hard block.

**Response:** Track install count week-over-week ahead of submission. If
<5 by ~T-7 days, recruit additional pilot installs (consenting customers,
internal tenants on isolated workspaces, Lihu's other Slack-using orgs)
**before** submitting. Submitting <5 is wasted-attempt territory.

### A4 — Privacy policy missing Slack-specific clauses

**Trigger:** Slack reviewers read the privacy policy and reject if it
doesn't enumerate: what Slack data is collected, retention, deletion
procedure, consent for using Slack-obtained email (we don't do this — but
say so explicitly).

**Our state:** Existing privacy policy at `askeffi.ai/privacy` may not
cover Slack as a named data source. Pre-submit blocker P3 in checklist.

**Response:** Legal updates the policy to add a "Slack" section before
submit. Out of ENG-5414 scope per charter; gated by P3.

### A5 — Broken landing page or "Add to Slack" button at review time

**Trigger:** Reviewer clicks the Marketplace listing's primary CTA;
anything other than a clean "Add to Slack" → consent modal → success
redirect = rejection.

**Our state:** ENG-5411 owns the install button UI; landing page
`/integrations/slack` is [ORIA] yet to confirm exists.

**Response:** Phase 5.6 of the checklist verifies this end-to-end. Don't
submit until the smoke test is green.

### A6 — Using Slack data to train LLMs

**Trigger:** Slack explicitly forbids this. Listed as a top reviewer-flag.

**Our state:** Compliant. We use Anthropic + Vertex AI under enterprise
terms that exclude training. Captured in `security-questionnaire.md` §4.

**Response:** Direct quote from §4 of the questionnaire. No risk if the
answer is paraphrased into the form correctly.

---

## B — Soft blockers (would trigger reviewer back-and-forth, not auto-reject)

### B1 — Vulnerability management gap

**Trigger:** Slack questionnaire includes incident response + vulnerability
management. Audit-DPA Commitment 4 was rated **Non-Compliant** as of
2026-03-29 (no automated dep scanning, SAST, patch management).

**Our state:** Phase 3 hardening (`2026-04-02-phase3-hardening-implementation-report.md`)
landed some controls; current state needs a Lihu lookup (P7).

**Response template:**
> "We are actively closing this gap. Dependency scanning via [TOOL] and
> [PROCESS] are scheduled for [DATE] in Linear ticket [ENG-XXXX]. The
> existing controls — Sentry-based runtime monitoring, RLS-CI gating,
> Claude code review with security as an explicit criterion — provide
> defense-in-depth in the meantime."

[ORIA] fill in [TOOL]/[PROCESS]/[DATE]/[ENG-XXXX] before sending.

### B2 — No SOC 2 certification

**Trigger:** Some reviewers ask. The Marketplace docs do not require it
explicitly, but it shows up in security questions.

**Our state:** Not certified. On the roadmap (external posture §2). All
**subprocessors** that handle data are SOC 2 Type II / ISO 27001
certified.

**Response:** "AskEffi itself is not yet SOC 2 certified; certification
is on our published roadmap. All subprocessors handling personal data
(Supabase, Railway, Anthropic, Google Cloud, Sentry) are SOC 2 Type II
or ISO 27001 certified. We follow SOC-2-aligned engineering practices
(RLS-CI, CSRF-hardened OAuth, encrypted-at-rest tokens, scrubbed
telemetry)."

### B3 — No formal incident response runbook

**Trigger:** Audit-DPA Commitment 1 flagged as gap. Slack questionnaire §7
asks. Pre-submit blocker P5.

**Our state:** Will be drafted before submit per P5 (~half day Lihu work).

**Response:** Cite the new runbook once written.

### B4 — Token-storage practices (encryption at rest)

**Trigger:** Slack reviewers care a lot about how OAuth tokens are stored.

**Our state:** ENG-5410 ships the encryption helper before C ships per
`token-encryption/recommendation.md`. Pre-submit blocker P1.

**Response:** Once P1 is done, the answer in `security-questionnaire.md`
§1 is a clean direct response. Do not submit while raw-token rows exist.

### B5 — Privacy policy lacks deletion-procedure language

**Trigger:** Slack requires either generalized deletion language or
GDPR/CCPA-specific language; either is OK, neither is not.

**Our state:** Same as A4; gated by P3. Ensure `askeffi.ai/privacy`
includes a "Right to deletion" or equivalent section.

**Response:** Once P3 is done, no friction here.

### B6 — Optional scopes containing core functionality

**Trigger:** Slack rule: optional scopes must not contain core
functionality. (We don't use optional scopes, but reviewers sometimes
ask.)

**Our state:** Compliant. All 6 scopes are required-at-install, none
optional.

**Response:** N/A.

### B7 — Reactions, files, threads-as-bulk-export pattern

**Trigger:** Slack flags apps that look like they're bulk-exporting
message data ("export/backup of message data" is a top reviewer-flag).

**Our state:** Borderline. We index messages into our search system —
which **is** a copy of the message content for retrieval. Slack's bar is
about **user-facing export** functionality (give-me-a-CSV-of-this-channel),
which we don't have. We don't expose any "export" UI.

**Response:** "AskEffi indexes message content for AI-powered retrieval
and grounding. We do not expose any bulk-export, download, or backup
functionality to end users. Customers can ask Effi questions and receive
answers with citations; they cannot dump raw messages out of AskEffi."
Frame proactively if reviewer asks.

### B8 — Replicating Slack client UI

**Trigger:** Apps that re-implement Slack's own UI inside their product
get flagged.

**Our state:** Compliant. Effi's UI is conversational Q&A with citation
links; clicking a citation deep-links **into Slack** (via `slack_link`
URLs), not into a re-implemented Slack viewer.

**Response:** "Citations link directly to the original Slack message via
`slack.com/archives/...` URLs. We do not render Slack message threads
inside our UI."

### B9 — Channel-rename / archive lifecycle

**Trigger:** Reviewers occasionally probe lifecycle handling, especially
for security-relevant events (renamed channels, revoked tokens).

**Our state:** SYNTHESIS CF9 explicitly mandates lifecycle handlers; C's
schema sketch includes the table. Channel-rename is treated as a
**strict-break** (RLS-leak vector per CF9): renamed channel is unbound
until admin re-confirms.

**Response:** "We handle `channel_rename`, `channel_archive`,
`tokens_revoked`, `app_uninstalled`, and `channel_deleted` events. Renames
are treated conservatively: a renamed channel is automatically unbound
from its AskEffi project and the admin must re-confirm — this prevents a
renamed-into-`#exec` follow-the-id leak vector."

### B10 — Not-yet-tested / private-beta state

**Trigger:** Slack rejects private-beta or untested submissions.

**Our state:** [ORIA] At submission, are we in pilot? The pilot
counts as "tested" if there's real install activity (≥5 workspaces, A3).

**Response:** Frame as "production-pilot" not "beta" in any narrative.
The product is real, the integration works, the listing is the gate to
broader distribution.

### B11 — Broken support contact

**Trigger:** Marketplace requires reachable support email or webform.
Bouncing emails fail review immediately.

**Our state:** Pre-submit blocker P6 confirms `support@askeffi.ai` is
monitored.

**Response:** N/A once P6 ☑.

---

## C — Edge cases / unlikely but worth knowing

### C1 — Slack Connect / shared-channels external-user data

**Trigger:** If a bound channel is shared with an external workspace,
foreign user IDs (`U…`) won't resolve via our local token. Reviewer might
probe how we handle this.

**Our state:** Per SYNTHESIS surprise #6, we represent external users as
opaque IDs without cross-workspace profile lookup. Schema needs a stub-user
representation; H surfaced this but C's schema sketch hasn't fully wired
it (an integration-time gap, not a submission-time gap).

**Response:** "Shared-channel messages are indexed normally; the
authoring user is represented by their Slack ID, with display-name lookup
falling back to the ID when the user is from a different workspace. We do
not attempt cross-workspace profile resolution."

### C2 — Enterprise Grid org-wide install

**Trigger:** Some Enterprise Grid customers install at the org level
(`enterprise_id`) rather than per-team. Reviewer may probe.

**Our state:** Schema includes `slack_enterprise_id` (per C1's callback,
line 251); we accept the field but don't yet have a UX for org-wide
multi-team binding. This is "v1 vs v2" target per H D1.

**Response:** "The schema accepts Enterprise Grid `enterprise_id` and
records it on install. Per-team channel binding is the v1 surface;
org-wide bulk-bind UX is a v2 enhancement."

### C3 — Reverse-direction lock (one Slack workspace → two AskEffi tenants)

**Trigger:** Reviewer asks how we prevent a Slack workspace's data from
appearing in two unrelated AskEffi customer tenants.

**Our state:** Compliant by design. Unique constraint on `(slack_team_id,
slack_app_id, slack_enterprise_id)` enforces single-tenant binding;
attempted second bind returns
`?slack=error&reason=already_bound` to the user
(`nextjs-app/app/api/slack/callback/route.ts:264-275`). SYNTHESIS CF7.

**Response:** "Database-level unique constraint prevents the same Slack
workspace from being bound to multiple AskEffi tenants. A second bind
attempt is rejected and the admin sees an `already_bound` error."

### C4 — Impersonation / posting-as-user

**Trigger:** Slack flags apps that send messages "as" the user via
`xoxp-` tokens.

**Our state:** Compliant. We use bot tokens (`xoxb-`) only at MVP. No
user tokens. Read-only at MVP per R2.

**Response:** N/A.

### C5 — Self-destructing messages, bulk delete

**Trigger:** Slack rejects apps with destructive behaviors.

**Our state:** Compliant. Read-only.

**Response:** N/A.

### C6 — Cryptocurrency, NFT, financial transactions

**Trigger:** Auto-rejected categories.

**Our state:** N/A.

**Response:** N/A.

---

## What to do when a blocker fires during review

1. Capture the reviewer's exact wording in an ENG-5414 sub-issue.
2. Find the matching response template above.
3. If `[ORIA]` placeholders exist in the template, fill them.
4. If no template fits, **don't fabricate** — surface the question to Gin
   for research before responding.
5. Update this doc append-only with whatever new blocker class we
   encountered, so the next submission cycle starts richer.
