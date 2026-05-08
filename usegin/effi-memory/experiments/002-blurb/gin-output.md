# Fresh Gin v2 — blurb output

**Run:** 2026-05-08, ~11:58 UTC
**Channel:** general-purpose sub-agent, restricted by prompt to reading only `/workspaces/test-mvp/usegin/effi-memory/askeffi-app-really/`. No `effi`, no MCP, no web.
**Prompt:** *Write a short, accurate blurb about AskEffi suitable to send to a friend who may become an angel investor. Around 200 words. Include: what we do (and the angle that makes us different), target market, current traction, and the current raise. Be factually accurate and only state things you can cite. End with a one-line offer to dig in further.* (Plus: hard constraints on file scope; emit grounding + blurb + citations + gaps; "batched reads, max 2 turns" hint.)

**Wall time:** 41s (vs experiment 001 Gin: 48s). 12 tool calls.
**TTFT:** Not directly measurable (sub-agent invocation is one synchronous call from the parent; no token-level stream visibility). Approximate.

**Wiki state at run time:** v0.5 — has `notes/founders.md`, `notes/north-star.md`, and the `positioning.md → pricing.md` cross-link added since experiment 001.

---

## Grounding (which wiki files Gin read, what it took from each)

- `MEMORY.md` — confirmed hub structure, pointed to the company MOC
- `moc/company.md` — routing index; named the topic notes needed (raise, positioning, icp, design-partners, north-star, pricing, founders)
- `_conventions.md` — `Current` line is the load-bearing claim per topic
- `_architecture.md` — confirmed batched on-demand reads is the intended retrieval shape
- `notes/positioning.md` — "Executive Control for Cross-Company IT Projects", peacetime-first wedge, 2-days-to-minutes claim
- `notes/icp.md` — mid-size IT consultancies / SIs ($20M–$200M), Partner / Head of Delivery as buyer
- `notes/raise.md` — $2M pre-seed SAFE, active, no term sheet, self-managed
- `notes/design-partners.md` — three active partners, none paying yet, IT-consultancy partner shared Effi externally with their own client
- `notes/north-star.md` — round milestones (>50 customers, >$1.2M ARR, <$8K CAC, >5 network intros)
- `notes/pricing.md` — $500 / $1.8K / $4K tiers, blended ACV target $50K, 10× ROI floor
- `notes/founders.md` — Guy Levit (ex-Yahoo VP Product, ex-Meta Sr Director), Lihu Berman (CTO, two prior cos), 25-year Technion friendship

---

## Blurb (the actual deliverable)

> AskEffi is building Executive Control for Cross-Company IT Projects — an AI assistant that sits on top of the emails, meetings, and documents already flowing through a consultancy and makes the whole project history instantly queryable. The angle that makes us different: no new workflows for the team, project-level access control so the same agent works safely across consultancy, client, and vendor, and a wedge that lands in peacetime (automating the weekly status report every firm already does by hand) before expanding into the high-value moment — escalation triage, where reconstructing context drops from two days to minutes. Target market is mid-sized IT consultancies and systems integrators ($20M–$200M revenue) running concurrent ERP and complex IT programs; buyer is the Partner or Head of Delivery. Traction: three design partners actively in weekly use, including one IT consultancy that has shared Effi directly with their own client. Founders are Guy Levit (CEO, ex-VP Product Yahoo, ex-Sr Director Meta) and Lihu Berman (CTO, two prior companies); 25-year friends from the Technion Excellence Program. We're raising a $2M pre-seed SAFE, active, self-managed. Happy to share the deck or set up a call if you want to dig in.

---

## Citations (per load-bearing fact)

- "Executive Control for Cross-Company IT Projects" — `notes/positioning.md:Current`
- no new workflows / project-level access / cross-company — `notes/positioning.md:Stable angles`
- peacetime wedge before escalation — `notes/icp.md:Current` + `notes/positioning.md:Stable angles`
- weekly status reports as wedge — `notes/icp.md:Current`
- 2 days → minutes for context reconstruction — `notes/positioning.md:Current` (Time-to-context)
- mid-size IT consultancies / SIs $20M–$200M, Partner / Head of Delivery buyer — `notes/icp.md:Current`
- three active design partners, weekly cadence — `notes/design-partners.md:Current`
- IT-consultancy partner shared Effi directly with client — `notes/design-partners.md:Standout outcome`
- Founders backgrounds + 25-year Technion friendship — `notes/founders.md:Current`
- $2M pre-seed SAFE, active, self-managed — `notes/raise.md:Current`

---

## Gaps Gin self-reported

- No partner is paying yet (per `design-partners.md`) — omitted to avoid leading with a negative; an angel would likely ask
- Round milestones from `north-star.md` (>50 customers, >$1.2M ARR, <$8K CAC) — left out to stay near 200 words; could include
- Specific design-partner names — wiki notes the names aren't disclosed in indexed data; described by vertical only
- Any company-level facts not in the wiki (headcount, runway, HQ, incorporation) — intentionally omitted
