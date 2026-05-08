---
topic: financials
moc: company
updated: 2026-05-08
conflict_pending: false
---

# Financials

## Current — money in, money out (as of 2026-05-08)

**Capital position:** No external capital received. **All operating capital is Guy Levit's personal investment via MFN SAFE.** Round in flight is **$2M pre-seed SAFE** — see [raise](raise.md).

**No bank balance figure** appears anywhere in indexed data. Closest proxies:
- Guy 2026-04-17 to Chandra: *"in six months, I spent $150,000 on this company"* — fathom:8e3dc338.
- Burn ceiling stated same meeting: *"$300K a year… let's say $400K to be conservative"*.
- Founder personal-spend cap: *"there's also a limit on how much money I'm willing to put in my own company. It's a high-risk, non-diversified experience… there's a chunk that I can put there. And beyond that, I'm not putting in my own company."* — fathom:0c6d9496 (2026-04-29).

**Revenue: pre-revenue.** Zero confirmed paying customers in indexed data. One Fathom summary (entity 5b6d7a5c) claims *"5 design partners so far, with 3 paying and 3 non-paying"* but the arithmetic doesn't add up (3+3≠5) — treat as internally inconsistent. Guy 2026-02-12 to Carta: *"No revenue, and the company burned some cash since the last 409A"* — gmail:388627d4. See [design-partners](design-partners.md): no partner has transitioned from free to paid in indexed data.

| | Detail |
|---|---|
| **Burn rate** | $25K–$33K/mo measured ($150K ÷ 6 mo = $25K, plus *"$400K conservative ceiling"* = $33K). Conservative ceiling represents anticipated growth, not current operations. |
| **Salaries paid** | "Three people get salary" — engineers in Italy / Spain / Israel. Guy: $0. |
| **Anthropic API (customer-facing)** | *"$90 cumulative"* on customer-facing projects per Guy (2026-04-17). Caveat: API credits have been depleted **4 times** between 2026-01-16 and 2026-04-08 (gmail:d0dbf37c / d7dafa02 / f9c935ba / 011e8ded), so total Anthropic spend is meaningfully higher than $90 — see Conflict C-5. |
| **Per-project token ceiling** | *"$100/month per project"* — Guy 2026-04-17. |
| **Team Claude subscriptions** | *"$800 a month"* — Guy 2026-04-17. Ambiguous: could be $800 total / month for the team, or per-seat figure across multiple seats. |
| **Bookkeeping** | Pilot.com — $239/mo (annual plan with 20% partner discount; standard $299/mo) + $52/mo QuickBooks Online + $299 onboarding + $750 (2025 corporate tax) + $500 (Form 5472) = ~**$3,580/yr**. — gmail:178b1efd. |
| **Cap-table / 409A** | **Carta Grow plan** (Nov 2025) — Carta does 409A, options, cap table. Monthly cost not indexed. — gmail:30cc93ab. |
| **Bank** | **Mercury** — confirmed in Pilot onboarding + Nitsan + Oria payment setup. |
| **Hosting** | **Railway** — named in multiple production-week reports. Billing amounts not indexed. |

### Compensation (per person)

| Person | Rate | Source |
|---|---|---|
| **Guy Levit** | $0 — *"I don't take salary. I don't want to contribute to the burn"* | fathom:8e3dc338 |
| **Lihu Berman** | **Not indexed.** No record of salary or its absence | (gap — see G-3) |
| **Oria Meses** | Phase 1 (Jan–Mar 2026): **$2,700/mo**. Phase 2 pre-raise: **$4,000/mo**. Phase 2 post-raise: **$70K/yr + social benefits + 0.2% options** (4-yr vest, 1-yr cliff) | gmail:affb9ed0 (Lihu→Oria 2025-12-29 *"Compensation Terms"*) |
| **Nitsan Avni** | **Specific amount not indexed.** Mercury bank set up; W-8BEN filed | gmail:6ebb79c8 / fd77439e |
| **Courtney McKlveen** | **Revshare only** — *"I told her she should find something else that pays the bill"* until revenue | fathom:047dd89b (Lindsay Lee meeting 2025-12-05) |

**Equity-for-salary swap proposal (2026-04-29):** *"Leo told me that our burn can even get lower because one of our engineers was like, 'I'll take equity over money. Can I convert my entire pay to equity?'"* — fathom:0c6d9496. **Conversion not confirmed as executed.** Engineer not named (most likely Oria given the timing aligns with the Phase 2 transition).

### Founder self-investment

- **$20,000 wired ~2025-12-20** by Guy. Initially booked as APIC (Additional Paid-In Capital) **without a formal agreement** — flagged by Pilot as IRS risk: *"Without a SAFE or loan agreement, the IRS could treat the funds as a taxable gift to the company"* — fathom:93a7b6b1 / fathom:f164f933. Intended to convert to MFN SAFE retroactively.
- **$80K additional planned** by Q1 2026 via MFN SAFE — gmail:3d54c01f (Guy → tax@pilot.com 2026-01-06). **Whether this was executed is not confirmed in indexed data.**
- **Total personal investment ~2026-04-17:** at least $100K-$150K (the $150K figure likely includes both founder transfers and operating expenses paid from that capital).
- **Structure:** MFN SAFE (Most Favored Nation). *"I'm an investor in the company, so I have MFN safe, so I'll get whatever terms the institutional investors get"* — fathom:0c6d9496.

### Equity (what's indexed)

- **Oria Meses** — 0.2% fully diluted in options, 4-year vest, 1-year cliff (post-raise) — gmail:affb9ed0.
- **Nitsan Avni** — *"some expiration for some options"* mentioned in passing; *"if you joined in 18 months, you will get more. If not, it expires"* — fathom:047dd89b. **No specific percentage indexed.**
- **Courtney McKlveen** — revshare only; no specific equity percentage indexed.
- **Founders' split** — not disclosed in any indexed source. Form 5472 requirement (for foreign founder holding >25%) **implies Lihu holds ≥25%**.

### Investor pitch — money math

| Figure | Source |
|---|---|
| Pre-seed round target | $2M SAFE — see [raise](raise.md) |
| Round-must-prove | >50 customers / >$1.2M ARR / <$8K CAC / >5 via network — see [north-star](north-star.md) |
| Capital allocation | *"40% of funding dedicated to optimizing the GTM playbook and cross-company expansion"* — attachment:e7da01c3. Implies ~$800K of $2M to GTM, ~$1.2M to product/ops |
| Qubit-stated runway | *"18–24 months"* on $2M — attachment:7218f2cb |
| Guy-stated runway (pitched to Chandra) | *"a couple of millions from VCs… run rate for three years"* — fathom:0c6d9496 (2026-04-29) |
| Implied post-raise burn | At Qubit's 18-24mo: $83K–$111K/mo (2.5–4× current). At Guy's 3yr: ~$56K/mo. **No explicit headcount or vendor budget breakdown for post-raise state is indexed.** |
| Customer-pain frame | *"~$100K per escalation in unbillable time and make-goods"* | gmail:7a3b78c5 |
| ROI frame at scale | *"$50M consultancy may lose $1–$2M profit margin"* from escalations; *"$50K/year AskEffi offers 10x ROI even at low adoption"* — same |

- Source for the picture: fathom:8e3dc338 (Chandra-Guy demo 2026-04-17 — the most detailed single financial disclosure), fathom:0c6d9496 (Chandra/Guy 2026-04-29), gmail:affb9ed0 (Oria comp terms), gmail:178b1efd (Pilot proposal), gmail:30cc93ab (Carta), gmail:3d54c01f (founder SAFE intent), attachment:e7da01c3 (May 2026 deck), attachment:7218f2cb (Qubit fundraising strategy 2026-05-01).
- Last verified: 2026-05-08

---

## History

```
2025-11-13 — Incorporation papers received. Guy → Carta same week to set up equity. — gmail:ec0b2ef5
2025-11-14 — Carta engagement; plan: 409A → engineer options → founder funding. — gmail:ec0b2ef5 / gmail:30cc93ab
2025-11 — Pilot.com bookkeeping engagement begins (Pilot proposal). — gmail:178b1efd
2025-12-01 — First 409A delivered by Carta. — gmail:388627d4
2025-12-05 — Lindsay Lee meeting: Guy unpaid; Lihu/Nitsan working; Courtney revshare. — fathom:047dd89b
2025-12-10 — Guy starts first Claude Pro subscription. — gmail:70a0cc24
2025-12-17 — Internal "Design Partner Status" team email: 4 confirmed + 2 strong-interest; *"contract sizes are smaller than target in steady state"*; plans Europe-based engineer hire. — gmail:d4ef793f
2025-12-18 — Guy/Courtney fundraising strategy meeting: $3M pre-seed vs. $5M seed undecided; "start at $3M, expand to $5M if demand high." Pricing pivot: per-project → flat $500/mo for 5 projects (under-corporate-card-threshold). — gmail:ed54dd8e
~2025-12-20 — Guy wires $20K to company. Booked APIC without formal agreement. — gmail:3d54c01f (Jan 6 email re: this)
2025-12-29 — Lihu sends Oria compensation terms (Phase 1/2 pre-raise/2 post-raise). — gmail:affb9ed0
2026-01-06 — Guy → tax@pilot.com: states intent to wire $80K MFN SAFE by Q1 end; asks tax-compliant structure for the existing $20K. — gmail:3d54c01f
2026-01-15 — Pilot.com bookkeeping onboarding confirmed. First books delivery target ~2026-01-30. — gmail (multiple Pilot threads)
2026-01-16 — Anthropic API credits depleted (#1). — gmail:d0dbf37c
2026-01-23 — Internal meeting: design-partner payment model — free 4 weeks → paying after integrations built. Brock (AlignOrg) objects to committing payment before testing. — gmail:9e9be8d9
2026-01-29 — Nitsan Mercury setup; W-8BEN required. — gmail:6ebb79c8 / fd77439e
2026-01-30 — Pilot delivers first draft books (Nov–Dec 2025). Guy catches a $123.74 fraudulent expense → disputed. — gmail:9287d749
2026-02-09 — Anthropic API credits depleted (#2). — gmail:d7dafa02
2026-02-12 — Guy → Carta 409A team: *"I funded the company by 20K (MFN SAFE). No revenue."* Asks if 409A refresh needed before issuing more options. — gmail:388627d4
2026-03-22 — Second Claude Pro subscription started (renewal or additional seat). — gmail:145ac345
2026-03-31 — Anthropic API credits depleted (#3). — gmail:f9c935ba
2026-03-31 — Formus Capital pre-meeting prep. Pitch: *"$2.5M pre-seed round to fund the path to a $0.7M ARR seed round milestone"* (~30 customers). — gmail:d3c324ab (fathom.video/calls/612112862)
2026-04-07 — Formal fundraising outreach begins (Eli Dubnov / Entrée Capital + Vignesh Ravikumar / Sierra Ventures). Deck attached. — gmail:53af7afd / 02e9173d
2026-04-08 — Anthropic API credits depleted (#4). — gmail:011e8ded
2026-04-09 — April investor deck distributed. — attachment:63a30ca9
2026-04-17 — Chandra-Guy demo. Most-detailed financial meeting on record:
              - $90 cumulative tokens on customer-facing projects
              - $150K spent in 6 months
              - $300K burn / $400K conservative ceiling
              - 3 salaried people (Italy / Spain / Israel)
              - Guy unpaid
              - $800/mo Claude subscriptions for team
              - $100/mo per-project token ceiling
              — fathom:8e3dc338
2026-04-23 — Construction-vertical customer deck created. — attachment:e38910cb
2026-04-24 — Chris Baum meeting. Anticipated ACV $20K-$50K. *"Two or three large companies and I can pay salaries."* Pricing framed ~$1,000/yr/project. — fathom:408c4253
2026-04-29 — Chandra follow-up meeting. *"One engineer offered to convert entire salary to equity"*; angels-first MFN-SAFE strategy emerging; *"raise a couple of millions from VCs… run rate for three years."* — fathom:0c6d9496
2026-04-30 — Qubit Capital fundraising-support meeting. — gmail:61b9f5fa
2026-05-01 — Qubit delivers fundraising strategy report: $2M pre-seed SAFE; 587 mapped investors; $3,700 platform fee + 4% success fee; 18-24mo runway focus. — attachment:7218f2cb / gmail:ea89d2e1
2026-05-05 — Abdul Ly (Initialized Capital) meeting. Initialized = $1.5M-$3M at seed, targets 10-15% ownership. — fathom:588c6fdb
2026-05-06 — May investor deck circulated. Round = $2M; targets >50 / >$1.2M ARR / <$8K CAC. — attachment:e7da01c3
2026-05-07 — Guy declines Qubit's paid fundraising support: *"We discussed it and decided to hold off for now."* — gmail:9e67c0f6
2026-05-07 — Anthropic receipt issued (Receipt-2804-6430-8183.pdf). Amount not extractable from indexed data. — attachment:65e049b0
```

---

## Conflicts to flag

**C-1 — Design-partner count arithmetic.** Fathom summary entity 5b6d7a5c: *"5 design partners so far, with 3 paying and 3 non-paying."* 3+3≠5. Internally inconsistent — treat with caution.

**C-2 — Round-size target evolution.**

| Date | Round | Source |
|---|---|---|
| 2025-12 | $3M pre-seed vs. $5M seed (undecided) | gmail:ed54dd8e |
| 2026-03 | $2.5M pre-seed | gmail:d3c324ab (Formus prep) |
| 2026-04 → 05 | **$2M pre-seed SAFE** | attachment:e7da01c3 / gmail:ea89d2e1 |

Investors who saw March + May decks will notice the $2.5M → $2M reduction. **No document explains the change.**

**C-3 — Burn $300K measured vs. $400K conservative.** Both from same Guy meeting 2026-04-17. Not a true contradiction (the $400K is a forward-looking cushion for team growth) but Qubit's 18-24mo on $2M implies $83K-$111K/mo post-raise = 2.5–4× current. **No explicit headcount/vendor budget breakdown for the jump is indexed.**

**C-4 — Seed milestone: $0.7M ARR (March pitch) vs. $1.2M ARR (May deck).** Same concept (round-must-prove). May figure 71% higher than March. No reconciliation.

**C-5 — Token cost: *"$90 total"* vs. recurrent Anthropic credit outages.** Guy says total customer-facing tokens = $90 cumulative. But Anthropic billing emails show **4 credit-depletion events** in ~3 months (gmail:d0dbf37c / d7dafa02 / f9c935ba / 011e8ded). Total Anthropic spend is meaningfully higher than $90 — likely the $90 is customer-facing-project-specific and excludes development/testing. Top-up amounts are not indexed.

**C-6 — Runway: *"three years"* (Guy 2026-04-29) vs. *"18-24 months"* (Qubit 2026-05-01) on the same $2M.** At current $300-400K/yr burn $2M = 5-6.7yr; at Qubit's 18-24mo implied burn = $83K-$111K/mo. Guy's *"3 years"* sits between.

---

## Gaps

**G-1 — Bank balance / cash position.** No P&L, balance sheet, or cash figure anywhere in indexed data. Pilot books live in QuickBooks/Pilot portal, not in this project.

**G-2 — Whether $80K additional founder-SAFE was executed.** Stated intent 2026-01-06; no execution confirmation. The 2026-04-17 *"$150K spent"* is consistent with both *"yes executed"* and *"no, savings still being drawn"*.

**G-3 — Lihu Berman's compensation.** Co-founder & CTO. Not disclosed anywhere. Material gap given Guy explicitly takes $0; whether Lihu does the same is unknown.

**G-4 — Nitsan's specific dollar rate.** Mercury setup confirmed; W-8BEN filed; **monthly amount not indexed.**

**G-5 — Anthropic API monthly spend history.** Four credit-depletion events documented but top-up amounts not indexed. May 7 Anthropic receipt (attachment:65e049b0) couldn't be extracted.

**G-6 — Pilot plan + final pricing.** Proposal gives options; **selected plan not confirmed.**

**G-7 — Railway hosting costs.** Named everywhere; **no billing amounts indexed.**

**G-8 — Carta Grow-plan pricing.** Plan name confirmed; **monthly cost not indexed.**

**G-9 — 409A refresh status (Feb 2026).** Guy asked Carta whether the $20K MFN SAFE was material enough to require a new 409A. Carta's response not indexed.

**G-10 — Names + contract values of paying customers.** Whether 3 paying actually exist (per the inconsistent Fathom summary), and which 3 + at what tier — **not anywhere in indexed data.**

**G-11 — Whether option grants were actually issued.** Carta + 409A done. Oria's 0.2% described as post-raise. Whether anyone has formally been granted pre-raise options is not confirmed.

**G-12 — Founders' equity split.** Form 5472 implies Lihu ≥25%. Exact split not disclosed.

**G-13 — Equity-for-salary conversion (2026-04-29).** *"Can I convert my entire pay to equity?"* described as a proposal — **not confirmed executed.** Engineer not named (likely Oria given the Phase-2 timing).

**G-14 — Post-funding burn + headcount plan.** Deck says 40% to GTM (~$800K) + 60% product/ops (~$1.2M). **No explicit headcount or vendor budget for post-raise state is indexed.**

**G-15 — Term sheet / investor commitment.** As of 2026-05-08, in active VC conversations. **No term sheet, LOI, or commitment from any investor in indexed data.**

---

## See also
- [raise](raise.md) — round structure, outreach state, founder MFN SAFE
- [north-star](north-star.md) — round-must-prove targets
- [team](team.md) — comp arrangements (Courtney revshare, Nitsan options, Oria phased)
- [pricing](pricing.md) — tiers and ACV math
- [gtm](gtm.md) — Cleverly $2k/mo (only marketing spend); Qubit fee structure declined
