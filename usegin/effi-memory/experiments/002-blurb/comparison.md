# Experiment 002 — Blurb comparison (post-v0.5 + TTFT instrumented)

**Date:** 2026-05-08
**Question:** identical to experiment 001 — *"Write a short, accurate blurb about AskEffi suitable to send to a friend who may become an angel investor. Around 200 words. Include: what we do (differentiation), target market, current traction, current raise. Be factually accurate; cite-only. End with a one-line offer to dig in further."*

**What changed since experiment 001:**

1. Wiki added `notes/founders.md` and `notes/north-star.md`; cross-linked `pricing.md` from `positioning.md`.
2. TTFT recorded for Effi via `experiments/_lib/ttft.py` (records `t0/t1/t2` around the subprocess).
3. Gin sub-agent prompted to do **batched reads** (the architecture-B retrieval shape) rather than the 9-sequential-reads pattern that dominated experiment 001's wall time.

The two output files are siblings: [effi-output.md](effi-output.md), [gin-output.md](gin-output.md).

---

## Per-claim accuracy comparison

| Claim type | Effi v2 | Gin v2 | Ground truth (wiki `Current`) | Verdict |
|---|---|---|---|---|
| **Raise** | "$2M pre-seed (SAFE)" | "$2M pre-seed SAFE, active, self-managed" | $2M pre-seed SAFE, active, no term sheet | ✅ **Both right.** Effi closed the run-1 regression (no longer "seed"). |
| **Differentiator** | "cross-company moat" / "no direct competitor" | "no new workflows" + "project-level access control" + peacetime wedge | All stable angles per `positioning.md` | ✅ Both correct framing |
| **Target market** | "mid-sized IT consulting firms" | "mid-sized IT consultancies and SIs ($20M–$200M)" + Partner/Head of Delivery as buyer | Mid-size IT/SI $20M–$200M, ERP focus, Partner/HoD buyer | ✅ Both right; Gin more specific (revenue band + buyer role) |
| **Wedge / entry motion** | "enters during routine weekly status reporting, then becomes essential at crisis time" | "automating the weekly status report" + "escalation triage" as expansion | Weekly status as wedge; escalation as expansion | ✅ Both aligned with `icp.md:Current` |
| **Loss-per-firm figure** | "single escalation can cost $100K and a $50M consultancy may lose 30% of annual profit" | (not stated) | Wiki cites 30%-of-profit framing for $50M / $5M-profit firms | ✅ Effi correct now (run 1 had narrowed to a single "$1.5M/year" outside the wiki band; this run uses the 30% framing directly) |
| **Active partners count** | "two active design partners" | "three design partners actively in weekly use, including one IT consultancy that has shared Effi directly with their own client" | **3 active** (IT consultancy, EdTech RevOps, construction inbound); IT-partner shared externally | ⚠️ **Effi undercounted by one.** Gin precise (because `design-partners.md:Current` says three explicitly). |
| **Discovery / pipeline volume** | "60+ discovery conversations across IT consulting, SaaS, and agencies" | (not stated; flagged as gap) | **Not in wiki.** Possibly real, but not surfaced through curated extraction. | ⚠️ Effi-only fact; not verifiable from the wiki. Could be valid (raw data may have it), could be aspirational/old. Gin honest. |
| **Forward targets** | ">50 customers and $1.2M ARR" | (omitted to stay near 200 words; flagged as gap) | `north-star.md`: >50 customers, >$1.2M ARR, <$8K CAC, >5 via network | ✅ Effi correct; ⚠️ Gin had the data, chose to omit for word count. **Wiki gap closed; coverage choice is the new failure mode.** |
| **Founders / team** | (not stated) | "Guy Levit (ex-VP Product Yahoo, ex-Sr Director Meta) and Lihu Berman (CTO, two prior cos), 25-year Technion friends" | `founders.md` matches | 🔄 **Roles flipped from run 1.** Run-1 had Effi covering founders / Gin missing them; run-2 has Gin covering founders / Effi omitting. Effi made a different word-count tradeoff this time. |
| **Source attribution** | "drawn entirely from the investor deck (May 2026) and fundraising strategy report" — no per-claim IDs | Per-claim file references in the Citations block | Wiki citations are machine-resolvable IDs | ✅ Gin auditable; Effi self-attributes broadly. **No "Bessemer partner meeting notes" surprise this run** (run 1 had a possibly-hallucinated citation to that). |

---

## Latency

| | Effi v2 | Effi v1 (run 001) | Gin v2 | Gin v1 (run 001) |
|---|---|---|---|---|
| Wall time (TTC) | 42s | 62s | 41s | 48s |
| TTFT to first stdout byte | 0.24s | not measured | n/a (sub-agent) | not measured |
| TTFT to first reasoning token | ~5s (banner + connection beats finished) | not measured | n/a | not measured |
| TTFT to first blurb token | ~13s (after 3 attachment reads + 2 reasoning beats) | not measured | n/a | not measured |
| Tool calls | 3 | 5 | 12 | ~9 |

**The "TTFT" the wrapper records is mechanically honest but semantically thin.** First stdout byte is the connection banner, not the first useful content token. The wrapper would need to detect the streamed-content event boundary — currently a known limitation we've accepted (per Lihu, "approximate is fine").

**Wiki-grounded Gin took ~41s with 12 file reads.** Architecture B's premise was that batched reads would compress this; the sub-agent did 12 reads across 2 turns of reasoning rather than 9 across many turns. That's a behaviour shift, not a wall-clock win — sub-agent overhead dominates. **Architecture B's TTFT promise (~5s) is unverifiable while we're invoking through a sub-agent**; testing it for real means invoking the model directly with the index pre-loaded in the system prompt. Deferred.

---

## What this run tells us

**On the failure mode the wiki was built to fix:** experiment 001 caught Effi compressing "pre-seed SAFE" → "seed". This run, **Effi got it right**. So either the wiki experiment is irrelevant to the load-bearing case, or we got lucky on a stochastic run, or fresh-Effi sometimes does and sometimes doesn't compress — N=2 doesn't decide. **The wiki-side behaviour is consistent across runs (got it right both times)**; the Effi-side is variable. *Consistency under variability* is the durable wiki value, not "wiki always wins."

**The new-but-similar failure mode:** Effi v2 said "two active design partners." Wiki has three. This is the same shape as run 1's "web agencies" overcount — Effi is grounded somewhere that under-represents the current partner count. We didn't probe its source, but the wiki's `design-partners.md:Current` would have prevented this.

**Effi added an unverifiable claim** ("60+ discovery conversations"). Wiki has no traction-volume note today. This is either a real fact the wiki should hold, or aspirational/stale deck language. **Either way, it's another wiki gap to consider** — and another instance of the same dynamic ("primary source has aspirational framing the wiki would normalise").

**Gin v2's coverage is dramatically better than Gin v1.** With founders + north-star added, Gin covered founders and the `>50 customers / $1.2M ARR` milestones (Gin chose to mention founders, omit milestones — the inverse of Effi v2 this run). The wiki gap from run 1 is closed at the data level; the *coverage choice* (what to include in 200 words) is now where Gin and Effi diverge, not the underlying knowledge.

---

## Wiki gaps surfaced (v0.6 candidates)

| Gap | Why | Source |
|---|---|---|
| Pipeline / discovery-volume note | Effi cited "60+ discovery conversations across IT consulting, SaaS, and agencies"; angel-blurb-class questions ask about pipeline shape; wiki doesn't cover it | Probe project data; if real, add `notes/pipeline.md` or merge into `traction.md` |
| Why does Effi see two design partners not three | Possible stale signal in raw data Effi reads; not a wiki gap *per se* but a sign that the curated `Current` line on `design-partners.md` is doing real work | n/a (this is an Effi-side fact, addressable by giving Effi the wiki in v1) |

---

## Verdict

**v0.5 wiki + Gin v2 closed the breadth gap experiment 001 surfaced** (founders, milestones now present). Gin self-selects which to mention given the word budget. **Effi v2 corrected the run-1 raise-compression but introduced a new low-stakes error** (partner undercount) and an unverifiable claim (60+ discovery convs). **The wiki's value is consistency** — across runs, the wiki-grounded blurb stays factually pinned in the same spots. Effi-grounded blurbs vary on which fact gets it wrong this time.

**The architecture-B latency promise is not yet tested for real** — sub-agent overhead dominates Gin-side wall time, and the wrapper's TTFT is to first stdout byte, not first content token. Testing B properly needs a direct-SDK harness with the wiki pre-loaded in the system prompt. Out of scope for run 002, candidate for run 003.

---

## Methodology caveats (same as run 001 + new)

- N=1 question, N=1 run per side. Don't overgeneralize.
- Effi production may have re-indexed between runs; this isn't a controlled apples-to-apples on the Effi side.
- Gin sub-agent self-policed scope; spot-checked grounding section, it stayed in the wiki.
- TTFT-to-first-stdout-byte is a banner-byte; treat it as a mechanical baseline, not the perceived-latency metric. Honest first-content-token TTFT requires parsing the stream.
- Sub-agent TTFT is not directly observable from the parent. Wall time only on Gin side.
