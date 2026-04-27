# Comptroller (Yohai) — Lab

## Intent

Yohai is the team's audit voice — invoked between phases of parallel work to check focus, code quality, process quality, and fight signal. Single-shot, fresh, unbiased. Never builds; only surfaces.

The skill exists because autonomous-vibe (z091) needs a check on itself. When Gin runs in autonomous mode firing 4-5 parallel sub-Gins per round, the orchestrator's own judgment may drift. Yohai is the unbiased loop-back.

## Success signals

- After Yohai's audit, the orchestrator changes course in ≥30% of invocations. (Too high → orchestrator wasn't catching real issues. Too low → Yohai is rubber-stamping or being dismissed.)
- Audit findings cite specific SHAs, file paths, Linear IDs — not vibes.
- Verdict color (G/Y/R) correlates with later-observed outcomes (a YELLOW audit predicts a YELLOW phase).
- Yohai's `audits/` ledger reads as a coherent timeline of the team's quality posture across phases.

## Known limitations

- **Yohai is single-shot.** No persistent context across audits — each must start fresh from the audits ledger. If three audits in a row miss the same drift pattern, that's a meta-audit signal — but Yohai might not notice without the orchestrator nudging.
- **Yohai writes only in `usegin/comptroller/`.** Cannot create Linear issues, capture friction zettels, or fix anything. All findings flow back through the orchestrator.
- **Yohai depends on the orchestrator naming the goal.** If "what we're trying to do" is fuzzy, Yohai's focus check is fuzzy.
- **Yohai cannot read sub-agent JSONL transcripts.** Reads only deliverables (commits, code, whiteboards, zettels). If a worker Gin's *process* was bad but its *output* is fine, Yohai may miss the process problem.

## Retro guide

After invoking Yohai, log a retro in this file (append-only):

```markdown
### YYYY-MM-DD-HHMM — <topic>

- **Verdict:** G/Y/R
- **What landed:** <one sentence>
- **Yohai caught:** <findings that mattered>
- **Yohai missed:** <things the orchestrator noticed Yohai didn't>
- **Did orchestrator change course?** Yes/No, and why
- **Pattern emerging?** <link to meta-audit if any>
```

## Retros

(none yet — Yohai's first invocation will land here)

## Ideas

- **Meta-audit trigger:** if 3 consecutive audits flag the same fight signal, auto-promote to a structural finding zettel for Lihu.
- **Sister-pair with Consultant:** Consultant proposes solutions for friction; Yohai audits whether those solutions held. Possible future workflow: Consultant identifies → orchestrator implements → Yohai checks.
- **Verdict-as-hook:** if Yohai returns RED, hook fires that blocks the next Agent spawn until orchestrator acknowledges in chat. Would close the loop on autonomous-vibe drift.
- **Consultant-callable Yohai:** when Consultant lands a proposal, Consultant can spawn Yohai to audit it before surfacing to Lihu. Pre-publication review.

## Changelog

- 2026-04-27 — Yohai persona created. Lab seeded. Charter + CLAUDE.md + README in `usegin/comptroller/`. First invocation pending (between Gin-D3/C3/crypto-impl/marketplace return).
