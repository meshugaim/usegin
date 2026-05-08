---
topic: competitors
moc: market
updated: 2026-05-08
conflict_pending: false
---

# Competitors & alternatives

Every company or product that has been raised as a competitor or comparable to Effi — by Guy, by prospects, by investors, or in the indexed pitch material. Includes deck-level competitive map, per-company differentiation, and the "no direct competitor" claim's known weaknesses.

## Current — canonical positioning (May 2026 deck)

The May 2026 investor deck (attachment:e7da01c3) places Effi at the intersection of three "crowded adjacent spaces":

1. **Company Productivity / Executive Oversight**
2. **Project Management**
3. **Buyer/Seller Collaboration**

Effi claims **"No direct competitor in that space"** at this intersection. The deck competitive map is a 2×2 — Effi sits in the *Executive Control × Cross-Company Execution* (or in some versions *Niche Use Case × Executive Level*) quadrant; everything else falls outside.

**Important caveat:** Qubit Capital's 2026-04-29 deck review (attachment:ef98142b) specifically recommended changing this language because *"'No direct competitor' can sound overclaimed,"* suggesting *"No single category owns this intersection today."* Treat the *"no direct competitor"* phrasing as a positioning choice with known weaknesses — see Conflict A.

---

## Per-competitor map

Grouped by category. Names in **bold** are mentioned by Guy directly; *italicised* are surfaced only by third parties (prospects, investors, market analysts).

### Generic AI copilots / platform incumbents — the existential-threat category

#### Microsoft Copilot (incl. Teams)
- **What it does:** AI assistant in Microsoft 365 — queries data the user has personal access to (email, SharePoint, Teams meetings they attended).
- **Effi's stated diff:** Copilot is **scoped to data the user has personal access to** — *"if it's in your mailbox or on your SharePoint, it will give you an answer. If it was a meeting that you were not in, it will not"* — Guy 2026-05-06, fathom:c12a3f81. Doesn't handle cross-company. Reactive only, no proactive risk-alerting. No client-safe external-sharing / dual-agent architecture.
- **Guy's internal candor:** *"Copilot sucks, but let's say… currently you can't because of access control"* — fathom:15ff5eb5 (2026-04-17, Vignesh). And: *"it's not defensible to say we're building something because they don't have their act together, like they'll have their act together"* — fathom:2b6bdd62 (2026-04-24, Elsante).
- **Fear level: high.** Most-commonly-raised investor risk. Zach Jaffe (Glasswing): firm *"had looked at similar solutions in the past but ultimately decided to wait for Microsoft or other large players to build something similar"* — gmail:9af910fa (2026-02-09).
- **Distribution analogy:** Jonathan Wu 2026-03-05 — *"Teams is not as good as Slack, but… once they turn it on, it's just there for everyone."* Guy: *"Exactly, yes."* — fathom:a6e413e7.

#### Google Gemini
- Same category as Copilot — broad enterprise AI in Google Workspace. Same diff arguments — no cross-company collaboration, generic not project-scoped, complex access control. *"Currently, they haven't [solved it]"* — fathom:c5584cce.
- Qubit Capital's recommended pitch action: *"Reframe the deck around investor risk: why now, why this team, why not solved by Copilot / Gemini"* — attachment:ef98142b / attachment:7218f2cb.

#### ChatGPT / OpenAI
- Anyone pasting meeting notes/docs into ChatGPT for project Q&A is a DIY substitute.
- **Effi's diff:** access control + project-scoped ingestion + dual-agent. *"currently you can't [do it with Claude/ChatGPT] because of access control. You just don't have, you're the executive, you're not in the emails, you're not in the meetings"* — Guy 2026-04-17, fathom:15ff5eb5.
- Deck: bundled in *"Generic AI Agents (ChatGPT, Notebook LLM, Glean)"* on the team-level / generic-use-case quadrant.

#### Glean
- Enterprise AI search — indexes all internal data across an org.
- **Effi's diff:** cross-company not designed in; too broad / not project-scoped (security risk of cross-department exposure); complex access control at enterprise scale. — attachment:560e52be.
- **Real-world data:** Poorvi Shrivastav (ex-Meta, 2025-12-05) — *"we were implementing Glean [at Meta], and then we were like, don't want it anymore."* Guy: *"Again, I was at Meta, Glean did not solve it."* — fathom:2617b30a.
- **Squeeze risk Guy himself names:** *"if they just become good enough or Glean becomes good enough for a general use case… will somebody pay extra because, oh, you can also share with a client? Fine, I'm not paying for that"* — fathom:64868e2d (2026-02-09, Zach Jaffe).

#### Google NotebookLM
- *"Common objection: 'We can build it ourselves' or 'Can't we just use NotebookLM?'"* — attachment:560e52be.
- **Effi's diff:** no sharing capabilities, no automated ingestion (manual upload), no dual-agent, no ongoing workflow integration.

### Project-scoped enterprise AI — the structurally-similar category

#### Atlassian Rovo (Jira/Atlassian ecosystem)
- AI agent layer over Jira/Confluence + connectors. Described by a prospect as *"a pretty complete set of use cases and integrations."*
- **Effi's diff (per prospect feedback Guy relayed 2025-11-14):** *"still feels 'stitched' compared to what we are doing"*; *"need to auto refresh content"*; *"limited to information you have access to"*; *"no client-facing aspects"* — gmail:52c217b1.
- **Guy internal candor:** *"there's a chance that Rovo solves 60% of their needs, which raises the question of whether it will be valuable for them to pay extra for a perfect solution"* — gmail:52c217b1.
- **Deck:** Jira/Asana/Monday in the "PM Tools" cluster (team-level / generic). Rovo not called out by name. Treat as undersold relative to Guy's private assessment — see Conflict D.

#### Tato (the closest-direct competitor)
- *"AI-native project intelligence for ERP / IT implementation delivery."* — Qubit Capital (attachment:7218f2cb).
- **Traction:** $5M seed 2025-09-30.
- **Effi exposure:** Surfaced only by Qubit's market analysis. **No email, meeting, or positioning document where Guy responds to Tato exists in indexed data** — see Gap 1.

#### Axiomatic
- *"tried to do the same thing, but for the CIO… a CIO that is doing the ERP and getting all the pressure"* — Guy 2026-03-18, fathom:b9151c1e.
- **Traction:** *"I just saw, raised $54 million."*
- **Effi position:** acknowledged related but for CIO; Effi's wedge is the consultancy side. No further follow-up indexed.

### Project / task management

#### Jira / Asana / Monday / Notion
- **Effi's diff:** *"I'm yet to see an executive going to JIRA when there's an escalation"* — fathom:8f6aec6b; fathom:c12a3f81. Task trackers show *"WHAT needs to be done, but not WHY decisions were made"* — attachment:560e52be. *"You can't ask Asana 'Why did we approve that discount?'"* — same. No client-safe external sharing. No queryable decision history with citations.
- **Deck:** *"PM Tools (Jira, Asana, Monday)"* in team-level / generic quadrant. Some versions add Notion.

### CRM / messaging incumbent claims

#### Salesforce / HubSpot / Slack
- Salesforce claims Slack does it. *"Salesforce claim that Slack does it, but not quite"* — fathom:2617b30a (2025-12-05). After direct testing 2026-04-24: *"Salesforce and Slack keep touting about how Slack AI is super powerful… I would expect that Slack would just do it. And it sounds like they suck."* Elsante confirmed: *"[Slack] doesn't summarize as well."* — fathom:2b6bdd62.
- **Diff:** No client-facing agent — *"I don't know what it means to even give HubSpot to your client"* — fathom:34a02f0a (2025-12, Ben Green). Access control for external parties is a CRM design gap.
- **Deck:** Salesforce in some versions as a separate CRM bubble (team-level / niche-use-case).

### Note-takers (Effi sits on top, not against)

#### Gong
- *"Gong is a note taker… we will see it on top of gong in that view. Like, we're not building a note taker"* — Guy 2026-05, fathom:8f6aec6b.
- **Deck:** *"Note Takers (Gong, Fathom)"* — team-level / niche quadrant.

#### Fathom
- AskEffi uses Fathom as its first meeting integration. Fathom's *"Ask Fathom"* gives Q&A on a single call.
- **Effi's diff:** Fathom is scoped to individual calls; Effi unifies across calls + emails + docs and crosses companies. Andrea Jones articulation 2026-02: *"What I'm hearing you say is it will be able to do that kind of Q&A across all of the things"* — fathom:35548745.

### Pre-sales / deal-context platforms

#### Opine (tryopine.com)
- Pre-sales engineering AI. *"Turn scattered conversations and documents into living account plans, proactively surfaces blockers, and automates repetitive work."* Targets revenue leaders / SEs / AEs / customer success.
- **Traction:** $2M pre-seed/seed (Feb 2024 / Sep 2024). 2-10 employees. Durham/Raleigh NC. Founders: Akash Ganapathi (CEO), Austin Kelleher, Charlie Duong (ex-JupiterOne).
- **Overlap:** deal-context aggregation + executive dashboards + buyer-seller alignment + pilot/POC management.
- **Effi's diff:** Opine = pre-sales; Effi = post-sale project delivery. Guy 2025-11-25: *"They claim to focus on pre-sale engineering, but ultimately it ends up being a similar offering"* — gmail:b2c29ee6. Internal note: *"potentially a partner or acquisition target depending on positioning."*
- **Indexed follow-up gap:** Guy said 2025-11-25 he had a customer call with Opine's customer scheduled the following week. **No outcome of that call is indexed** — see Gap 3.

#### Mash (linkedin.com/company/mash/)
- Insufficient data. Guy 2025-11-13: *"Not exactly the same, but the closest I've seen so far"* — gmail:deb0716c. Guy knows the founder (worked together at Google). No subsequent follow-up.

#### Accord
- Mutual-action-plan tool for complex enterprise sales. Lindsay Lee (Authentic Ventures, 2025-12-05): *"we essentially get everyone involved right at the outset, create a much smoother path to getting closed"* — fathom:047dd89b. Lindsay called out a *"similar sensibility"* to Effi.
- **Status:** Not named in any Effi deck. Surfaced only by external party (gmail:90f64eb5).

### Customer-success / digital deal rooms

#### Gainsight / Everafter / Aligned
- **Deck:** *"Niche players — Deal rooms, customer success platforms (Gainsight, Everafter, Aligned)"* — team-level / niche.
- **Effi's diff:** team-level workflow tools; lack executive oversight, cross-company project intelligence, decision capture.
- **Indexed reality:** none of the three has been compared to Effi in any meeting, email, or document — they appear to fill out the deck map rather than reflect real competitive friction. See Gap 7.

### ITSM / observability / governance — adjacency raised by Keren Michaeli (2026-04)

Surfaced by Keren in a 2026-04-23 email (gmail:aca0d01f) requesting Guy's competitive position on:

- *ServiceNow* (ITSM / enterprise workflow) — also raised by Navin Parmar 2026-03-16 (fathom:3125b832) with example of a ServiceNow customer trying to build a Fathom-like AI inside ServiceNow.
- *Atlassian* (general, beyond Rovo).
- *Datadog* / *Dynatrace* / *BigPanda* (AIOps).
- *Credo AI* (AI governance).
- *BMC Helix* / *Freshservice* (ITSM).

**Status:** Email forwarded to Effi inbox 2026-04-23. **No indexed response from Guy exists.** See Gap 4.

### Construction-vertical tools (encountered via Curtis Partition / Ajay Narula 2025-12-10)

- *Procore* — *"the biggest project management software in construction"* per Ajay (fathom:9154723a). Effi sits alongside or on top of, not replaces.
- *Track3D* — physical-site AI (360-camera walks). Ajay invests in it. Caused Curtis Partition's withdrawal (see [design-partners](design-partners.md)).
- *Togal.AI* — AI estimating tool.
- *Cantata* — PM tool used by elevator/field-service consultants. Salesforce-connected. Landon deVille 2026-04-30: *"a project management tool, identify projects, time and expense, but it doesn't have anything sophisticated like what I'm talking about"* — fathom:e33cdb49.

### Adjacent recent fundraises (Qubit Capital market context, 2026-05-01)

From attachment:7218f2cb — *not* in Guy's competitive intelligence; Qubit's framing.

| Company | Raise | Description |
|---|---|---|
| **Honeyjar AI** | $2M pre-seed (2025-12-04) | "AI operating system for communications workflows and enterprise expansion" |
| **Empromptu** | $2M pre-seed (2025-12-09) | "Enterprise AI app-building platform with governance and reliability focus" |
| **SydeLabs** | $2.5M seed (2025-11-29) | "Enterprise GenAI risk-management platform" |
| **RobosizeME** | $2M seed (2026-02-25) | "AI workflow automation for operationally complex enterprise environments" |

---

## Official competitive matrix (May 2026 deck)

Source: attachment:e7da01c3 + attachment:560e52be (*"Effi filling Cleverly's questions"*, Feb 2026).

| Capability | Task Trackers (Jira/Asana) | Enterprise AI (Glean/Copilot) | In-House (NotebookLM) | AskEffi |
|---|---|---|---|---|
| Captures business context (*"why"*) | ✗ | Partial | ✗ | ✅ |
| Client-safe external sharing | ✗ | ✗ | Complex | ✅ |
| Project-scoped with simple access control | N/A | ✗ | ✅ | ✅ |
| Queryable decision history with citations | ✗ | Partial | ✗ | ✅ |
| Integrates with existing workflows | Partial | Partial | ✗ | ✅ |
| No-code, fast deployment | ✅ | Partial | ✗ | ✅ |
| Proactive risk alerts (roadmap) | ✗ | ✗ | ✗ | ✅ |

---

## History

```
2025-11-13 — Guy team email "Found a competitor!" — Mash. Knows founder from Google. Not exactly the same; closest seen so far. — gmail:deb0716c
2025-11-14 — Guy team email "Found a bigger one" — Atlassian Rovo. Customer-call feedback: feels stitched, lacks auto-refresh + client-facing. Internal worry: "Rovo solves 60% of their needs." — gmail:52c217b1
2025-11-25 — Guy team email "Another competitor - Opine." Pre-sales focus but "ultimately a similar offering." Plans customer call following week. — gmail:b2c29ee6
2025-12-05 — Poorvi Shrivastav meeting. Glean directly discussed; Meta tried + abandoned. Guy: "Glean did not solve it." Also Guy's first internal candor: "It is non-defensible." — fathom:2617b30a
2025-12-05 — Lindsay Lee (Authentic Ventures) introduces Accord (her portfolio); notes "similar sensibility." — fathom:047dd89b
2025-12-08 — Quad demo. George (prospect) raises Teams. Guy lists full competitive set: "Microsoft, Jira, Asana, Salesforce and Slack, OpenAI, Gemini." — fathom:c5584cce
2025-12-09 — Ben Green meeting. Salesforce / Slack / Jira / Monday / OpenAI / Gemini / NotebookLM all named "in the vicinity." Frames client-facing as the diff. — fathom:34a02f0a
2025-12-10 — Ajay Narula (construction) meeting. Procore + Track3D + Togal.AI named. — fathom:9154723a
2025-12-11 — Jon meeting #2. The "good enough" platform threat is articulated explicitly. Guy: "I want to get to the data." — fathom:5df39ed9
2025-12-12 — Mark Prince. Guy: "everybody who sits on a database these days is building an agent on top of this database… I want to be the periphery of the universe." — fathom:68b6e10e
2026-02-09 — Zach Jaffe (Glasswing) meeting. Glasswing "decided to wait for Microsoft." Guy reframes defensibility around client-facing + organizational insights. Opine named as "one of the few that are niche." — fathom:64868e2d / gmail:9af910fa
2026-02-18 — MoVi Partners meeting recap. "Effi hasn't directly encountered competitors doing exactly what they are building." — gmail:930af21b
2026-03-05 — Jonathan Wu meeting. "the most common competitor we're hearing is notebook LLM or copilot." Teams/Slack distribution analogy. — fathom:a6e413e7
2026-03-16 — Navin Parmar meeting. ServiceNow introduced as potential AI-on-existing-data threat. — fathom:3125b832
2026-03-18 — Cem Garih meeting. Axiomatic's $54M raise mentioned in passing (CIO-focused). — fathom:b9151c1e
2026-04-16 — Keren Michaeli meeting (Hebrew). ServiceNow / Atlassian / Datadog / Credo AI raised as adjacent. — fathom:f1c853d0
2026-04-17 — Vignesh Ravikumar meeting. Clearest competitive view: "The main competition we see is actually just the regular tools." Cross-company = "nobody's in that category." — fathom:15ff5eb5
2026-04-22→23 — Keren Michaeli formal competitive analysis email. Lists ServiceNow / Atlassian / Datadog / Credo AI / Dynatrace / BigPanda / BMC Helix / Freshservice. Forwarded to Effi inbox 2026-04-23. **No indexed Guy reply.** — gmail:aca0d01f
2026-04-24 — Elsante meeting. Slack AI tested → "useless." Guy: "it's not defensible to say we're building something because they don't have their act together." — fathom:2b6bdd62
2026-04-29 — Qubit Capital deck review. Recommends reframing "No direct competitor" → "No single category owns this intersection today." — attachment:ef98142b
2026-04-30 — Landon deVille meeting. Cantata named as elevator-consulting PM tool. — fathom:e33cdb49
2026-05-01 — Qubit Capital fundraising strategy report. Tato ($5M seed Sep 2025) named as closest direct competitive raise. Honeyjar / Empromptu / SydeLabs / RobosizeME named as adjacent recent fundraises. — attachment:7218f2cb
2026-05-06 — Internal product meeting. Guy reiterates Copilot limitation: "they were not in the meetings or on the emails." — fathom:c12a3f81
2026-05-07→08 — Latest investor deck (May 2026 version) circulating. Salesforce now its own CRM bubble (was bundled in PM Tools). — attachment:e7da01c3
```

---

## Conflicts to flag

**A — *"No direct competitor"* claim vs. Tato + Axiomatic.** Decks (all versions, latest attachment:e7da01c3) say *"No direct competitor in that space."* Reality: **Tato** ($5M seed 2025-09-30, "AI-native project intelligence for ERP / IT implementation delivery" — attachment:7218f2cb) and **Axiomatic** ($54M raise, CIO-focused ERP oversight — fathom:b9151c1e) are operating in the same ERP/IT project space. Qubit Capital's own deck review (attachment:ef98142b) called the phrasing *"overclaimed"* and recommended *"No single category owns this intersection today."*

**B — Defensibility framing: external pitch vs. internal candor.** Decks: cross-company architecture is *"unique, defensible differentiator"* + *"data moat."* Internally Guy has said:
- *"It is non-defensible. So if I can put… everybody's building some AI agent on top of a database. There's nothing unique there"* — fathom:2617b30a (2025-12-05).
- *"it's an agent on top of a rug… easy to build, easy to replace"* — fathom:68b6e10e (2025-12).
- *"it's not defensible to say we're building something because they don't have their act together, like they'll have their act together"* — fathom:2b6bdd62 (2026-04-24).

The deck positions phase 1 as defensible; Guy's private view is defensibility depends on surviving long enough to build a phase-2 data moat from accumulated project intelligence.

**C — Glean: *"didn't solve it"* vs. Glean-could-squeeze-us-out.** Used as evidence of market opportunity (Poorvi/Meta, fathom:2617b30a). But same Guy: *"will somebody pay extra because, oh, you can also share with a client? Fine, I'm not paying for that"* (fathom:64868e2d). Deck presents Glean as definitionally unable; unguarded statements treat it as a live squeeze risk.

**D — Atlassian Rovo as *"60% solution"* — acknowledged in email but absent from deck.** Guy 2025-11-14 (gmail:52c217b1): *"there's a chance that Rovo solves 60% of their needs."* Deck buckets Jira/Atlassian as generic *"PM Tools"* with no acknowledgement that Rovo is an AI agent layer. The deck undersells Rovo.

**E — *"Buyers couldn't compare Effi to an existing tool"* (deck learning) vs. Opine + Accord.** Deck includes this as a key product learning to justify Land & Expand. But Guy's own emails identify Opine and Accord as structurally similar tools, and Glasswing's Zach Jaffe said his firm previously looked at *"similar solutions."* The *"new category"* framing is a positioning choice, not an objective claim of uniqueness.

---

## Gaps

**1 — Tato follow-up.** Most directly competitive named raise. **Surfaced only by Qubit Capital's external analysis. No email from Guy researching Tato; no meeting where it came up; no positioning document.** Wide-open gap.

**2 — Axiomatic follow-up.** Mentioned in passing 2026-03-18; no further indexed mention. $54M and CIO-focused.

**3 — Opine customer-call outcome.** Guy 2025-11-25 said he was scheduled to talk with one of Opine's customers "next week"; no indexed report-back exists.

**4 — Keren Michaeli competitive-analysis email reply.** Asked for additional closest competitors + a competitive landscape slide + a strategic view on partner-vs-competitor for ServiceNow/Atlassian/Datadog/Credo AI. Forwarded to Effi inbox; no indexed Guy reply.

**5 — No win/loss data.** Cleverly's questions document itself (attachment:560e52be) flagged: *"Minor gap: no direct competitive win/loss data or customer comparison quotes."* No indexed customer chose Effi *because of* a head-to-head vs. Copilot/Glean/Rovo, or chose those over Effi.

**6 — *"Viv"* unresolved reference.** Phrase *"Glean, Viv, Microsoft Copilot, Google Gemini"* appears in attachment:560e52be. Nowhere else in indexed data. Possibly Microsoft Viva, possibly OCR artifact.

**7 — No analysis of Gainsight / Everafter / Aligned as threats.** Placed on the deck competitive map but no email/meeting/document where Guy discusses what specifically they do wrong, or whether any prospect compared Effi to them.

**8 — Construction vertical lacks competitive analysis.** Beyond Procore (and Ajay's bias toward Track3D), no Effi-specific positioning vs. Autodesk Build, Buildertrend, etc. As Effi pursues construction (Schindler, elevators, Matt McQuillen), gap will become material.

**9 — ServiceNow threat never responded to in writing.** Came up Mar (Navin) and Apr (Keren). Guy has spoken about it in meetings but no indexed email or document where Effi's positioning against ServiceNow is articulated.

---

## See also
- [positioning](positioning.md) — public-facing one-liners and stable angles
- [icp](icp.md) — target customer / wedge framing
- [raise](raise.md) — Qubit Capital is the source of the closest direct-competitor data (Tato)
- [data-sources](data-sources.md) — what Effi actually has wired vs. what generic AI tools can see
