---
topic: roadmap
moc: product
updated: 2026-05-08
conflict_pending: false
---

# Roadmap

What's GA, what's actively in flight, what's queued, what's on the horizon, and what's been deprioritized. Linear is the system of record. For agent-surface feature breakdown, see [product](product.md). For per-integration shipped/blocked detail, see [data-sources](data-sources.md).

## Current — what's GA today (no flag)

| Capability | Detail |
|---|---|
| **Web chat** (project-scoped Q&A) | GA. Markdown rendering, rich-text copy, jump-to-bottom pill, compact tool-call display all live. |
| **Chat history** (per-user, per-project) | **Being made always-on this week.** `webChatHistory` toggle removal IN_PROGRESS — linear:ENG-5864. Spec for history dropdown + return-to-active-chat: linear:ENG-5765 IN_PROGRESS. |
| **Email** (project-specific inbox via Mailgun) | GA. Inline browser with bulk access toggles + per-project sender allowlist. |
| **File upload** | GA. PDF, DOCX. `.xlsx` added 2026-05-02→05-08 (was previously rejected by allowlist). — attachment:80d51643 |
| **Fathom meeting sync** | GA, scoped to connector role. — attachment:80d51643 |
| **SharePoint** | GA behind feature toggle, released to Epsilon. — attachment:223abc60 |
| **Linear** | GA. Was 401-broken since early April for new connections; fixed week of 2026-04-25. — attachment:223abc60 |
| **Google Drive** | **Hidden for non-allowlisted users.** Google verification for `drive.readonly` pending. — attachment:0f530be9 |
| **Slack** | **OAuth + channel binding live behind `slackIntegration` browser flag** (default off). Not yet publicly released. — attachment:80d51643, file:2347ede4 |
| **Internal/External separation** | GA per-row across documents/emails/Drive items. |
| **Scheduled Reports** | Launched week 2026-04-25. Major overhaul week 2026-05-02→05-08. Now first-class: runs in canon, recipients v2, test-fire loop, live SSE progress, 10-min wall-clock cap, anchored-chat link in every email. — attachment:80d51643, attachment:223abc60 |
| **Magic-link auth** | GA. |
| **Domain allowlisting for external users** | GA. |
| **Effi identity + time-of-day in every chat turn** | GA since week 2026-04-18→24. |
| **`effi` CLI** | GA. `reports`, `anchor`, `auth`, `meetings show`. |

## Active development (IN_PROGRESS)

| Linear ID | Feature | Notes |
|---|---|---|
| linear:ENG-5864 | Remove `webChatHistory` flag (chat history always-on) | Shipping now |
| linear:ENG-5765 | Web-chat: return-to-active-chat + history dropdown UX | In-flight spec |
| linear:ENG-5318 | Scheduled Updates spec: recurring prompt → email delivery | Ongoing iteration |
| linear:ENG-5409 | AskEffi-Slack customer integration first slice (C-track) | In progress |
| linear:ENG-5408 | UseGin-Slack internal dev-agent interface (D-track) | In progress |
| linear:ENG-5760 | Slack admin-grade ops + post-install smoke | In progress |
| linear:ENG-5537 | `effi` CLI sanity tests (Phase B: PAT auth, `/api/v1` proxy) | In progress |
| linear:ENG-5464 | E2E Gherkin coverage — Drive folder/file external toggle | In progress |
| linear:ENG-5017 | `feat(data-tab)` bulk-delete RPCs per source | In progress |
| linear:ENG-5019 | `feat(chat)` stream richer events — tool inputs/results, thinking blocks | In progress |

## Near-term backlog (OPENED, by area)

**Meetings tab** (new data type in project config):
- linear:ENG-5823 spec
- linear:ENG-5825 read-only list
- linear:ENG-5826 detail pane + search/filter + lazy-fetch
- linear:ENG-5827 access-level controls

**Scheduled Reports polish + expansion:**
- linear:ENG-5854 UX restructure (Advanced + Under-the-Hood sections)
- linear:ENG-5845 Trigger reports as `/report-name` slash commands in chat
- linear:ENG-5815 Test-fire + manual-fire on report list-row card
- linear:ENG-5814 Push report to **executive dashboard widget** (no spec for the dashboard itself — see Gap G-6)
- linear:ENG-5812 Per-report internal/external scope toggle + scope-copy clarity
- linear:ENG-5840 Surface no-audience warning on detail header + edit modal
- linear:ENG-5813 Soften delete confirmation/transition (UX bug)
- linear:ENG-5811 Flip default → "Send right away"; collapse Approval/Preview into Advanced
- linear:ENG-5847 Audience scope: app-layer `access_level` filter
- linear:ENG-5848 / 5849 / 5850 / 5851 / 5852 — reporting agent: external scope across emails / files / meetings / etc.

**Email tab scalability:**
- linear:ENG-5820 Bug: list silently truncated to 1,000 rows on large projects
- linear:ENG-5831 Server-side cursor + count + filter/sort
- linear:ENG-5832 Wire client to paginated email-list API
- linear:ENG-5833 Infinite scroll + "Showing N of M" header
- linear:ENG-5834 Debounced server-side search (subject + from_header)
- linear:ENG-5835 Hide thread-grouping toggle for v1

**"What-did-I-miss v2":**
- linear:ENG-5829 — *"personal, stateful, bidirectional briefing assistant"*

**Dev-session-sync** (3-slice feature; **internal/dev tooling, not customer-facing** — opened 2026-05-08):
- linear:ENG-5861 slice 1: browse + search across envs
- linear:ENG-5862 slice 2: cross-env resume + lock + fork
- linear:ENG-5863 slice 3: backfill, summaries, UseGin tools, decommission

**Other:**
- linear:ENG-5842 Bug: admin/VAIS doc-counts capped at 1,000 by PostgREST default
- linear:ENG-5836 Bug: `effi` CLI files allowlist missing `.pptx` + `.xlsx`
- linear:ENG-5777 Bug: `effi auth verify --profile <name>` ignores flag

## Named-but-not-in-Linear (horizon)

| Feature | Status | Source |
|---|---|---|
| **Email reply to Effi** (reply to a scheduled-report email with a question; Effi answers) | Planned. Guy → Kerry Williams 2026-05-06: described as *"close to shipping."* Design rules posted 2026-05-07: require `?` to avoid answering rhetoricals; reply to sender only; explain alias if using customer domain. **No Linear task yet** — see Gap G-7. | gmail:ff7a8587, gmail:7a19f0f2 |
| **Workspace-level email address** (`effi@yourdomain.com`) with routing rules | Planned since Feb 2026 (told to design partners as *"coming soon"*); still pending 2026-05-04 prioritization meeting. | gmail:bb7db759, fathom:e4743f9e |
| **Salesforce integration** | Listed as Priority #2 in design-partner standard-terms template (Email = #1) — attachment:6acd07d7. **No Linear task; not built.** Risk: a partner may have signed expecting this — see Conflict D + Gap G-1. |
| **Excel file reading** | Not yet supported. Guy 2026-05-01 to Epsilon: *"Disclosure. We don't read Excel yet."* — fathom:06d79312. (Note: `.xlsx` *upload* re-enabled in the file allowlist 2026-05-02→05-08 is separate from *content extraction*.) |
| **MS Teams integration** | No spec. Noted in Epsilon May 1 session as a need (Epsilon is Teams-only internally) but explicitly deprioritized: *"like, I assume Teams will be similar, although for internal use, I'm not sure"* — fathom:06d79312. |
| **@Effi bot in Slack** (UC-3: mention @Effi in a channel and get a threaded reply) | Explicitly **deferred** out of Slack v1 — file:2347ede4. |
| **Proactive digest via Slack** (scheduled Slack message) | "Stretch" goal in Slack spec — would reuse Scheduled Reports engine. Not yet scheduled. — file:2347ede4. |
| **Google Drive own-OAuth credentials** | Migration from Unified.to shared client → AskEffi's own GCP-registered client started 2026-05-02→05-08 (required for Google verification). In backlog. — attachment:80d51643. |
| **Archive projects** | Spec written (soft-freeze via `archived_at`); moved to Linear; no implementation. — attachment:0f530be9. |

## Security / compliance roadmap (intentions, no dates)

The security-posture doc (attachment:c1670611, April 2026) names the following as roadmap with `<quarter/year>` placeholders — **i.e. no date committed**:

- **SSO (SAML/OIDC)** — roadmap
- **SCIM provisioning** — roadmap
- **SOC 2 Type II** — *"in progress"*; AskEffi evaluated **Scytale** (~$13,668 total package); **no signed contract found in indexed data.** SOC 2 was explicitly **deprioritized** in early April: *"The focus is now on unblocking usage, not on SOC 2"* — gmail:d3626bed. See Conflict C.
- **Audit-log export + admin APIs** — roadmap
- **Annual penetration testing** — roadmap
- **EU/US data residency** — TBD

## Investor-facing roadmap (May 2026 deck)

The deck (attachment:e7da01c3) has **no explicit roadmap slide or dated milestones.** The "What this round must prove" targets for the **$2M raise** — see [north-star](north-star.md). The deck's "How it works" describes the full envisioned product (email + notes + documents + CRM integrations, internal+external stakeholder access, reactive+proactive guidance, portfolio-level risk) without distinguishing live from roadmap. See Conflict A.

- Source: attachment:80d51643 (production-week 2026-05-02→05-08), attachment:223abc60 (week 04-25→05-01), attachment:0f530be9 (week 04-18→04-24), attachment:e7da01c3 (May 2026 deck), attachment:c1670611 / cae9d296 / 9fa8c573 (security posture, April 2026), attachment:6acd07d7 (design-partner standard terms), attachment:c12a3f81 / e4743f9e (feature-prioritization meetings), file:2347ede4 (Slack work-status 2026-04-30), fathom:06d79312 (Epsilon feedback 2026-05-01), gmail:d3626bed (SOC 2 deprioritization), gmail:7a19f0f2 / ff7a8587 (email-reply-to-Effi).
- Last verified: 2026-05-08

---

## History

```
2025-11-18 — Company described as "4 people, demo, chasing design partners"; Q1 2026 design-partner-onboarding target. — gmail:777fec08
2025-12-12 — Feature idea: surface relative-customer-priority of features to engineers. — fathom (Mark Prince meeting)
2026-01-07 — Guy: "next week hand the product to a bunch of people"; "give it two months" — Effi reveals what other users asked her (cross-user query visibility). — fathom:2838e7d5
2026-01-07 — V1 product target = January 2026 in design-partner outreach. — gmail:681ab10a
2026-01-12 — Feature prioritization: 404 on project cards for non-member workspace visitors → grade-out instead. — fathom (2026-01-12)
2026-02-05 — White-labelling/custom branding **deprioritized**: *"if I had to do pure prioritization of features, this is lower"* (Guy + Chris Baum). — fathom (2026-02-05); gmail:b9435d19
2026-02-05 — Email + folder integrations committed to Perform Media by *"end of February"*. — gmail:b9435d19
2026-02-12 — Email integration live; dogfooding begins. — gmail:bb7db759 / 89c1ca81
2026-02-16 — Email integration announced to Nido (Ana Caro Mexia) + Perform Media as unblocking real pilot usage. — gmail:bb7db759 / 89c1ca81
2026-02-25 — Maggie (design partner): *"A lot of decisions are made on Slack. If it's not in Jira, it is Slack."* First documented Slack signal. — file:2347ede4
~Late Feb / Early Mar — Initial Fathom plan (all meetings + project-member filter) **rejected** in favour of user-defined inclusion rules. — gmail:40e89e82
2026-03-30 — DPA + security-posture v1 versioned. — attachment:cd107232 / be78979e
~Early April — **SOC 2 deprioritized** in favour of email/folder integrations. — gmail:d3626bed
~Early April — Linear-connect 401 bug introduced (Python hardening + Next.js caller mismatch). — attachment:223abc60
2026-04-07 — Security posture updated (Cloudflare-included version). — attachment:c1670611 / cae9d296
2026-04-10 — DPA updated. — attachment:d767b748
2026-04-15 — Feature prioritization: team discusses **removing** features as well as adding. Nitsan: *"we've accumulated many, many skills and tools… when there's too much, it is a burden."* — fathom (2026-04-15)
2026-04-18→24 — Email-browser overhaul GA. Two Fathom data-loss bugs fixed. Chat polish (rich-text, jump-to-bottom, compact tools). Identity+time-of-day in every chat. Drive hidden for non-allowlisted users. — attachment:0f530be9
2026-04-24 — Elsante session: *"If you could just map a channel to a project, my life is golden."* Strongest Slack-mapping signal. Slack-internal-only-for-v1 decision recorded. — file:2347ede4
~2026-04-24 — Slack PRD written: 3 use cases (UC-1 channel ingestion, UC-2 daily-standup-replacement, UC-3 @Effi bot deferred). External Slack channels (Slack Connect) deferred. — gmail:b35d2527
2026-04-25→05-01 — Scheduled Reports first launch. Slack OAuth+channel-binding live behind flag. Linear connect 401 fixed. `get_meeting` time-window args fixed. Tool-surface lockdown. — attachment:223abc60
2026-04-27→29 — Slack R&D round: parallel spikes (Unified.to vs. direct Slack API). Direct chosen. — file:2347ede4
2026-04-29 — Weekly status: Slack customer-facing 🟡 At Risk for May 4 Elsante target; Slack Marketplace 🟡 At Risk; Drive 🔴 Blocked. — gmail:7aed7215
2026-04-30 — Slack work-status doc consolidated: @Effi bot deferred, full-history backfill, user-level OAuth (not org). Owner: Lihu. — file:2347ede4
2026-05-01 — Epsilon feedback session. Chat-history-not-preserved + Excel-not-read + Salesforce-as-priority-2 surfaced. Guy/Nitsan acknowledge fixes. — fathom:06d79312
2026-05-04 — Feature prioritization (Guy + Lihu + Oria). Decisions: Meetings tab → Lihu first; Chat history → Lihu after Meetings; Slack > Drive UX; Oria to do Google verification video. — fathom:e4743f9e
2026-05-06 — **Scheduled Updates launched externally.** Guy → Elsante + Ricky. Slack described as *"in the works"* in both. — gmail:04611c8d / b07abccb
2026-05-06 — Feature prioritization (60 min, all 4 — primarily Hebrew). Pitch-rehearsal + competitive positioning visible. — fathom:c12a3f81 / 725f1914
2026-05-07 — Email-reply-to-Effi design rules posted. — gmail:7a19f0f2
2026-05-07 — Meetings tab spec opened (linear:ENG-5823 / 5825 / 5826 / 5827).
2026-05-07 — Email-tab pagination + search opened (linear:ENG-5820 / 5831–5835).
2026-05-07 — *"What-did-I-miss v2"* opened (linear:ENG-5829).
2026-05-08 — Dev-session-sync 3-slice opened — **internal dev tooling, not customer-facing** (linear:ENG-5861 / 5862 / 5863).
2026-05-08 — `webChatHistory` toggle removal IN_PROGRESS (linear:ENG-5864). Chat history → always-on for everyone.
```

---

## Conflicts to flag

**A — Investor-deck product claims vs. engineering reality.** Deck (attachment:e7da01c3) frames the full envisioned product without distinguishing live from roadmap:
- *"Through integrations with Email, notes takers, documents, CRM"* — CRM (Salesforce) **not built**, no Linear task.
- *"Effi guides stakeholders through project — Reactive + Proactive"* — proactive guidance exists only as Scheduled Reports email delivery; no in-app proactive alerting spec'd.
- *"Portfolio-level risk across projects"* — shown in deck screenshots (multiple named projects with risk levels) — **no such feature in GA or current backlog.** Deck appears to be demo/mockup.
- *"From 132 days … → minutes"* — value-prop narrative, **not a measured customer outcome in indexed data.**

**B — *"Slack integration coming"* told to customers vs. release state.** Guy → Elsante 2026-05-06: *"Slack is in the works!"* Guy → Ricky 2026-05-01: *"Slack is the integration is coming."* Engineering reality: customer-facing OAuth+channel-binding is live on `main` behind a default-off browser flag. As of 2026-04-30 status doc, *"At Risk"* for the 2026-05-04 Elsante target. Admin-grade ops still IN_PROGRESS in the 2026-05-02→08 production week. **Not yet released to customers.** Customers told *"coming"*/*"in the works"* — technically correct but timeline opaque to them.

**C — SOC 2: *"in progress"* (security doc) vs. no actual engagement.** Security posture (attachment:c1670611, April 2026): SOC 2 Type II *"in progress"* with `<quarter/year>` placeholders. Engineering record: gmail:d3626bed *"The focus is now on unblocking usage, not on SOC 2."* Scytale evaluated (~$13,668) — **no signed contract or engagement confirmed.** Treat *"in progress"* as aspirational language.

**D — Design-partner standard terms list Salesforce as Priority #2.** Template (attachment:6acd07d7) shows Email (Priority 1) + Salesforce (Priority 2) with **blank ETA/Status/Notes** fields. **No Salesforce Linear task / spec / production-report mention.** If a partner signed this version, contractual obligation may exist with no implementation path. **High-risk misalignment.** See Gap G-1.

**E — Chat-history fix: *"we want to fix it"* (May 1) vs. still not live (May 8).** Epsilon May 1: Ricky surfaced that closing/reopening the app loses chat history. Guy: *"That's on our mind. We are aware of that."* Nitsan: *"We want to fix it."* Engineering status May 8: `webChatHistory` toggle removal IN_PROGRESS (linear:ENG-5864) and history-dropdown UX spec IN_PROGRESS (linear:ENG-5765). **Fix in progress, not delivered to the customer who raised it.**

---

## Gaps

**G-1 — Salesforce: which design partner signed with Priority-2-Salesforce?** Standard-terms template (attachment:6acd07d7) doesn't name the partner. Whether the row was customised per deal, whether a verbal date was committed, whether there's a contractual obligation — unknown.

**G-2 — Slack Marketplace approval timeline.** App review takes 2-6 weeks. 2 of 6 security items resolved as of 2026-04-30. **No document showing whether submission was made or current review status.**

**G-3 — Google Drive verification: opaque.** Google has given no timeline. 2026-05-04 meeting references Oria producing a verification video — **no indexed evidence the video was submitted or that Google has responded.** All Drive users remain blocked behind the allowlist.

**G-4 — No public roadmap or customer-facing feature timeline.** Everything beyond live-today is in Linear. Design partners receive verbal updates; no shared roadmap document.

**G-5 — Epsilon's SharePoint-toggle status for the wider team.** Guy 2026-05-06 to Ricky asks about "Broader team use" + connecting folders/SharePoint — Epsilon is a Microsoft shop whose wider team engagement depends on SharePoint going live. Whether the SharePoint feature toggle is on for Epsilon's full team (vs. just Ricky) is unclear.

**G-6 — Executive-dashboard widget (linear:ENG-5814) has no spec.** Backlog task says *"push report to executive dashboard widget"* but no spec for the executive dashboard exists. Investor deck shows a portfolio-risk view UI — appears to be a mockup/vision slide.

**G-7 — Email-reply-to-Effi: no Linear task yet.** Guy posted design rules 2026-05-07 (gmail:7a19f0f2) and described as *"close to shipping"* to Kerry Williams 2026-05-06. **No Linear task in indexed data.** *"Close to shipping"* phrasing more aspirational than literal.

**G-8 — Audience-selector model for Scheduled Reports is deferred.** Production-week 2026-04-25→05-01 (attachment:223abc60): *"Email-recipients-v2 spec. Drafted the next iteration of the scheduled-report recipients model — distinguishes the audience selector that this week's cosmetic hide is standing in for. Lihu-grade ask; not implemented yet."* Current recipients editor hides the audience radio as a placeholder.

**G-9 — MS Teams: no signal of prioritization.** Epsilon (Teams-only internally) is the most active design partner. Slack got prioritized because of a separate battery-tech prospect. **No Teams integration on the roadmap.**

**G-10 — *"Cross-company"* collaboration has no implementation spec.** Entire pitch (deck + May 6 meetings) centres on cross-company moat: *"once we become the layer that they collaborate on top, it becomes really hard to replace us."* **No product spec for what cross-company collaboration looks like technically** — how a vendor sees a consultancy's project, access control across company boundaries, UI for shared project. Highest-vision item with zero indexed implementation evidence.

**G-11 — SOC 2 audit-window date.** Security-posture doc has `<quarter/year>` placeholders throughout. No commitment.

**G-12 — `dev-session-sync` (linear:ENG-5861/5862/5863) is internal tooling.** Opened 2026-05-08. Will consume engineering cycles in the near term **but produce no user-visible output.** Worth noting alongside customer-facing roadmap because it's a near-term cycle-consumer.

---

## See also
- [product](product.md) — feature breakdown of GA surfaces
- [data-sources](data-sources.md) — per-integration shipped/blocked/planned
- [compliance](compliance.md) — security-posture doc, SOC 2 deprioritization
- [gtm](gtm.md) — design-partner promises (Salesforce-priority-2 origin)
- [north-star](north-star.md) — round-must-prove targets
