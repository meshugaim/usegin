---
topic: compliance
moc: product
updated: 2026-05-08
conflict_pending: false
---

# Security & compliance posture

What AskEffi documents externally vs. what's actually in place. For per-integration OAuth + access-control mechanics, see [data-sources](data-sources.md). For the underlying stack + subprocessor table, see [tech-stack](tech-stack.md).

## Current — as of 2026-05-08

### Certifications held by AskEffi (the company)

**None.** No SOC 2, ISO 27001, or other certification of AskEffi's own. SOC 2 Type II is **planned** but the formal process has not started.

- Guy → Celigo 2026-03-25: *"As an early-stage company, we have not started the SOC 2 process yet but I can offer documentation of our security posture."* — gmail:cb245a82.
- **Chosen provider when needed:** **Scytale** (Sahar Haluzy). Quote: $13,668 all-in ($4,418 platform + $2,960 compliance expert + $2,590 black-box pentest + $3,700 audit). 6-month timeline, ~35 hours effort. — gmail:f7717a37 (2026-01-13).
- **Decision:** *"Delay engagement until SOC 2 becomes a deal-gating requirement."* — gmail:4ef9dccd (Audivant meeting summary).
- **Explicit deprioritization 2026-04-early:** *"The focus is now on unblocking usage, not on SOC 2."* — gmail:d3626bed.
- Security-posture doc says: *"We are continuing to invest in security and compliance, including logging, lifecycle management, and formal policy frameworks, as we move toward SOC 2 certification."* — attachment:cae9d296 (v1.1, 2026-04-07).

### Encryption

| | |
|---|---|
| **In transit** | TLS on all external connections. Internal service-to-service uses Railway's private network (not public internet). |
| **At rest** | AES-256 via cloud-provider defaults (Supabase on AWS, Google Cloud, Railway). **AskEffi does not manage its own key material**; relies on provider defaults. — attachment:cae9d296, attachment:9f172ae8 |

### Tenant isolation — how project boundaries are enforced

**Primary mechanism: RLS on Supabase.** Applied on **68 of 69 user-data tables**. The 1-table exception is **not identified anywhere in indexed data** — see Gap G-2.

- CI enforces RLS coverage on every code change (`pg_tap`); regressions blocked.
- 600+-line database hardening test suite validates access-control boundaries.
- ESLint rules prevent accidental authenticated-route exposure.
- *"Removing a user from a workspace immediately revokes data access at the database level via RLS. Cascading foreign keys ensure complete cleanup on user deletion."* — attachment:cae9d296.
- 57 SECURITY DEFINER functions have search_path explicitly pinned (privilege-escalation vector closed week 2026-04-04→10) — attachment:b897a1d6.
- `claim_*` RPCs (used by scheduled-report worker to reserve runs) locked to `service_role` only — attachment:80d51643.

**Architectural caveat (recorded 2026-05-02→05-08):** *"RLS alone is not sufficient as Effi's access gate. Tools (data_browse, VAIS, future canon tools) layer additional filters on top of RLS — RLS is the floor (it has to allow curator UIs to read excluded rows), tools are the ceiling. This is now the documented mental model for new canon tools."* — attachment:80d51643. linear:ENG-5764. **This caveat does not appear in the external-facing posture document.**

**Internal vs. external agent isolation:** Each project has strictly separate internal + external agents. The external agent **does not receive internal content** — architecturally excluded, not merely filtered. Guy → IAS prospect 2026-01-21: *"Their agent does not have access to the internal stuff. You cannot jailbreak into getting information you're not supposed to."* — fathom:a793fb74. Joshua Mindel meeting same day: *"It's not that they cannot jailbreak. Their agent does not have access to the internal stuff."* — fathom:21a3b1ea.

**Session management:** ES256 JWT tokens via JWKS. Access tokens ~1 hour; refresh tokens ~30 days. Passwordless OTP via Supabase Auth. Pre-invited users only — no self-registration.

### Data handling

- **AskEffi is a Data Processor** (not Controller) for customer content. Guy → Phil Lau 2026-04-09: *"We do not train models on your data, nor do we allow others to do so. We are a Data Processor for your content."* — gmail:5eebb3ef.
- **No bulk export endpoints.** API responses capped at 1,000 rows. — attachment:cae9d296.
- **File size limits:** uploads capped at 25 MB; downloads via time-limited signed URLs (1 hr expiry).
- **Deidentified data clause (DPA §1.7):** AskEffi may process deidentified data to improve the product, with commitments to keep it deidentified. — attachment:d767b748.
- **Data deletion:** at customer request, AskEffi will delete all Customer Personal Data after agreement termination; certification of deletion provided on written request.
- **Drive OAuth:** AskEffi never possesses or stores Google OAuth tokens — managed by Unified.to. Drive scope is `drive.readonly` (minimal).

### DPA — current version

**Current: `AskEffi DPA (04.10.2026).pdf`** — attachment:d767b748 (sent with v1.1 security posture to Celigo + Phil Lau on 2026-04-10).

| Provision | Detail |
|---|---|
| Data-protection laws covered | GDPR, UK GDPR, Swiss FADP, CCPA, Colorado Privacy Act, Connecticut PDPOM, Virginia CDPA, Utah CPA |
| International transfers | SCCs (Module 2 — Controller→Processor), governed by Irish law, disputes in Irish courts. UK IDTA included |
| New-subprocessor notice | AskEffi must notify Customer **at least 15 days** before engaging a new subprocessor. Customer has **10 days** to object |
| Customer audit rights | Reports first (SOC 2 Type II, ISO 27001, PCI DSS Level 1 or equivalent). On-site audits require 30 days notice; conducted by *"a nationally recognized independent auditor"* |
| Liability | Subject to Agreement's limitation of liability |

### Subprocessor list (v1.1, 2026-04-07)

Lives in [tech-stack](tech-stack.md). Summary:
- 8 of 9 subprocessors hold **SOC 2 Type II** (Supabase / Railway / Anthropic / Sentry / Resend / Mailgun / Cloudflare / *Google* with ISO 27001 + SOC 2/3).
- **Unified.to is the exception** — listed as *"Security assessment on file"*. No detail on the assessment in indexed data. Unified touches Drive OAuth tokens (the most sensitive integration), Linear, Fathom. See Gap G-3.

### Active known-issue list (2026-05-08)

| Item | Status |
|---|---|
| Drive OAuth on shared Unified.to credentials (Unified itself flagged as not production-supported) | In-progress migration to AskEffi-owned GCP client (started week 2026-05-02; in backlog) |
| RLS not sufficient as sole gate — tools-layer required on top | Architectural finding documented (linear:ENG-5764); mental model codified; no code change required |
| 1 of 69 tables lacks RLS coverage | **Status unknown** — not identified in indexed data |
| Drive `drive.readonly` scope pending Google verification | Blocked by OAuth-client migration above |

- Source for whole picture: attachment:cae9d296 (Security Posture v1.1, 2026-04-07), attachment:c1670611 (same posture doc), attachment:9f172ae8 (Security Posture v1.0, 2026-03-30), attachment:be78979e + attachment:d767b748 (DPA v1.0 2026-03-30 + v1.1 2026-04-10), attachment:80d51643 / 223abc60 / 0f530be9 / b897a1d6 (production-week reports 2026-04-04 → 2026-05-08), gmail:cb245a82 (Guy → Celigo on SOC 2 status), gmail:f7717a37 (Scytale quote), gmail:4ef9dccd (Audivant meeting summary), gmail:d3626bed (SOC 2 deprioritization), fathom:a793fb74 (IAS demo Jan 2026), gmail:b586dc46 (DreamLabs internal-collaborator security bug Jan 2026).
- Last verified: 2026-05-08

---

## History

```
2025-10-27 — AskEffi commits to provide security review measures to Laudio (Vishal's team) as part of design partnership onboarding. Review with "Sri" (engineering/security lead). Explicit approval required even for manual uploads. — gmail:bfcf3232
2025-12-16 — Laudio meeting summary documents the system as "currently over-permissive — plans to add granular access controls later." — gmail:f290bf66
2026-01-12 — Feature prioritization. Chris Baum raises concern: new workspace members default "internal." Guy: "warning people about you're adding an internal who is different email domain… be careful, you may be doing something really bad here." — fathom:9f065943
2026-01-13 — Scytale (Sahar Haluzy) sends SOC 2 proposal: $13,668 all-in, 6-month timeline. Guy replies same day: "Overall we would like to lean in. Will it be possible to chat with one or two customers who are roughly in a similar stage as we are?" — gmail:f7717a37
2026-01-16 — DreamLabs onboarding meeting (Tomas Riegos). Tomas onboarded via magic link, **incorrectly added as "internal" collaborator → exposed private files + user lists**. Logged "critical security flaw." Action: Oria to fix. — gmail:b586dc46 / 64eb7f5a / 55aca6b3
2026-01-21 — IAS demo (Robert Janecek + Aakash Relan + Liz Schiff + Courtney). Robert raises cross-company security questions; Guy explains internal/external separation + magic-link controls. Aakash on project-level doc access: "That's a feature bug." — fathom:a793fb74
2026-01-21 — Joshua Mindel meeting. Internal-files-different-agent architecture clarified. — fathom:21a3b1ea
2026-01-30 — ConstellationGRC (Michael Skiles) cold-emails offering $3,000 fixed SOC 2 audit. — gmail:2bf4c143
2026-02-01 — Guy → ConstellationGRC: "We are good for now, thanks." — gmail:2b659e86
~Dec 2025–Jan 2026 — Audivant (Omer Khalid) SOC 2 meeting. Decision: "Delay engagement until SOC 2 becomes a deal-gating requirement." Scytale confirmed as chosen provider when needed. — gmail:4ef9dccd
~Dec 2025–Jan 2026 — Seitel demo (Sahar) for SOC 2 Type II journey. 4-6 months timeline. — gmail:4f6dc3d5
2026-03-17 — **Celigo (Gowtham M R, Senior Security Risk & Compliance Analyst) initiates formal vendor security review.** Requests SOC 2 + ISO 27001 + DPA + pen-test report + other docs. — gmail:c9590bc7
2026-03-23 — Guy initially missed Celigo request; Priyank follows up; Guy acknowledges. — gmail:457b7b43 / d83862c6
2026-03-25 — Guy → Celigo: "We have not started the SOC 2 process yet but I can offer documentation of our security posture." Commits to deliver DPA + posture by EOD Mon 2026-03-30. — gmail:cb245a82
2026-03-30 — **First DPA (`AskEffi DPA (03.30.2026).pdf`) + Security Posture v1.0 created and sent to Celigo.** v1.0 contains the *"pilot baseline"* clause: *"The controls described in this section define the security baseline required for pilot deployment. AskEffi will only initiate a pilot once these controls are in place."* — attachment:9f172ae8 / be78979e via gmail:80f4d12c
2026-04-01 — Guy sends v1.0 + DPA to Elsante (Mkenga/Hudson). Cover note: "we are still implementing a few measures from the doc. We will make closing these measures a condition for starting any engagement because we take security seriously." — gmail:81ff0aba / 05b319e6
~Early April — **SOC 2 deprioritized in favour of email/folder integrations.** *"The focus is now on unblocking usage, not on SOC 2."* — gmail:d3626bed
2026-04-04→10 — **Major security-hardening week.** CVE upgrades; search_path pinned on 57 SECURITY DEFINER functions; new Permissions-Policy header; invite-flow redirect parameter validates against open-redirect attacks; strict env-var validation re-enabled; Microsoft Graph webhook signed-client-state-token verification; **security audit step blocking in CI**; lint rule requiring DB writes to read-back the row (silent RLS-deny fails loudly); RLS policies on email tables closed a gap; 5 write paths gain explicit row validation; Drive + meeting-connection RLS updated for role-based access. **Subprocessors list becomes a versioned legal document.** — attachment:b897a1d6
2026-04-07 — Guy sends **Security Posture v1.1** to Celigo. Three documented changes from v1.0: (1) **pilot-conditioning clause REMOVED** — Guy: *"Those were not fulfilled so I removed that callout"*; (2) Cloudflare added as subprocessor (*"our audit revealed another sub processor"*); (3) Unified.to integrations changed from specific names to *"etc."*. v1.1 dated *"April 4nd, 2026"* [sic]. — gmail:27d04ccb / attachment:cae9d296
2026-04-08 — Elsante forwards v1.0 posture + DPA to Darren Bonnell (Hudson, dbonnell@hudsontech.com) for approval. Elsante: *"AskEffi is solidly secure. Indeed, its AI capability does not train on any data the tool is fed."* — attachment:9f172ae8 (forwarded) / gmail:2b4e9949 / c7aaa64a
2026-04-10 — **Updated DPA (`AskEffi DPA (04.10.2026).pdf`)** sent alongside v1.1 posture to Phil Lau. — attachment:d767b748 / gmail:5eebb3ef
2026-04-13 — Guy follows up with Celigo. **No response indexed.** — gmail:bb6eb4f2
2026-04-18→24 — RLS tests tightened around cross-workspace auth. OTP verify error classification improved in Sentry (expired vs. wrong-code). Org model removal (workspace-scoped ownership). — attachment:0f530be9
2026-04-25→05-01 — **Drive RLS schema change:** `is_external` (boolean) → `access_level` (TEXT NOT NULL CHECK) on drive_files / drive_folder_scopes / email_attachments. RLS migrated to shared `user_can_see_at_access_level()` helper. New lint rule `checkPolicyHelperUsage` blocks hand-rolled access-level patterns. **Effi-tool-surface lockdown FIXED:** chat agent had been using `allowed_tools` alone (a pre-approval list, not a whitelist), so Claude Code harness tools (Cron* / RemoteTrigger / EnterWorktree / ScheduleWakeup / ToolSearch) were technically reachable from production. Fixed via `tools=[]` + `permission_mode="dontAsk"` across all 4 runners. Integration test asserts no harness substrings in tool list. **Scheduled-report RLS silent-deny FIXED:** Supabase SDK listener was overwriting Authorization header → silent RLS deny on every status update. Fixed by minting user session against throwaway client. — attachment:223abc60
2026-05-02→05-08 — `claim_*` RPCs locked to service_role. **Architecture finding recorded:** RLS = floor; tools = ceiling (linear:ENG-5764). Drive OAuth migration started (Unified shared → AskEffi-owned GCP credentials). Anchored-fetch DB path hardened: single SECURITY DEFINER RPC (`fetch_anchored_run`) + tight membership gate; factory binds run_id at chat creation. — attachment:80d51643
```

---

## Conflicts to flag

**1 — v1.0 security-posture pilot-condition vs. v1.1 removal.** v1.0 (attachment:9f172ae8): *"The controls described in this section define the security baseline required for pilot deployment. AskEffi will only initiate a pilot once these controls are in place."* v1.1 (attachment:cae9d296): clause **absent**. Guy's email explaining the change: *"Those were not fulfilled so I removed that callout"* — gmail:27d04ccb. Customers who received v1.0 (notably Hudson via Elsante 2026-04-01) were given a document claiming controls were a prerequisite; those controls were not in place at distribution and acknowledged still incomplete 2026-04-07.

**2 — Pitch language vs. actual SOC 2 status.** Investor deck (attachment:e7da01c3) + posture doc describe infrastructure built on SOC 2-certified providers without explicitly clarifying that **AskEffi itself has no SOC 2 certification**. Posture-doc Section 1.2 lists *"Application hosting: Railway (on GCP/AWS) — SOC 2 Type II"* etc. — these are the **subprocessors'** certs, not AskEffi's. Posture-doc Section 2 admits: *"as we move toward SOC 2 certification."* A reader focused on the infrastructure table could reasonably infer AskEffi operates in a SOC 2 environment. **Subprocessor cert-layering can obscure the absence of AskEffi's own audit.**

**3 — *"Internally over-permissive"* vs. RLS-completeness claims.** Laudio meeting notes (~late 2025): *"Currently over-permissive — plans to add granular access controls later."* Posture v1.1 claims RLS on 68/69, CI-enforced, 600+-line test suite. Laudio note may reflect an earlier state; posture reflects March/April 2026 work. **However the May 2-8 architectural finding** (*"RLS alone is not sufficient"*) suggests ongoing nuance in the access model that doesn't appear in the external-facing posture doc.

**4 — v1.0 DPA subprocessor list vs. v1.1 posture.** Guy's 2026-04-07 email states **Cloudflare was discovered as a missing subprocessor** during internal audit and added to v1.1. **Means the v1 DPA sent to Celigo (2026-03-30) and Hudson via Elsante (2026-04-01) had an incomplete subprocessor list** — Cloudflare missing. The 2026-04-10 DPA presumably corrects but the Attachment-4 content is truncated in indexed data.

**5 — Agent tool-surface: external claims vs. internal bug.** Posture: *"API endpoints are designed to require authenticated access and enforce user-scoped permissions."* IAS demo: *"You cannot jailbreak into getting information you're not supposed to."* But production-week 2026-04-25→05-01 (attachment:223abc60) discloses internally that Claude Code harness tools (Cron* / RemoteTrigger / EnterWorktree / ScheduleWakeup / ToolSearch) **were technically reachable from prod** until that week's fix — the chat agent was using `allowed_tools` (pre-approval list) not a whitelist. Not characterised as exploitable data-exfil (these are session-management tools, not data tools), but represents an undisclosed deviation from the *"fully locked-down"* posture marketed externally.

---

## Gaps

**G-1 — No penetration test conducted.** Celigo specifically requested 2026-03-17. Scytale proposal includes black-box pentest as add-on ($2,590). **No evidence in any indexed document that a pen test has been ordered or completed.** Posture doc makes no claim to one.

**G-2 — The 1-of-69 table without RLS is unidentified.** Security posture: *"68/69 tables have RLS."* The exception is **never named in any indexed document.** Reviewer would need to know which table and why excluded.

**G-3 — Unified.to has no published certification.** *"Security assessment on file"* is a placeholder. No detail on **who conducted the assessment, what scope, when, or outcome.** Unified touches Drive OAuth tokens (most sensitive integration), Linear, Fathom; will expand.

**G-4 — No incident-response plan documented.** DPA §2.3 commits to notify customers *"without undue delay"*. **No SLA (hours/days), no escalation chain, no IR playbook visible.**

**G-5 — Data-retention periods unspecified.** DPA requires deletion on termination but specifies no retention limits during an active relationship. **How long AskEffi retains email / meeting transcripts / file content beyond active use is not stated anywhere.**

**G-6 — Cloudflare scope underspecified.** Subprocessor table lists Cloudflare as *"Bot protection (Turnstile CAPTCHA)"*. Cloudflare is typically also a CDN/proxy that routes all web traffic — potentially with access to request content. Listed purpose may understate.

**G-7 — No formal security-policy documents published.** Roadmap mentions *"process formalization"* + *"formal policy frameworks"*, but **no AUP / Information Security Policy / Access Control Policy / equivalent** in indexed data. Standard SOC 2 prerequisites.

**G-8 — SOC 2 readiness items in v1.0 remain undefined.** v1.0 referenced items needed before a pilot could begin — acknowledged *"not fulfilled"* when v1.1 published. **Specific items + whether they have since been addressed are never stated.**

**G-9 — Hudson + Celigo review outcomes unknown.** Celigo's last indexed response is the initial request (2026-03-17). Guy's last follow-up 2026-04-13. **No acceptance / rejection of the posture document recorded.** Hudson Technologies (Darren Bonnell) received the docs 2026-04-08; **no response recorded.**

**G-10 — No employee-security details.** DPA §1.4 states employees *"subject to appropriate confidentiality obligations"* but **no specifics on background checks / security training cadence / offboarding procedures**. Standard SOC 2 organisational controls.

**G-11 — Laudio security review outcome unknown.** Notes specify review with *"Sri (engineering/security lead)"* as a prerequisite. **No follow-up confirming the review happened or its outcome.**

**G-12 — *"Phased compliance roadmap"* is single-sentence.** Both v1.0 + v1.1 reference a *"Phased Compliance Roadmap"* (Section 2 heading) but contain only: *"We are continuing to invest in security and compliance, including logging, lifecycle management, and formal policy frameworks, as we move toward SOC 2 certification."* **No phases, timelines, or milestones enumerated anywhere.**

---

## See also
- [tech-stack](tech-stack.md) — subprocessor list with certs
- [data-sources](data-sources.md) — per-source OAuth scope, internal/external classification
- [product](product.md) — agent-surface lockdown (STRICT_TOOLS_ALLOWLIST_KWARGS)
- [design-partners](design-partners.md) — DreamLabs internal-collaborator bug context (1/16); Mkenga/Hudson security-doc forward (4/8)
