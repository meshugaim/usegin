# Refine slicing — enhance-gin pool

51 ideas split across 5 refiners by theme. Refiners read the WHOLE pool but
own edits to their slice only.

| Refiner | Theme | Idea ids | Count |
|---|---|---|---|
| 01 | A (Diff-scoped pre-push gate) + K (Reframings) | i01–i05, i48–i51 | 9 |
| 02 | B (No destructive recovery) + H (Recovery as one command) | i06–i10, i35–i37 | 8 |
| 03 | C (Per-agent isolation) + D (Stage only what you authored) | i11–i15, i16–i19 | 9 |
| 04 | E (`dx ship` wrapper) + F (Storm detection & mode) | i20–i23, i24–i28 | 9 |
| 05 | G (Coordination via convention) + I (Observability) + J (Heavy primitives) | i29–i34, i38–i43, i44–i47 | 16 |

Refiner 05 has more ideas because clusters G/I/J overlap conceptually
(protocol/visibility/exotic) — single refiner is better-positioned to
recognize cross-cluster dups than splitting across multiple.

## Modified flow (autosync-safe)

Standard refine skill says refiners edit `ideas.md` IN PLACE per idea.
Given multi-agent autosync hostility (z095, our 4-eaten-commits experience
this session), refiners INSTEAD write structured per-idea edit blocks to
their own working file `refiners/<NN>-<theme>.md`. The orchestrator (me)
merges all 5 working files into `ideas.md` in a single commit at the end.

This deviates from the skill's prescribed in-place edit pattern but honors
the skill's collision mitigation (`If collision happens (rare): the
orchestrator re-merges the conflicting bullets manually using the
refiners/*.md working notes as the source of truth`) — by skipping
straight to that fallback, we avoid the race entirely.
