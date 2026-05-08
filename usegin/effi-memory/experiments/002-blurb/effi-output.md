# Fresh Effi v2 — blurb output

**Run:** 2026-05-08, 11:57 UTC
**Channel:** `effi --profile dogfooding ask --new` (production AskEffi, dogfooding profile, new session)
**Prompt:** *Write a short, accurate blurb about AskEffi suitable to send to a friend who may become an angel investor. Around 200 words. Include: what we do (and the angle that makes us different), target market, current traction, and the current raise. Be factually accurate and only state things you can cite. End with a one-line offer to dig in further.*

**Tools Effi used (per stream):** `Read attachment` ×3 (investor deck, fundraising materials, weekly status). Two reasoning beats.

**Wall time:** 42s (vs experiment 001: 62s).
**TTFT (first stdout byte):** 0.24s — but that byte is the banner. Honest TTFT to first reasoning content (`"Let me pull from..."`) is ~5s; first blurb token (`"Here's the blurb..."`) is ~13s.

---

## Blurb (the actual deliverable)

> AskEffi is building the executive oversight layer for complex, multi-party IT projects — think ERP rollouts where a software vendor, implementation consultancy, and a CIO's team are all involved, no one has the full picture, and a single escalation eats two days of leadership time. Effi sits on top of the emails, meetings, and docs already flowing across all parties, indexes them by access level, and serves any stakeholder — internal or external — synthesized context on demand, turning a 2-day escalation reconstruction into 15 minutes of self-serve clarity. The moat is cross-company: Effi spans vendor, consultancy, and client in a way generic AI tools simply can't, because they don't have access to the cross-company data.
>
> The wedge is mid-sized IT consulting firms, where a single escalation can cost $100K and a $50M consultancy may lose 30% of annual profit to them. Effi enters during routine weekly status reporting, then becomes essential at crisis time.
>
> **Traction:** MVP live, two active design partners, 60+ discovery conversations across IT consulting, SaaS, and agencies. **Raise:** $2M pre-seed (SAFE), targeting >50 customers and $1.2M ARR as proof points.
>
> Happy to share the full deck or set up a call if you want to dig in.

## Source attribution as Effi gave it

> *"drawn entirely from the investor deck (May 2026) and fundraising strategy report"*

No machine-resolvable IDs cited. Same shape as experiment 001 (no per-claim IDs), though without the "Bessemer partner meeting notes" surprise reference from run 1.
