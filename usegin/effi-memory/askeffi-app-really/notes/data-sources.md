---
topic: data-sources
moc: product
updated: 2026-05-08
conflict_pending: false
---

# Data sources & access control

What Effi reads from, how it gets there, and how internal-vs-external scoping works. For LLM/vendors/hosting, see [tech-stack](tech-stack.md). For user-visible product surfaces, see [product](product.md).

## Current — integration matrix (2026-05-08)

| Integration | Status | What's indexed | OAuth / auth | Re-sync model | Internal/External toggle |
|---|---|---|---|---|---|
| **Email** (Mailgun-routed) | 🟢 GA | Full email body + attachments + thread | Mailgun webhook (no user OAuth) | Event-driven (inbound) | ✅ Per-row (table view) |
| **Manual file upload** | 🟢 GA | Full text content (PDF, DOCX, XLSX, PPT/PPTX with allowlist gap) | N/A | N/A (manual) | ✅ At upload time |
| **Google Drive** | 🔴 **Test-users only** (Google OAuth verification + CASA pending) | Full text content | OAuth via Unified.to (`drive.readonly` scope) | Worker delta polling + eager metadata sync | ✅ Per-item |
| **SharePoint** | 🟢 GA (v3 sync pipeline) | Full text content | Microsoft Graph OAuth (scopes not documented) | Worker delta polling | ✅ Per-item (`access_level`) |
| **Fathom** | 🟢 GA | Transcripts only — Effi generates summaries itself | Workspace-level OAuth (one connector per workspace) | Manual sync + 5-min stale-recovery | ⚠️ **Not yet shipped** (deferred — Guy UX feedback item #9) |
| **Linear** | 🟢 Shipped (read-only; primarily internal use) | Tasks/issues — exact scope undocumented | Service-role auth | On-demand | N/A |
| **Slack** | 🟡 OAuth-connect live; **message ingestion NOT shipped** | (planned: messages + attachments, full-history backfill, internal-by-default) | Workspace-level OAuth | Event-driven (Events API) | Internal-by-default (no toggle for v1) |
| **Scheduled Reports runs** | 🟢 GA (week of 2026-05-02) | Delivered runs only (`is_excluded=false`) | First-party | Per-cadence | ✅ `is_excluded` flag |

- Source: attachment:80d51643 (production-week 2026-05-02→05-08), attachment:223abc60 (week 04-25→05-01), attachment:0f530be9 (week 04-18→04-24), attachment:8e0be2b6 (week 04-11→04-17), attachment:b897a1d6 (week 04-04→04-10), attachment:cae9d296 (Security Posture 2026-04-07), attachment:8fb1ae35 (Workspace Model v2), file:2347ede4 (slack-work-status 2026-04-30), drive:5e948cf5 (Data Model Drive doc), fathom:0c6d9496 (Chandra/Guy 2026-04-29), fathom:a793fb74 (AskEffi-IAS 2026-01-21).
- Last verified: 2026-05-08

---

### Per-source detail

#### Email (Mailgun)

- **Address format:** `[workspace-prefix]-[project-name]-[hash]@mail.askeffi.ai`. Earlier `mail.effi.ai` design-doc wording is outdated — see [product](product.md) Conflict C-6.
- **Mechanism:** users CC or forward emails to the project address. Mailgun webhook routes to the right project by address.
- **Allowlist (sender restriction):**
  - When ON: only project members or replies-to-known-threads accepted; others rejected at ingest. — email:9206b79b
  - New projects default OFF; existing projects migrated as ON. — attachment:0f530be9
  - Plus-addressing normalised: `alice+tag@…` matches `alice@…`. — attachment:8e0be2b6
- **Threading:** Message-ID + In-Reply-To headers used for thread reconstruction.
- **Internal/external classification:** per-row toggle in the email browser (shipped GA 2026-04-18→04-24). Bulk toggles available. Forwarded threads are split into segments — *"We parse it and see which part is external versus internal"* — Guy demo to Priyank, fathom:06abead4.
- **Editable email address** since 2026-04-11→04-17 release. — attachment:8e0be2b6
- **Vendor:** Mailgun. SOC 2 compliant. Listed in subprocessors. — email:9206b79b
- **Security measure:** emails deleted from the shared inbox immediately after processing.

#### Google Drive

- **Status:** **Hidden behind hardcoded test-user allowlist.** Drive integration card and Data-tab empty-state CTA hidden for non-test users. Pending Google app verification for `drive.readonly` restricted scope. — attachment:0f530be9
- **OAuth scope:** `drive.readonly` — *"the narrowest scope that supports our folder-sync model. We evaluated and rejected broader scopes."* — attachment:cae9d296.
- **Token handling:** OAuth tokens managed entirely by Unified.to. *"AskEffi never possesses or stores Google OAuth tokens."* — attachment:cae9d296.
- **CASA blocker:** Google requires CASA certification for `drive.readonly` restricted scope. Bypassing via Unified.to's shared credentials is not supported in production (Google ToS violation). — Unified.to email thread (email:26fcefc4 / b5b0dd21 / e7b2da5a).
- **Own-credentials migration started 2026-05-02→05-08:** moving from Unified.to's shared GCP client to AskEffi's own GCP-registered client. *"Unified told us the shared-credentials path is not supported in production."* — attachment:80d51643. Issue still in backlog; no user-visible change yet.
- **Sync pipeline (two-stage):**
  - Stage 1: User's Drive → AskEffi DB
  - Stage 2: AskEffi DB → GFS/VAIS
  — email:6b490278.
- **"Eager" sync:** all file/folder metadata is written to DB immediately on folder selection (not on Confirm). Rationale: Manage view can show excluded files so users can include them later.
- **Selection scope:** users pick specific folders; can exclude individual files. Multiple folder selections supported.

#### SharePoint

- **Status:** GA. `sharepointIntegration` browser flag removed (linear:ENG-4785). v3 sync pipeline shipped 2026-04-04→04-10. — attachment:b897a1d6.
- **Picker UX:** hierarchical tree with tristate include/exclude. **Sites are first-class** — selecting a site auto-fans out to its document libraries. Blue-outline indicator for saved-but-unexpanded subtrees.
- **Sync model:** worker-driven pull (delta polling via Microsoft Graph), replacing earlier push-subscription model. *"Fewer timeouts on restricted tenants, cleaner recovery when subscriptions expire, and deterministic behavior when the server restarts."*
- **Storage:** full text extracted; stored in `data_items` table (extracted_text was pivoted from `sharepoint_files` to `data_items` per linear:ENG-4548).
- **Internal/External:** per-item `access_level` (TEXT NOT NULL CHECK ('internal','external')) — the same column convention used across the schema. The old boolean `is_external` was migrated to this shape. — attachment:223abc60.
- **Lifecycle:** files that fail too many times transition to excluded or pending-deletion. Soft-deleted files revived on reconnect. Disconnecting/deselecting deletes all data from AskEffi's end.

#### Fathom

- **What Effi receives:** **transcripts only**. Summaries are generated by Effi, not pulled from Fathom. *"when using OAuth with Fathom, we only receive the transcripts, so we generate the summaries ourselves."* — Lihu, email:05247922 (Apr 9).
- **Connector model (per-recorder):** workspace-level OAuth, one connector per workspace. **Only the user who connected sees the full Manage modal.** A workspace owner who isn't the connector sees *"Connected by `<name>`"* + Remove button only. A project owner who isn't workspace owner sees *"Connected by `<name>`"* with no actions. *"Fathom is per-recorder and other owners need to know who to ask when an expected meeting doesn't show up."* — attachment:80d51643.
- **Sync model:** manual Sync button + stale-sync auto-recovery after 5 minutes; non-blocking (server returns immediately, UI polls). Background auto-sync on close (linear:ENG-4926).
- **Pagination history:** original SDK had 50-item offset cap → fixed via cursor pagination. Separate ~90-100-meeting stall was a Unified.to cursor-fallback bug, also fixed. — attachment:b897a1d6, attachment:8e0be2b6.
- **Disconnect:** bulk-deletes orphaned meetings + related data.
- **Inclusion rules:** glob-wildcard email matching, tag-input with autocomplete, per-rule match counts; first-time users get a seed rule auto-created.
- **User-level integration model** (persist across projects): **deferred** — attachment:80d51643.
- **Internal/external toggle:** **not built.** Guy 2026-04-08 UX feedback item #9: *"Under Data, there is an internal/external toggle. We should do the same in Fathom (SharePoint already has it)."* — email:c523eb79. As of 2026-05-08 still not shipped.

#### Linear

- **Status:** shipped read-only; primarily used by AskEffi internally (Effi team's own dev workflow). Guy 2026-04-29: *"Slack is in progress, but Fathom, SharePoint, linear, we don't use it, like our customers don't linear, that's more for us."* — fathom:0c6d9496.
- **Critical-bug history:** *"Connect Linear"* returned 401 for every user from early April until 2026-04-25→05-01. The Python-side hardening (linear:ENG-4214) added service-role verification; the Next.js caller wasn't sending it. Fixed via linear:ENG-5548. **Existing connections were unaffected; new connections failed during the outage.** Not disclosed externally. — attachment:223abc60.
- **Scoping:** based on Linear *teams*, not *projects* — required a minor fix per email:a380028f.
- **Auth mechanism:** service-role bearer (implied by the bug fix), not user-OAuth. Exact details (API key vs. OAuth, read-only scope) not in indexed corpus.
- **Internal seat usage (Effi team):** *"We have one seat on linear because we don't need more than one seat. Claude is the only user we have."* — Guy 2026-04-16, fathom:d6bad234.

#### Slack

- **Customer-facing OAuth-connect flow live** (workspace install + per-project channel binding) since 2026-04-25→05-01. `slack_installs`, `slack_channel_bindings` tables. Events API lifecycle handlers wired. — attachment:223abc60.
- **Admin ops + post-install smoke** still IN_PROGRESS 2026-05-02→05-08 — attachment:80d51643. linear:ENG-5760.
- **Marketplace listing:** *"at risk"* (2-6 week Slack review process; only 2 of 6 required security items resolved as of 2026-04-30). — email:7aed7215.
- **MESSAGE INGESTION NOT YET SHIPPED.** As of 2026-05-08 zero Slack messages are indexed. linear:ENG-5409 (*"first slice toward functional AskEffi-Slack"*) IN_PROGRESS. — gmail:444de44f (2026-05-06 feature prioritization meeting: *"Priority #1: Slack Integration: Pull information from Slack"*).
- **v1 decisions** (from slack-status file:2347ede4, 2026-04-30):
  - All Slack data **internal-by-default** for v1; no toggle.
  - **User-level OAuth** (not org-level).
  - **Single channel ↔ project mapping** in v1 (no multi-channel).
  - **Full-history backfill** with attachments; mirrors email model.
  - **@Effi-in-Slack bot deferred** (UC-3 out of scope for v1).
- **Decision: direct Slack API over Unified.to** — parallel spikes Apr 28-29 showed 50× performance gap favouring direct.
- **Lifecycle events handled:**
  - `app_uninstalled` → revokes all installs, drops bindings.
  - `tokens_revoked` → revokes install, keeps bindings for reconnect.
  - `channel_rename` → deletes binding (*"silently re-pointing them would be a data-leakage vector"*).
- **Channel picker:** lists public, non-archived channels the bot can post to. Filters out DMs and private channels the bot isn't in.
- **Trigger:** Elsante 2026-04-24 design-partner session — *"If you could just map a channel to a project, my life is golden"* — described as the strongest positive reaction in the whole session. Earlier validation Maggie 2026-02-25: *"A lot of decisions are made on Slack. If it's not in Jira, it is Slack."* — file:2347ede4.

#### Scheduled Reports (as a data source)

Delivered report runs join the searchable canon as VAIS-indexed items. Test fires don't enter canon; failed runs don't enter; only `is_excluded=false` runs surface in semantic search. Three agent tools: `get_report`, `list_reports`, `access_prior_runs`. Same VAIS pipeline as SharePoint. — attachment:80d51643.

---

## Access-control model

### Project roles (workspace-orthogonal)

| Role | Description |
|---|---|
| **Project Owner** | Full control — files, collaborators, settings. Sees all data. |
| **Internal Collaborator** | Sees all project data (internal + external). Cannot upload/manage files or invite. |
| **External Collaborator** | Sees **only data marked external**. Cannot manage anything. |

### Workspace roles

| Role | Description |
|---|---|
| **Workspace Owner** | Full control. Creates projects, invites/removes members, marks projects public, manages billing. |
| **Member** | Can access public projects + use workspace-level integrations. Cannot create projects. |

— attachment:8fb1ae35 (Workspace Model v2).

### Key design principles

- Workspace membership is **orthogonal** to project membership. A user can be a project collaborator without being a workspace member, and vice versa.
- Only workspace owners can create projects.
- Only workspace owners can mark projects as public.
- Billing is per-workspace (no user-level tiers).

### RLS — floor, not ceiling

- *"Every data query is scoped to the authenticated user's workspace/project. Enforced at the database level, not just the application layer."* — attachment:cae9d296.
- *"Automated checks validate RLS policy coverage on every code change. Regressions are blocked."* Dedicated DB hardening test suite of 600+ lines.
- **Architectural finding (recorded 2026-05-02→05-08):** *"RLS alone is not sufficient as Effi's access gate. Tools (data_browse, VAIS, future canon tools) layer additional filters on top of RLS — RLS is the floor (it has to allow curator UIs to read excluded rows), tools are the ceiling."* — attachment:80d51643. linear:ENG-5764.

### External-agent isolation + magic links

- Guy to IAS 2026-01-21: *"The external agent does not have access to the internal stuff. You cannot jailbreak into getting information you're not supposed to."* — fathom:a793fb74.
- **Magic links** for external access — time-limited, single-use. *"If somebody forwards the link, he doesn't [get access]… We use a magic link to ensure that."*
- **Acknowledged risk** (same IAS meeting): when a document is uploaded and shared internally, *"people can ask questions about the document even if they don't have access to the document."* Aakash Relan: *"That's a feature bug."* Guy acknowledged this is something customers need to be comfortable with.

### Limitations / planned

- **No fine-grained per-document permissions** inside a project — visibility is project-level with internal/external split only. — attachment:7983cd67 (security-feature-matrix).
- **SSO / SCIM:** planned (roadmap), not yet shipped.
- **Domain allowlisting:** GA.

### "Vendor-as-external-user" — the canonical pattern

Across demos and the investor pitch:
1. Service provider (IT consultancy / ERP vendor / construction firm) creates the project in their workspace.
2. Uploads internal data (margin analysis, risk notes) to the internal bucket.
3. Curates external data (project status, shared docs) for the client bucket.
4. Shares a magic link with the client (vendor / CIO / partner) added as External Collaborator.
5. Client asks Effi questions and receives answers grounded only in external-bucket content.

— fathom:a793fb74, fathom:104a567f, attachment:e7da01c3.

---

## History

```
2025-12-16 — Workspace Model v2 drafted. Single workspace type, orthogonal membership, billing per-workspace. — attachment:8fb1ae35
2026-01-12 — Feature prioritization: file upload baseline; Drive planned; SharePoint+Dropbox future; rule-based email V0. — email:eb44a9ba
2026-01-21 — Joshua Mindel demo: internal/external file upload + collaborator model. Only file uploads at this point. — fathom:21a3b1ea
2026-01-21 — IAS demo: magic-link access control demonstrated. "External agent does not have access to internal stuff." — fathom:a793fb74
2026-01-22 — Feature prioritization: Drive V0 = link to user's Drive, single folder, non-recursive. — email:eb44a9ba
2026-01-28 — Priyank demo: email CC model described, rules per project. — fathom:06abead4
2026-02-02 — Email integration first loop closed on staging. — email:7762d129
2026-02-04 — Lorne Novolker demo: email-per-project as upcoming. — fathom:8f140ecb
2026-02-18 — Guy → Elsante: email integration ready; Drive end-of-week; Fathom in-the-works. — email:07af50c3
2026-02-23 — Lihu demos Drive integration to team: connect, folder picker, link by URL. Slack mentioned for later. — email:15aefc4e
2026-02-25 — Maggie validates Slack need: "A lot of decisions are made on Slack." — file:2347ede4
2026-03-09 — Smartsheet + other PM tools mentioned as possible future. — fathom:c87b3fec
2026-03-10 — Ana Caro Mexia demo: email + Drive done; SharePoint not prioritized; Fathom next via Unified.to. — fathom:72a03148
2026-03-30 — External security posture v1 published. Drive section 1.4 names Unified.to + drive.readonly. — attachment:cd107232
2026-03-30 — DPA v1 published. — attachment:be78979e
2026-04-02 — SharePoint meeting: client-ready for Epsilon's pilot. Teams note-taker planned to follow Fathom. — email:a1b4b33e
2026-04-07 — SharePoint beta to Ricky Green (Epsilon). — email:b0ad3aed
2026-04-08 — Guy UX feedback #9: add internal/external toggle to Fathom. — email:c523eb79
2026-04-09 — Lihu confirms Fathom OAuth = transcripts only; AskEffi generates summaries. — email:05247922
2026-04-04→04-10 — SHIPPED: SharePoint v3 sync pipeline (rewrite), Fathom non-blocking sync + UX overhaul, Drive sync-state lifecycle fixes, project outline injected into every prompt, subprocessors as versioned legal doc, sharepointIntegration flag removed. — attachment:b897a1d6
2026-04-11→04-17 — SHIPPED: Data tab full rewrite, Fathom stall-at-50 + stall-at-90 fixes, editable project email address, first Unified.to webhook path (HMAC verify → Python RPC), org model removed (workspace = top-level). — attachment:8e0be2b6
2026-04-15 — Linear scoping discussed (teams not projects). — fathom:c6977587
2026-04-16 — Guy: Linear is read; Claude Code uses one Linear seat. — fathom:d6bad234
2026-04-17 — Chandra demo: enumerates live integrations; Slack in-progress. Confirms data is copied for preprocessing. — fathom:8e3dc338
2026-04-18→04-24 — SHIPPED: Email browser v2 GA (inline inspector, bulk access toggles, per-project sender allowlist toggle), Drive card hidden behind test-user list, two Fathom data-loss bugs fixed, identity+timezone in every chat turn. emailModalV2 flag default flipped to true. — attachment:0f530be9
2026-04-24 — Unified.to email thread documents Drive CASA blocker; direct vs Unified spikes for Slack. — emails:26fcefc4/b5b0dd21/e7b2da5a
2026-04-24 — Elsante design-partner session: "If you could just map a channel to a project, my life is golden." — file:2347ede4
2026-04-25→05-01 — SHIPPED: Slack customer-facing OAuth+channel binding (linear:ENG-5409 / 5411 / 5413 / 5416), Scheduled Reports core, emailModalV2 retired (legacy deleted), Linear connect 401 fixed (linear:ENG-5548), get_meeting time-window args fixed (linear:ENG-5028), tool-surface lockdown stripping harness tools (linear:ENG-4893/4897), Drive is_external→access_level rename. — attachment:223abc60
2026-04-29 — Chandra demo: Guy "Give us 10 days or so, and Slack will be there" (already shipped behind flag). — fathom:0c6d9496
2026-04-30 — Slack work-status file synthesised. Open decisions: token encryption, backfill window, private channels. — file:2347ede4
2026-04-30 — Weekly status: Drive 🔴 blocked; Slack 🟡 at-risk for May 4 Elsante target. — email:7aed7215
2026-05-02→05-08 — SHIPPED: Scheduled Reports runs join searchable canon (VAIS), Fathom card scoped to connector, Slack admin-ops in-progress, .xlsx upload, Drive own-GCP migration started. RECORDED: RLS-floor / tools-ceiling architecture finding (linear:ENG-5764). — attachment:80d51643
```

---

## Conflicts to flag

**C-1 — Investor deck implies CRM is current.** Deck (attachment:e7da01c3): *"Connect Effi to project data — Through integrations with Email, notes takers, documents, CRM."* Reality: no CRM (HubSpot, Salesforce, Freshdesk) shipped. Guy 2026-04-27: *"the idea to connect to HubSpot or Salesforce so we can automatically fetch your emails from there. We can build it if needed."* — fathom:f5dcf4b2. Aspirational framing.

**C-2 — *"Fathom syncs meeting notes and recordings"* vs. reality.** Pitch shorthand (email:927af0d5): *"Fathom: Integrates to automatically ingest meeting notes and recordings."* Engineering reality (email:05247922): transcripts only. **Recordings (audio/video files) are not ingested.** *"Notes"* is loose shorthand.

**C-3 — Drive presented as shipped in security docs; actually blocked for general users.** Security posture (attachment:cd107232 / cae9d296 / 9fa8c573) describes Drive as a current operational integration with full technical detail and no caveat. Reality: hidden behind hardcoded test-user allowlist; Google verification + CASA pending. The doc accurately describes the *implemented architecture* but omits *available-to-whom*.

**C-4 — *"Connect Linear"* outage early-April → 2026-04-25 with no public disclosure.** Every new Linear connection 401'd for ~3 weeks. Existing connections unaffected. No mention in any external-facing document, deck, or customer comm in indexed data.

**C-5 — Fathom internal/external toggle: Guy's requirement vs. current state.** Guy 2026-04-08 listed it as item #9 of UX requirements. As of 2026-05-08 still not shipped. `access_level` column convention exists everywhere except Fathom meetings. No Linear issue cited in any production report.

**C-6 — Slack *"10 days"* claim vs. actual ship date.** Guy → Chandra 2026-04-29: *"Give us 10 days or so, and Slack will be there"* — fathom:0c6d9496. Reality: Slack OAuth+channel binding was already on `main` behind a browser flag the same week (attachment:223abc60). Either Guy was unaware of how far along Lihu's team was, or hedging for GTM. The flag was off by default; underlying code already merged.

---

## Gaps

**G-1 — Sync frequency not documented for any integration.** SharePoint = worker delta polling, Fathom = 5-min stale-recovery, but no specific polling interval (e.g. *"every 15 min"*) for SharePoint, Drive, or Linear. *"How fresh is the data?"* has no documented SLA.

**G-2 — SharePoint OAuth scopes not specified.** Microsoft Graph permissions/scopes never named in any indexed source. Enterprise security review would want: which Graph API permissions, admin-consent requirements, delegated vs. application permissions.

**G-3 — Slack OAuth scopes not specified in production docs.** R&D spike mentioned `channels:join` (attachment:b897a1d6); final production scope list for the customer-facing app not documented.

**G-4 — Linear auth mechanism in production not fully documented.** Service-role bearer is implied (linear:ENG-5548 fix); exact flow (API key? OAuth? read-only scope?) not described elsewhere.

**G-5 — No documented handling of Fathom's internal/external classification.** All Fathom meetings land internal-by-default. No policy for meetings with external participants (e.g. client calls). Guy's #9 feedback hasn't produced a shipped feature.

**G-6 — OCR for scanned/image PDFs not confirmed enabled.** Vertex AI Search supports OCR but *"not enabled by default — must be toggled at datastore creation."* — email:a563098a. Whether enabled in production is not confirmed. Users with scanned PDFs (legal, construction — Elsante's case) would silently get nothing.

**G-7 — *"Vendor-as-external-user"* has no firm data-model spec.** The data-model Drive doc poses but doesn't resolve: *"Does Chris have an organization? How is this organization called?"* — drive:5e948cf5.

**G-8 — Drive rename/move/permission-change re-sync behaviour not confirmed.** 2026-02-23 meeting flagged as edge cases requiring clear handling. Production weeks describe state-machine fixes but not specifically rename/move resolution.

**G-9 — Slack backfill window decision was open as of 2026-04-30.** How far back history is backfilled on first connect — undocumented.

**G-10 — Subprocessor list / DPA covers only Drive (via Unified.to).** No comparable doc section for Slack or Linear. Customer due-diligence on those would find a gap.

---

## See also
- [product](product.md) — agent surfaces that consume these sources
- [tech-stack](tech-stack.md) — Mailgun, Resend, Unified.to, Vertex AI, Supabase
- [compliance](compliance.md) — security posture, DPA, subprocessors
- [roadmap](roadmap.md) — Slack message ingestion + workspace-level email next
