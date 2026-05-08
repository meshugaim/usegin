---
topic: activity
moc: company
updated: 2026-05-08
conflict_pending: false
---

# Team activity

Observable activity per person across email + Fathom + Drive + Linear + production-week reports, window 2026-03-08 → 2026-05-08 (60 days; primary focus the last 30). Distinguishes core / occasional / reduced / dormant / departed grounded in citations rather than deck framing. Compare against [team](team.md) which classifies role/status; this note classifies *cadence*.

## Current — as of 2026-05-08

| Person | Activity | Trend | Last email | Last meeting |
|---|---|---|---|---|
| **Guy Levit** | 🟢 Hyperactive — CEO, all external surface | ↑ Accelerating | gmail:abb6e111 (May 8) | fathom:abac996b (May 6) |
| **Lihu Berman** | 🟢 Core active — engineering lead, weekly reports | ↑ Accelerating | gmail:dfc148ba (May 8) | fathom:abac996b (May 6) |
| **Nitsan Avni** | 🟢 Core active — backend, deploys, billing | → Steady | gmail:e3988183 (May 8) | fathom:c12a3f81 (May 6) |
| **Oria Meses** | 🟢 Core active — frontend, integrations, most consistent attendee | → Steady | gmail:6de3a427 (Apr 29) | fathom:c12a3f81 (May 6) |
| **Courtney McKlveen** | ⚠️ Severely reduced — possibly departed | ↓↓ Sharply declining | gmail:ffc5c666 (Mar 12) | fathom:5acf3317 (Mar 24) |
| **Chris Baum** | 🟡 Tapering — informal design advisor | ↓ Declining | gmail:1a26080f (Apr 8) | fathom:408c4253 (Apr 24) |
| **DreamLabs** (Riegos / Krueger / Caraballo) | ⚪ Dormant — contract concluded Dec 2025 | N/A in window | none in window | none in window |
| **Efrat Oryan-Yogev** | ⚪ Non-operational — personal advisor / namesake | ↓ Declining | gmail:872a76c9 (Mar 2) | fathom:3403a190 (Mar 24) |
| **Recruiters** (Salberg / Shaikh / Darshan) | ⚪ Dormant — single AI-Architect sprint | N/A | gmail:f12f2c8b (Mar 12, outbound from Nitsan) | fathom:9004899b (Mar 11) |
| **Cleverly** (Alyssa Muth, John Duran) | 🟡 Active vendor — outbound lead-gen | → Renegotiating | gmail:aebd2c5c (Apr 24) | none |

**Headline shifts in the window:**
1. **Active core has contracted to four people**: Guy + Lihu + Nitsan + Oria. The team-meeting attendee list from 2026-04-27 onward is exclusively those four — fathom:c12a3f81.
2. **Courtney is functionally absent** since 2026-03-24 (45+ days of silence). GTM is now Guy + Cleverly (a paid outbound agency), not an internal hire — gmail:aebd2c5c.
3. **Engineering velocity is accelerating** — production-week reports show 657 → 429 → 588 → 654 → **966** commits across the five most recent weeks (drive:production-week-2026-04-04 through production-week-2026-05-02; gmail:dfc148ba).

- Source: 4,069 emails + 113 Fathom meetings + 5 production-week reports + 200 Linear tasks + 2 Drive files indexed in window. Extraction conversation: chat:c3d944b5.
- Last verified: 2026-05-08.

---

### Per-person detail

#### Guy Levit — 🟢 Hyperactive

- **Volume:** ~491 emails in window — by far the largest single-sender footprint. Daily output, multiple per day.
- **Meeting cadence:** 50+ Fathom meetings in window; chairs the standing Mon/Thu feature-prioritization call. 5 investor/customer calls on May 4–5 alone.
- **Mode:** Full-stack CEO — fundraising (Qubit, True Ventures, Initialized, MVP VC, Field VC), customer development, intros, demos, product feedback. Most recent: gmail:abb6e111 (May 8 — "Fwd: Intro Jon Evans").
- **Trend:** ↑ March ~2–3 external/wk → April 4–5/wk → May 5–7/wk.

#### Lihu Berman — 🟢 Core active

- **Volume:** ~36 emails in window, all substantive. Most recent: gmail:dfc148ba (May 8 — weekly status with `production-week-2026-05-02-to-2026-05-08.md`).
- **Production reports:** 5 weekly reports authored across the window covering 3,294 shipped commits (657 + 429 + 588 + 654 + 966). Architectural decisions named throughout.
- **Meeting cadence:** Present in ~30 of ~40 feature-prioritization sessions; all major customer/investor calls. Recent: fathom:abac996b (Muli, May 6), fathom:38b8d0c6 (Qubit, May 1), fathom:0c6d9496 (Chandra demo, Apr 29).
- **Drive:** Both indexed Drive files ("Data Model", "Effi for multiple parties", Apr 12) trace to him.
- **Trend:** ↑ ~500 commits/wk through April → 966 in May 2–8. Scheduled Reports + Slack integration both shipped in window.

#### Nitsan Avni — 🟢 Core active

- **Volume:** 25 emails in window. Most recent: gmail:e3988183 (May 8 — "wow that is very thorough" reacting to Lihu's report). Earlier: deployment pings (gmail:65c48ec7, May 6), Anthropic invoice management (gmail:c229063a, Mar 31).
- **Meeting cadence:** Standing invite for Mon/Thu feature prioritization received 2026-04-30 (gmail:cf240380). Present through May 6 (fathom:c12a3f81). All three Epsilon feedback sessions (Apr 17, Apr 24, May 1).
- **Linear:** In-progress tickets include ENG-5861 (dev-session-sync, last update May 8), ENG-5409/ENG-5408 (Slack integration).
- **Trend:** → Steady. Slight gaps in some feature-prioritization sessions (e.g. absent May 4 — fathom:e4743f9e); plausibly Spain-timezone offset, not reduced engagement.

#### Oria Meses — 🟢 Core active

- **Volume:** 20 emails in window. Most recent: gmail:6de3a427 (Apr 29 — Drive auth issue during OAuth-client switch). Earlier shipping: new landing page (gmail:666f01d9, Mar 10), Vertex AI live ("ורטקס :)" — gmail:9536e55e, Mar 19), demo fixes (gmail:fce817af, Apr 10).
- **Meeting cadence:** **Most consistent non-founder attendee.** Present in *every* feature prioritization Mar 9 → May 6. All three Epsilon feedback sessions; SharePoint walkthrough (Apr 2); Elsante calls; multiple customer demos.
- **Production-report correlation:** SharePoint v3 rewrite (week of Apr 4–10), Drive auth (Apr 18–24), Vertex AI, security hardening — all match her email output.
- **Trend:** → Steady. Email frequency dropped Mar→May (~2/wk → ~1/wk → silent in May) but meeting presence unchanged through May 6 — likely shift toward Slack/Zoom for internal comms.

#### Courtney McKlveen — ⚠️ Severely reduced / possibly departed

- **Volume:** **1 email** in 60-day window: gmail:ffc5c666 (Mar 12 — Re: Viant follow-up re: Jeremy at Field).
- **Meeting cadence:** **1 meeting**: fathom:5acf3317 ("Guy x Courtney", Mar 24, 29 min). Transcript enrichment status pending — content not readable.
- **Linear:** None. Drive: none. No feature-prioritization attendance in window.
- **Trend:** ↓↓ Two data points in first 16 days of window, then 45 days of silence.
- **Practical implication:** GTM function is Guy + **Cleverly** (paid outbound vendor — gmail:aebd2c5c). No internal GTM hire is operationally present.

#### Chris Baum — 🟡 Tapering

- **Volume:** 13 emails in window. Most recent: gmail:1a26080f (Apr 8 — Re: Feedback, asking about Fathom sync scope). Earlier: UX pass (Apr 3), Drive/SharePoint UX review (Apr 2), latency improvements (Mar 24), tech architecture (Mar 19, 24).
- **Meeting cadence:** Feature-prioritization regular through Apr 15 (fathom:c6977587 — last). 1:1 "Chris & Guy" calls Mar 27 (fathom:b2f39dd4), Apr 3 (fathom:c1270d2b), Apr 10 (fathom:91e40220), Apr 17 (fathom:de31c9f3), Apr 24 (fathom:408c4253 — last). **14 days of silence as of 2026-05-08.**
- **Trend:** ↓ March: weekly feature-prioritization + active threads. April: gradually fewer attendances; last email Apr 8; last feature prioritization Apr 15; last meeting Apr 24.

#### DreamLabs — Tomas Riegos, John Krueger, Mari Caraballo — ⚪ Dormant

- **Volume in window:** zero emails, zero meetings, zero other signals.
- **Last touch (out of window):** 100% designs delivered Dec 23, 2025 — gmail:fe438398. Mid-Dec invoice 218 paid.
- **Status:** Time-bounded engagement concluded. Component library remains in use; no retainer visible.

#### Efrat Oryan-Yogev — ⚪ Non-operational

- **Volume in window:** 2 outbound from Guy on Mar 2 (gmail:872a76c9, gmail:59fe0b31 — advising on her MBA framing, deck attached). No subsequent activity.
- **Meeting cadence:** Two back-to-back Mar 21 sessions — fathom:22d96bde (1h 3m) + fathom:c7c226f3 (1h 15m). Mar 24 demo includes her with Israeli network (fathom:3403a190).
- **Role:** Personal friend / namesake of Effi; running her own MBA project using AskEffi as case study (attachment:ec819888 — her EMBA deck casts her as "CEO", a case-study fiction, not org structure). Not an operational contributor.
- **Trend:** ↓ to zero by Apr 8.

#### External recruiters — Danny Salberg, Ziya Shaikh, Darshan — ⚪ Dormant

- **Single sprint:** Anuj Kumar AI-Architect interview Mar 11 (fathom:9004899b — enrichment failed); Nitsan post-interview feedback Mar 12 (gmail:f12f2c8b). Earlier: gmail:ac5f579a (Mar 11, CV request).
- **Note:** No inbound emails from the recruiters are indexed in this project — only Nitsan's outbound. Their ATS/LinkedIn Recruiter tooling is not indexable.
- **Status:** No new `@askeffi.ai` address has appeared since; no hire from this sprint is evident.

#### Cleverly — Alyssa Muth + John Duran — 🟡 Active vendor (newly surfaced)

- **Role:** Outbound email/LinkedIn lead-generation agency. Alyssa Muth = account strategist; John Duran = response handler.
- **Activity:** Active thread through gmail:aebd2c5c (Apr 24). Payment plan renegotiated in April — final $2,000 split into 4 monthly. 6-month engagement.
- **Significance for the audit:** With Courtney silent, **Cleverly is the only externally visible GTM support layer.** Guy runs all follow-up himself.

---

## History

```
2026-03-02 — Guy → Efrat: MBA framing advice, deck attached. Last indexed Efrat email contact. — gmail:872a76c9; gmail:59fe0b31
2026-03-11 — AI-Architect interview (Anuj Kumar). Nitsan + Oria + 3 recruiters. Recruiter sprint begins+ends. — fathom:9004899b
2026-03-12 — Nitsan post-interview feedback to recruiters. Last activity from this engagement. — gmail:f12f2c8b
2026-03-12 — Courtney's only email in window (Re: Viant / Jeremy at Field). — gmail:ffc5c666
2026-03-21 — Two back-to-back Efrat sessions (~2.5h total). — fathom:22d96bde; fathom:c7c226f3
2026-03-24 — Last Courtney touch: "Guy x Courtney" 29-min meeting. Transcript pending. — fathom:5acf3317
2026-03-24 — Mar 24 AskEffi demo with Efrat + Israeli network. — fathom:3403a190
2026-04-08 — Last Chris Baum email (Re: Feedback re: Fathom sync). — gmail:1a26080f
2026-04-15 — Last Chris Baum feature-prioritization attendance. — fathom:c6977587
2026-04-17 → 2026-05-01 — Three Epsilon feedback sessions; Nitsan + Oria + Lihu present each. — fathom (Epsilon series)
2026-04-24 — Last Chris Baum meeting (1:1 with Guy). — fathom:408c4253
2026-04-24 — Cleverly payment renegotiation; engagement continues as paid outbound vendor. — gmail:aebd2c5c
2026-04-27 → 2026-05-06 — Active core for feature prioritization stabilises at exactly Guy + Lihu + Nitsan + Oria. — fathom (multiple)
2026-04-29 — Last Oria email in window (Drive auth issue). — gmail:6de3a427
2026-04-30 — Nitsan receives standing Mon/Thu feature-prioritization invite. — gmail:cf240380
2026-05-02 → 2026-05-08 — Highest engineering velocity week in the window: 966 commits. — gmail:dfc148ba
2026-05-06 — Last full team meeting in window (Guy + Lihu + Nitsan + Oria). — fathom:c12a3f81
2026-05-06 — Lihu + Guy demo with Muli (~59 min). — fathom:abac996b
2026-05-08 — Lihu's weekly production report sent; Nitsan acknowledges. — gmail:dfc148ba; gmail:e3988183
```

---

## Conflicts to flag

**A — "Team includes a GTM lead."** Courtney has been silent for 45+ days (last touch 2026-03-24). GTM is being carried by Guy + Cleverly (paid outbound vendor). Any deck or framing that names Courtney as an active operator is stale. — gmail:ffc5c666; fathom:5acf3317; gmail:aebd2c5c. (Reinforces team.md Conflict E.)

**B — "Chris Baum is the design lead."** No emails since Apr 8; no meetings since Apr 24. Two-plus weeks of silence as of 2026-05-08. The Apr 2026 deck framing him alongside paid contributors over-states current involvement. — gmail:1a26080f; fathom:408c4253. (Reinforces team.md Conflict D + status note.)

**C — "DreamLabs designed the product."** Engagement closed Dec 23, 2025. Zero activity in the 60-day window. Component library remains in use, but the agency relationship is past-tense. — gmail:fe438398.

**D — Efrat-as-CEO MBA artefact.** A pitch deck in the project's attachments (attachment:ec819888) shows Efrat as "CEO" of AskEffi — this is her MBA case-study framing, not the real org chart. Read out of context it could mislead a downstream reader.

**E — "Adding a key technical hire" (April deck).** The AI-Architect search produced one indexed interview (Mar 11) and no follow-on activity. No new `@askeffi.ai` address has appeared. The April deck claim of an in-progress senior hire (attachment:f9ef084d via team.md Conflict C) is not supported by activity data either.

---

## Gaps

**G-1** — **Internal Slack / UseGin / dx-slack are unreadable to Effi.** The slack-work-status file (file:2347ede4) explicitly flags this. A large body of team decisions and code-review chatter happens there. Active-vs-quiet readings on the engineering team should be treated as floor estimates.

**G-2** — **Git commits are not per-author attributable.** 3,294 commits across 5 weeks are visible in aggregate via production reports (drive: production-week-* series); individual ownership is not indexable.

**G-3** — **Courtney's status is unannounced.** No departure email, no transition note, no hand-off in indexed sources. The activity gap is unambiguous; the *reason* is not.

**G-4** — **Personal channels for Guy, Lihu, Efrat (WhatsApp / Hebrew personal networks).** Significant relationship-development happens off-channel and is invisible.

**G-5** — **Cleverly's response tracker** lives in Cleverly's external tools — outbound results (responses, meetings booked) are not indexed.

**G-6** — **DreamLabs deliverables** (Figma + Notion dashboard) are not indexed; we cannot tell whether any post-Jan touchpoint occurred without going to the source systems.

**G-7** — **Recruiter ATS / LinkedIn Recruiter pipelines** for the AI-Architect search and any subsequent sourcing are not indexed.

**G-8** — **Mar 24 "Guy x Courtney" transcript** (fathom:5acf3317) has enrichment status pending; the substance of the last indexed Courtney conversation is not readable.

**G-9** — **Lihu's personal Gmail (lihu.berman@gmail.com)** appears on calendar invites; emails sent only to that address are not in the project index.

---

## See also

- [team](team.md) — role/status classifications and per-person background
- [founders](founders.md) — Guy + Lihu specifically
- [design-partners](design-partners.md) — partner-side activity (Mkenga, Epsilon, Critical Loop) drives much of Guy's hyperactive cadence
