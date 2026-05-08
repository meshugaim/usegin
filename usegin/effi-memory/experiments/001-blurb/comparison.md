# Experiment 001 — Blurb comparison

**Date:** 2026-05-08
**Question:** Write a short, accurate blurb about AskEffi suitable to send to a friend who may become an angel investor. ~200 words. Include: what we do (differentiation), target market, current traction, current raise. Be factually accurate; cite-only.
**Setup:**
- **Fresh Effi** — `effi --profile dogfooding ask --new`. Production AskEffi. New session, no chat-history. Full access to project's raw data (Gmail, Drive, Fathom, attachments) via Effi's tools. 62s wall time.
- **Fresh Gin** — general-purpose sub-agent, no Effi/MCP/web access. Restricted by prompt to reading only `usegin/effi-memory/askeffi-app-really/`. ~48s wall time.

Both ran fresh — neither had any prior session context about the company. Effi grounded in raw project data; Gin grounded in the curated wiki. Same prompt, same length target.

The two output files are siblings: [effi-output.md](effi-output.md) and [gin-output.md](gin-output.md).

---

## Per-claim accuracy comparison

Comparing each load-bearing claim in each blurb against project ground truth (the wiki's `Current` lines, which were themselves extracted from primary sources with citations).

| Claim type | Fresh Effi | Fresh Gin | Ground truth (wiki) | Verdict |
|---|---|---|---|---|
| **Raise** | "$2M seed" | "$2M pre-seed SAFE, currently active, no term sheet yet" | $2M pre-seed SAFE, active, no term sheet | ⚠️ Effi compressed pre-seed→seed; Gin precise. **Material error for an angel pitch.** |
| **Differentiator** | "works across company boundaries" / "no direct competitor at intersection of cross-company execution and exec decision-making" | "access controlled at the project level so it's safe to share across consultancy / client / vendor" + "no new workflows" | Both stable angles per `positioning.md` | ✅ Both correct framing |
| **Target market** | "mid-sized IT consultancies" | "mid-sized IT consultancies and SIs ($20M–$200M revenue) running concurrent ERP / complex IT" | Mid-size IT/SI $20M–$200M, ERP focus | ✅ Both right; Gin more specific |
| **Wedge / entry motion** | (not stated) | "automated weekly status reports … escalation triage is the expansion play" | Weekly status as wedge; escalation as expansion | Gin more aligned with current strategy; Effi omits |
| **Loss-per-firm figure** | "$1.5M/year (30% of profit) for $50M consultancy with $5M bottom line" | (not stated) | Wiki cites "$1M–$2M" range for $50M/$5M-profit firm | ⚠️ Effi narrowed the range to a single number that's outside the wiki's stated band |
| **Active partners count** | "IT consultancies, an ad-tech revenue ops team, and web agencies" (plural / vague) | "three active design partners (IT consultancy, internal RevOps at large EdTech, construction inbound). IT-consultancy partner shared Effi access directly with their own client. None paying yet." | 3 active partners as listed; IT one shared externally; none paying yet | ⚠️ Effi pulled deck-level traction language ("web agencies") that the wiki explicitly flags as **more generous than indexed evidence supports** (see `design-partners.md` Conflicts to flag). Gin precise. |
| **Forward targets** | "$1.2M ARR, 50+ customers" | (not stated) | Confirmed in May 2026 deck (`raise.md` cites `attachment:e7da01c3`) | ✅ Effi correct; Gin omitted |
| **Founders / team** | "Guy Levit (ex-VP Product Yahoo; Sr. Director Meta) and Lihu Berman (CTO) — 25-year collaborators" | (not stated; Gin flagged this as a wiki gap) | Wiki has no founders/team note | ✅ Effi correct on substance; Gin honest about gap |
| **Source attribution** | "AskEffi investor deck May 2026; Bessemer partner meeting notes" (no IDs) | Per-claim file references in audit list | Wiki citations are machine-resolvable IDs | Gin's grounding is auditable; Effi's includes a "Bessemer partner meeting notes" reference that isn't in the wiki — possibly hallucinated or genuine but unsourced |

---

## What this tells us

**Where the wiki helped (the load-bearing case):**

The single biggest failure mode we set out to fix — the staleness/imprecision on the raise — *did regress on Effi side*. Fresh Effi called the round "seed" instead of "pre-seed SAFE." For an angel-investor blurb that distinction is the difference between credible-sourced and wrong. The wiki, by having a single `Current` line with one citation, prevented Gin from making the same mistake. **This is the failure mode the system was designed to fix; v0 fixed it.**

The traction overstatement is the second instance of the same dynamic. Effi pulled "web agencies" from the May 2026 investor deck — a primary source. The wiki flags this *as a primary-source-vs-indexed-evidence conflict* in `design-partners.md`'s "Conflicts to flag" section. Gin had access to that flag and used the conservative count; Effi did not have a curated layer telling it which deck claims are aspirational.

**Where the wiki hurt (the cost):**

Gin's blurb is missing material an angel investor would expect: founders, the $1.2M ARR / 50+ customer milestone, and a price point. Effi got all of these right because they're in the deck/raw data; Gin couldn't because they aren't in the wiki yet. The wiki narrowed the answer in ways that are not always good. Gin honestly flagged the gaps.

**The tradeoff in one line:** the wiki swapped *breadth* for *accuracy*. Net for the blurb-class question, accuracy is the right thing to prioritize — wrong raise terms in an investor blurb is a bigger failure than missing founder bios.

---

## Wiki gaps surfaced

Concrete v0.5 additions the experiment surfaced as load-bearing:

| Gap | Add | Source |
|---|---|---|
| Founders / team | `notes/founders.md` — Guy Levit, Lihu Berman, backgrounds, role split | Project data; verifiable |
| Forward milestones (raise's "what does success look like") | Either expand `notes/raise.md` Current section to include the deck's stated milestones, or new `notes/north-star.md` with $1.2M ARR / 50+ customers / <$8k CAC / >5 customers via network intros | `attachment:e7da01c3` |
| Pricing in `positioning.md` shouldn't go missing | The MOC entry for `pricing.md` should be reachable from `positioning.md` see-also, or the standard blurb structure should explicitly reference price-point | Already in `notes/pricing.md`; just needs cross-linking from the blurb's natural reading path |
| Conflict between deck-traction and indexed-evidence | The wiki captured this in `design-partners.md` but Effi's path to the deck doesn't see the flag. Useful for v1 (when Effi reads the wiki), not for v0. | Already in wiki |

---

## Verdict

**v0 substrate works** for the failure mode it was built for. Two material errors in Effi's output (round-stage compression, deck-level overcounting) were prevented in Gin's wiki-grounded output. The cost — narrower content, more honest gaps — is acceptable for the angel-blurb use case and is fully addressable by adding the missing notes.

**Most surprising finding** (worth its own zettel): Effi pulling "Bessemer partner meeting notes" as a self-attributed source. There's no Bessemer reference in the wiki and I can't see a Bessemer thread in the Effi tool calls in stream output. This may be a hallucinated citation. **In any v1 that gives Effi the wiki, the wiki's machine-resolvable citation discipline becomes a check on this exact failure mode.**

---

## Next step suggestions

| Priority | Action |
|---|---|
| 1 | Add `notes/founders.md` and re-run the same prompt against Gin to see if it closes the breadth gap without losing accuracy |
| 2 | Cross-link `pricing.md` into `positioning.md` see-also so the natural blurb-reading path surfaces it |
| 3 | Decide whether to expand `notes/raise.md` Current to include the May-2026-deck milestones, or pull them into a separate `notes/north-star.md` (cleaner — milestones aren't part of the raise per se, they're targets the raise enables) |
| 4 | After 1–3, re-run experiment 002 with the same prompt and compare Gin v2 to Effi |
| 5 | Then consider giving Effi access — pick a runtime path (Supabase table vs lazy-bucket-read) and prototype |

---

## Methodology caveats

- N=1 question, N=1 run per side. Don't overgeneralize. Re-run before treating any of the above as durable.
- Effi was running on production with whatever index/embeddings it has today. A different day might surface different sources or different language.
- Gin sub-agent self-policed its restrictions ("don't browse beyond the wiki"); not strictly enforced. Read its grounding section to verify it actually used only the wiki — it did.
- The prompt asks for ~200 words; both came in around that. Length was not a discriminator.
