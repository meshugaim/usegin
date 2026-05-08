# Fresh Gin — blurb output

**Run:** 2026-05-08
**Agent:** general-purpose sub-agent, no Effi/MCP/web access, restricted to reading `usegin/effi-memory/askeffi-app-really/`
**Prompt:** Write a short, accurate blurb about AskEffi suitable to send to a friend who may become an angel investor. Around 200 words. Include: what we do (and the angle that makes us different), target market, current traction, and the current raise. Be factually accurate and only state things you can support. End with a one-line offer to dig in further.

---

## Blurb (the actual deliverable)

Quick intro to AskEffi — a friend's company I think you'd find interesting.

AskEffi is building "Executive Control for Cross-Company IT Projects." It's an AI assistant for executives overseeing complex projects — when something goes sideways, senior leaders normally spend days reconstructing what happened across emails, meetings, and threads they weren't copied on. Effi sits on top of that existing communication layer and makes it instantly queryable, with access controlled at the project level so it's safe to share across consultancy / client / vendor. No new workflows for the team — data comes in as a byproduct of work already happening.

The wedge is automated weekly status reports for mid-sized IT consultancies and systems integrators ($20M–$200M revenue) running concurrent ERP / complex IT implementations — partners feel the pain repeatedly and can approve without enterprise procurement. Escalation triage is the expansion play.

Traction: three active design partners on weekly cadence (one IT consultancy, one internal RevOps team at a large EdTech company, plus a new construction inbound). The IT-consultancy partner shared Effi access directly with their own client. None paying yet.

They're raising a $2M pre-seed SAFE, currently active, no term sheet yet. Happy to send the deck or intro you to Guy if it's interesting.

---

## Grounding (per-claim provenance, agent's own audit)

- `notes/positioning.md` — "Executive Control for Cross-Company IT Projects" headline; "executives reconstructing what happened" framing; sits on existing comms layer; project-level access control; no new workflows.
- `notes/icp.md` — mid-size IT consultancies / SIs $20M–$200M, partner / Head of Delivery as buyer; weekly status reports as wedge; escalation as expansion; short decision chain rationale.
- `notes/design-partners.md` — three active partners (IT consultancy, RevOps at EdTech, construction inbound); weekly cadence; IT consultancy shared with their own client; no partner paying yet.
- `notes/raise.md` — $2M pre-seed SAFE, active, no term sheet yet.

## Wiki gaps the Gin agent flagged

> I wanted to name the founder/team and say more about who's behind the company — the wiki references "Guy" (Guy Levit) only via the founder self-investment line in `raise.md` and as the person speaking in pitch-feedback notes, with no team/background note. I also wanted concrete usage numbers beyond the "200 meetings + 4,000 emails to produce one monthly status" internal demo, and a price point — `pricing.md` exists in the MOC but I read the cited "~$500/mo Starter" only via `design-partners.md` deal structure, not a positioned pricing claim, so I left pricing out. No claim about funds raised to date beyond Guy's $80k MFN SAFE was supportable.
