# Prioritize aggregate — enhance-gin pool

> Prioritize round 1, 2026-04-27. 5 prioritizers (Mark, Johan, John, Sam, Cal), 50 active ideas (i46 merged into i45).
>
> Two views below: Borda (positional sum, top-25 truncation) + Convergence buckets (top-13 ≈ ⌈50/3⌉ membership counted across prioritizers).
>
> The two views agree on the ridge: **six ideas land in 5/5 prioritizers' top-13 — these are the round-1 spine.**

## View 1 — Borda count (top 25 of 50)

Borda points = `26 - rank-within-top-25`. Ranks 26+ = 0 from that prioritizer. Higher total = ship sooner.

| # | Idea-id | Title (short) | Mark | Johan | John | Sam | Cal | Total | Cluster |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **i06** | Autosync never resets | 25 | 24 | 25 | 25 | 24 | **123** | B |
| 2 | **i01** | Pre-push gates the diff, not the tree | 23 | 22 | 20 | 24 | 21 | **110** | A |
| 3 | **i17** | PostToolUse touched-set | 21 | 21 | 21 | 22 | 18 | **103** | D |
| 4 | **i19** | Agent-Session trailer (v0) | 19 | 19 | 22 | 17 | 20 | **97** | D |
| 5 | **i05** | Skip TS/test for docs-only pushes | 24 | 7 | 19 | 19 | 22 | **91** | A |
| 6 | **i35** | `dx recover` menu | 16 | 18 | 18 | 21 | 17 | **90** | H |
| 7 | **i38** | Loud telemetry pre-destructive | 13 | 17 | 24 | 15 | 13 | **82** | I |
| 8 | i20 | `dx ship` wrapper | 17 | 25 | 8 | 23 | 7 | 80 | E |
| 9 | i07 | Push to `gin/orphan/<sha>` on fail | 18 | 20 | 7 | 20 | 14 | 79 | B |
| 9 | i31 | Five-rule etiquette doc | 22 | 0 | 23 | 11 | 23 | 79 | G |
| 11 | i16 | Ban `git add -A` in agent code | 20 | 11 | 5 | 16 | 19 | 71 | D |
| 12 | i24 | Storm-mode as first-class state | 8 | 23 | 0 | 18 | 16 | 65 | F |
| 13 | i26 | `dx wait-for-clean-tree` | 15 | 1 | 16 | 13 | 5 | 50 | F |
| 14 | i39 | Three-color storm gauge (R/A/G) | 7 | 8 | 12 | 12 | 9 | 48 | I |
| 15 | i25 | `dx storm-status` readout | 9 | 3 | 17 | 10 | 8 | 47 | F |
| 16 | i02 | Pre-push in clean ephemeral worktree | 10 | 16 | 2 | 14 | 4 | 46 | A |
| 17 | i37 | Hash-chain stash naming | 14 | 0 | 13 | 6 | 0 | 33 | H |
| 18 | i32 | PreToolUse blocks cross-sid resets | 5 | 9 | 0 | 8 | 10 | 32 | G |
| 19 | i11 | Per-agent git worktree | 0 | 12 | 0 | 0 | 15 | 27 | C |
| 19 | i04 | Whole-tree lint, filter to diff | 12 | 0 | 3 | 0 | 12 | 27 | A |
| 21 | i03 | `git stash -u` wrapper | 11 | 0 | 4 | 0 | 11 | 26 | A |
| 21 | i36 | `dx commit-eats` SQLite log | 2 | 10 | 6 | 7 | 1 | 26 | H |
| 23 | i28 | Cap concurrent agents at 1 | 0 | 0 | 0 | 0 | 25 | 25 | F |
| 24 | i48 | Replace pre-push with post-push CI | 0 | 14 | 0 | 0 | 6 | 20 | K |
| 25 | i41 | Push-readiness 0-100 score | 6 | 2 | 11 | 0 | 0 | 19 | I |

Tail (Borda < 18, single-source or borderline): i42, i10, i27, i50, i51, i08, i23, i12, i43, i18, plus everything below — see individual prioritizer files for full ranks.

## View 2 — Convergence buckets (top-13 membership)

Of each prioritizer's top-13, who's in?

| Idea-id | Mark | Johan | John | Sam | Cal | Count | Bucket |
|---|---|---|---|---|---|---|---|
| **i06** | 1 | 2 | 1 | 1 | 2 | **5/5** | HIGH |
| **i01** | 3 | 4 | 6 | 2 | 5 | **5/5** | HIGH |
| **i17** | 5 | 5 | 5 | 4 | 8 | **5/5** | HIGH |
| **i19** | 7 | 7 | 4 | 9 | 6 | **5/5** | HIGH |
| **i35** | 10 | 8 | 8 | 5 | 9 | **5/5** | HIGH |
| **i38** | 13 | 9 | 2 | 11 | 13 | **5/5** | HIGH |
| i05 | 2 | — | 7 | 7 | 4 | 4/5 | MOD |
| i07 | 8 | 6 | — | 6 | 12 | 4/5 | MOD |
| i31 | 4 | — | 3 | — | 3 | 3/5 | MOD |
| i20 | 9 | 1 | — | 3 | — | 3/5 | MOD |
| i16 | 6 | — | — | 10 | 7 | 3/5 | MOD |
| i24 | — | 3 | — | 8 | 10 | 3/5 | MOD |
| i02 | — | 10 | — | 12 | — | 2/5 | SPLIT |
| i26 | 11 | — | 10 | 13 | — | 3/5 | MOD |
| i39 | — | — | — | 12 | — | 1/5 | SPLIT |
| i25 | — | — | 9 | — | — | 1/5 | SPLIT |
| i28 | — | — | — | — | 1 | 1/5 | LONE-VOICE |

Notable agreements / splits:

- **6 ideas land 5/5 in top-13.** This is the highest convergence the round produced. **Round 1 spine.**
- **i20 and i24** are top-3 for one prioritizer each (Johan, Johan/Sam) but outside top-13 for two — Borda still ranks them respectably (8, 12) because everyone has them in top-25, just not the top-13. Treat as round-1 supporting cast, not spine.
- **i05 and i07** are 4/5 in top-13 — high-confidence supports.
- **i28 is Cal's #1 alone.** Nobody else placed it in top-25. This is a *premise question*, not a low-rank idea — it asks "should we even have a multi-agent storm?" — surface as Dilemma D-PARALLELISM (z026 shape) for Lihu.
- **i48 (post-push CI) is Johan-12 + Cal-20, Borda 20.** Architectural reframing — alternative to cluster A. Surface as Dilemma D-GATE-LAYER.

## Position rulings (5/5 across prioritizers)

### i42 — telemetry-first sequencing — UNIVERSAL REJECTION OF GATING

All 5 prioritizers (Mark / Johan / John / Sam / Cal) independently reached the same verdict: **reject i42 as a hard gate, accept the ethos**. The proposed phrasing:

> Ship i06 + i38 *together* in parallel (the load-bearing fix + its own observability surface). The 4-eaten-commits this session is itself enough evidence to act. Use i42's measurement window to shape the *secondary* cluster-B choices (i07 vs i08 vs i09) where data should drive form, not the foundational stop-resetting move.

This is a 5/5 convergent meta-ruling. Treat as decided. (Was Deferred Decision #1 in refine summary; resolved.)

### i19 — author-name vs trailer split — UNIVERSAL TRAILER-ONLY V0

All 5 prioritizers explicitly chose **trailer-only** over author-name. Reason: trailer is reversible (drop the trailer hook); author-name is forever-in-corpus. Treat as decided. (Was Deferred Decision #3; resolved.)

### i09 — force-with-lease doctrinal carve-out — DEFERRED TO LIHU

Mark, John, Sam ranked i09 mid-pack assuming carve-out NOT granted. With carve-out, i09 jumps ~10 ranks. **Needs Lihu's ruling** before round 1 (see Dilemma D-FORCE-LEASE below). (Deferred Decision #2 — still deferred to human.)

## Round-1 recommended sequence (the spine)

In ship order — each step is independently small, reversible, and unblocks the next:

1. **i06** — delete `git reset HEAD~1` from autosync; surface error instead. (1 line.)
2. **i38** — emit loud telemetry before any destructive op (the surface; protects future regressions of i06; absorbs i10's last-words mechanism). (3-4 emit calls.)
3. **i19** — `Agent-Session: <sid>` trailer on every agent commit (trailer-only v0; reversible). (Env var + commit-msg hook.)
4. **i17** — PostToolUse Edit/Write hook logs to `.gin/sessions/<sid>/touched.jsonl`. (Hook + appender.)
5. **i16** — `git commit -- <paths>` from i17's set; ban `git add -A` in `tools/dx/`. (Audit + lint rule.)
6. **i01** — pre-push hook scopes lint/tsgo/tests to `git diff origin/main..HEAD --name-only`. (~20 line bash change.)
7. **i05** — fast-path: if all changed files match `*.md` / `usegin/**`, skip TS/test entirely. (10-line guard at hook entry.)
8. **i35** — `dx recover` v0 reads reflog, presents menu, cherry-picks. (Reflog parser + picker.)

After spine: **i20 (`dx ship` wrapper)** as integration seam to compose the above + downstream additions, **i07 (orphan-park)** as i06's durable supplement, **i31 (etiquette doc)** as the spec for future enforcement primitives.

## Dilemmas (z026 shape) — surfaced for human decision

### D-FORCE-LEASE (i09 doctrinal carve-out)

- **Decision needed**: does `git push --force-with-lease=origin/main:<seen-sha>` count as a "force-push" under CLAUDE.md "NEVER force-push" rule?
- **Options**:
  - **A. Carve out** — explicitly permit `--force-with-lease` (CAS guard, not destructive force) when used as the autosync push primitive.
  - **B. No carve out** — `--force-with-lease` is forbidden too; i09 is dead; cluster B uses orphan-park (i07) + tombstone (i08) instead.
- **Lean**: A (carve out). The doctrine was written when the only force-push was the dangerous kind. `--force-with-lease=<sha>` fails closed when state has moved — structurally CAS, not destructive. Ranked B-blocked by Mark/John/Sam at mid-pack; with A, i09 jumps to top-15.
- **Why**: A enables cluster B's most-textbook recovery primitive (CAS retry). B works fine without it via orphan-park, just less elegant.
- **Price**: A = small doc update + one phrase in `dx ship`. B = 0.
- **Risk**: A = future agent reads `--force-with-lease` as license for raw `--force` (mitigated by hook lint + naming the primitive `dx ship` not `git push`). B = none, just less powerful recovery.
- **For you to weigh**: do you trust `--force-with-lease=<seen-sha>` as structurally safe, or treat the whole `--force*` family as off-limits?

### D-PARALLELISM (i28 cap-at-1 premise)

- **Decision needed**: do we want multi-agent parallelism on the same checkout, or should one-agent-per-checkout be the default?
- **Options**:
  - **A. Cap at 1** — `dx session start` defaults to refusing if another agent's heartbeat is recent; spawning N requires explicit `dx storm allow-N=K` from the human.
  - **B. Embrace parallelism** — keep the current default; ship i11 (per-agent worktrees) so parallelism becomes safe.
  - **C. Hybrid** — cap at 1 by default, allow N via override; build i11 as the "I want N" implementation.
- **Lean**: C. Cal's argument is real — half the pool exists *because* we run N agents on shared tree, and that cost is paid silently in eaten commits. Capping makes the cost visible at spawn. But killing parallelism entirely loses the rnd / brainstorm / refine / prioritize teams that proved themselves *this very session*. Hybrid = the cap is the decision, i11 is the implementation when the human says yes.
- **Why**: Cal-#1 is the team's lone-voice provocation — nobody else top-13'd it, so the team isn't unanimous, but Cal's argument is unrebutted. Surface to Lihu rather than rule autonomously.
- **Price**: C = i28 (small) + i11 substrate (small) + the human pays attention at spawn. A = retires i11/i13/i14, half the pool. B = current pain continues without the question being asked.
- **Risk**: C = adds friction at spawn time (worth it). A = loses team-form skills' dogfooding value. B = silent cost continues.
- **For you to weigh**: should the multi-agent storm be the default, the exception, or the always-explicit choice?

### D-GATE-LAYER (i01-i05 vs i48 horizon)

- **Decision needed**: ship the local-gate-fix layer (i01-i05) or skip to delete-the-local-gate (i48)?
- **Options**:
  - **A. Local gate fix first** — ship i01 + i05 in round 1; revisit i48 after a quarter of operating with the diff-scoped gate.
  - **B. Delete the gate** — ship i48 (post-push CI as only gate); skip i01-i05 entirely; revert-on-red for `main`.
- **Lean**: A. The team's 5/5 convergence on i01 (#2 Borda) outweighs Cal+Johan's 1/5+1/5 on i48. Delete-the-gate is structurally cleaner but operationally untested; revert-on-red automation is its own project. Ship the diff-scoped gate now; if it stops earning its keep, retire it via i48 in 6 months.
- **Why**: i01 is small + reversible + 5/5 convergent; i48 is medium + production-blast-radius + single-source.
- **Price**: A = i01+i05 in round 1, ~1 day. B = revert-on-red automation, ~3 days, plus production contract change.
- **Risk**: A = duplicate-of-CI smell persists. B = "CI is broken so nobody can land" failure mode without the local-pre-push safety net.
- **For you to weigh**: is the local pre-push hook earning its keep, or is it duplicate work we should be retiring?

### D-AUTHOR-IDENTITY (resolved by 5/5 — surfaced for confirmation only)

- **Decision needed**: trailer-only v0 of i19, or trailer + author-name?
- **Options**: A. trailer only. B. trailer + author-name (`gin-<sid>`).
- **Lean**: A — UNIVERSAL across all 5 prioritizers. Trailer is reversible; author-name is forever in git history.
- **Why**: 5/5 prioritizers agreed.
- **Price**: 0 (just don't change `GIT_AUTHOR_NAME`).
- **Risk**: A = author column shows the human's identity even on agent commits — but reflog + trailer give the forensic chain.
- **For you to weigh**: confirm or override the team's unanimous read.

### D-i46-jj — i47 Jujutsu scope ruling — DEFERRED TO LIHU

- **Decision needed**: is `jj` (Jujutsu) on top of git refs in or out of scope for the agent's git surface?
- **Lean**: probably out for round 1 (large + irreversible + topic.md says "no replacing git itself"; jj-on-git-refs is borderline). Surface for explicit ruling.
- **For you to weigh**: explicitly grant or deny.

### Lower-priority dilemmas (deferred to round 2)

- **D-i28-vs-cluster-C**: if D-PARALLELISM resolves to A (cap at 1), retire i11/i13/i14 entirely. If C, ship i11 v0 alongside.
- **D-i49-vs-i51**: split-trunk vs no-trunk-for-agents — both rank low (Borda < 17); defer until cluster A/B/D ships and we have signal whether trunk-sharing is even still painful.
- **D-i50-research-track**: Johan ranked i50 #11 ("north star"); flag as research-track, not implementation-candidate.
- **D-i44-i47-J-cluster**: cluster J (CRDT, event-sourcing, jj) all ranked low; explicitly note as "not round 1" so they don't surface again until evidence justifies.

## Hand-off

→ **Round 1 spine** is the 6 unanimous-top-13 picks (i06, i01, i17, i19, i35, i38) sequenced as the recommended ship order above. All 6 are small + reversible + dev-loop-only blast radius — ideal for a single-PR or two-PR landing.

→ Next step: **spec** the round-1 spine. Recommend `spec` skill on the bundle (single spec covering all 6 — they compose into one coherent change to `tools/dx/` + `.claude/hooks/` + `.husky/pre-push`).

→ After spec lands: slicing-specs to break into vertical slices, then implementation.

→ Lihu rulings needed before round 1 ships: D-FORCE-LEASE, D-PARALLELISM, D-GATE-LAYER, D-i46-jj. The spine itself doesn't depend on these — they shape round 2+.
