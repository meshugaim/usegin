# Tikur: multi-Gin checkout collisions — six incidents in 24h, same root cause as the prior tikur, prior lekach never landed

**Date:** 2026-04-28
**Severity:** high (recurrence × blast-radius — six incidents in ~24h, repeatedly attributing one Gin's work to another, blocking unrelated pushes, and silently destroying untracked files)
**Status:** open (immediate fixes done; structural fix is a posture decision distilled to Lihu)
**Category:** error at the per-incident level; **negligence at the system level** — the 2026-04-27 tikur identified both an immediate tripwire and a structural worktree fix; neither landed; recurrence was guaranteed. The negligence is not human — it is the absence of a "system-change-landed-same-turn" tripwire on the tikur skill itself.

## Cluster

This tikur consolidates six incidents that share one mechanism — concurrent Claude sessions writing through one shared `.git/index` and one shared working tree at `/workspaces/test-mvp/`:

| # | Source | Surface symptom | Tape |
|---|---|---|---|
| 1 | `.claude/tikur-records/2026-04-27-commit-scope-collision.md` | Commit `4f6988745` swept 36 files of other agents' work under UseGin's 4-file message | reflog smoking gun (two same-message commits with `reset` between them) |
| 2 | z081 | Two-agents-one-checkout-one-race naming the mechanism (sister-zettel of the 04-27 tikur) | reflog same as #1 |
| 3 | z094 | C3's three freshly-Written untracked UI files vanished when another Gin ran `git reset --hard HEAD~1` | `HEAD@{0}: reset: moving to HEAD~1` in reflog |
| 4 | z095 | ENG-5414 marketplace push pre-push-blocked by ENG-5411 sibling's unrelated working-tree dirt (`tsgo` ran against working tree, not commit range) | pre-push log shows `slack-integration-card` import error from sibling |
| 5 | z096 | ENG-5413 token-crypto helper landed under `feat(dx-slack): inbox` and then `rd-slack: ENG-5414 marketplace` — Mode-1 attribution swap, three times in one task | `git log -- nextjs-app/lib/token-crypto.ts` returns ENG-5414's commit |
| 6 | z097 | Session `6ca86823` 1-file edit became a 7-file commit including 5 stranger inbox files; `git notes` post-hoc the only mitigation | commit `9af0288a5` payload vs message divergence |

**Cluster-search keyword:** `autosync | shared-index | attribution | worktree | reset --hard | pre-push working-tree`. Touches in zettels: z038 (concurrent `dx zettel add` race — earliest), z081, z085 (ghost regressions), z094, z095, z096, z097, z099 §1 ("when structural collision risk is unfixed, parallel is slower than serial"). Touches in tikurs: 2026-04-27. Touches in memory: `reference_autosync_concurrent_collisions` (Modes 1+2). **9 distinct touches** — far beyond the 3+ threshold in `cluster-search` skill. The cluster has been visible since z038 (slice-1 era).

## Speaking-order discipline

Per the IAF protocol (rank 5 in the tikur skill), evidence-first order:

1. **Tape (logs/reflog/git):** above.
2. **UseGin reconstruction:** below.
3. **Lihu framing:** the prompt (z091 autonomous-vibe) was correct — *parallel autonomous Gins, work-all-night, stop only if you need me*. Anchoring check: Lihu's framing of the cluster as "structural fight" (D5 in CLOSE.md) does not contaminate the reasoning — it tracks the evidence.

## Timeline (re-stated at cluster level)

- **~April-21** — `reference_autosync_concurrent_collisions` memory written. Mode 1 + Mode 2 named. Defense documented: commit immediately after Write; verify origin/main contents after push. Discipline-only — no enforcement.
- **2026-04-27 ~13:54** — Commit-scope collision (4f6988745). First tikur written. Identified shared `.git/index` as root cause. Specced two fixes: tripwire (loose, immediate, "lands this turn") + worktree-per-session (strict, follow-on Linear ticket).
- **2026-04-27 ~14:00–22:00** — Tripwire never landed. Worktree-per-session never built. Autonomous-vibe Slack run (z091) launches in parallel mode (5 sub-Gins).
- **2026-04-27 evening (autonomous run)** — z094 (C3 untracked-file vanish), z095 (ENG-5414 cross-agent pre-push block), z096 (ENG-5413 Mode-1 cluster: 3 attribution swaps in one task). z099 §1 noted *post-hoc*: "with structural collision risk unfixed, parallel is slower than serial" — the autonomous run paused parallel and continued single-agent.
- **2026-04-28 (this session)** — z097 written, naming worktree-per-session as the structural fix. Lihu prompts `/tikur` on the cluster. **This record.**

## Five whys (cluster level)

- **Why** did 6 collision incidents fire in 24h after a tikur named the cluster the day before?
  - **A:** The tikur's identified system change (tripwire) never landed; nothing enforced same-turn propagation.
    - **Why** didn't the tripwire land?
      - **A:** The 2026-04-27 record said "land this turn" but the next prompt arrived (autonomous-vibe go-signal) and the discipline was bypassed.
        - **Why** is the discipline bypassable?
          - **A:** ← *root cause, leverable.* **The tikur skill names "land the system change the same turn" as rule 5/step 6, but doesn't enforce it.** No CI check, no hook, no `dx tikur verify` that the most-recent tikur record's "System:" line points at a real commit SHA. Same skill-shape failure as z040 (clusters emerge but only because per-zettel discipline made them visible) and z099 §1 (the "fights we named beat the fights we suffered" — but the fights stay won only if the lekach actually lands).

In parallel, the *content* root cause is older and unchanged from 2026-04-27:

- **Why** can multiple Gins corrupt each other's commits/pushes/worktrees?
  - **A:** They share `/workspaces/test-mvp/` — one `.git/index`, one working tree. Git's lockfile protects individual operations, not "stage → commit" intervals; `reset --hard` blasts untracked files regardless of which agent created them; pre-push runs against working tree, not commit range.
    - **Why** do they share?
      - **A:** ← *content root cause.* **The devcontainer assumes one operator per checkout.** Multiple concurrent Claude sessions in the same env all run against the shared checkout by default; no convention or harness allocates a per-session worktree.

## Root cause — cluster-level statement

**Two faces, both leverable:**

1. **Content:** Multiple concurrent Claude sessions share one `.git/index` and one working tree, and git's atomicity boundary (single-operation lock) does not span the `stage → commit → push → reset → write` operations a Gin performs across a turn. Every observed failure mode — Mode 1 attribution swap, untracked-file wipe on `reset --hard`, cross-agent pre-push block — is downstream of this.
2. **Process:** The tikur skill identifies system fixes but does not enforce same-turn propagation. The 2026-04-27 tikur produced the right diagnosis and the right two fixes; both got bypassed by the next prompt. Without an enforcement tripwire on the tikur procedure itself, recurrence-after-tikur is the default, not the exception.

The content root cause is what produces the symptoms; the process root cause is why the prior tikur didn't help.

## Fixes

### Immediate (this turn)

1. The 6 incidents have already been recovered individually (revert + reconstruct, post-hoc `git notes`, manual ENG-id correction). No outstanding data loss as of 2026-04-28.
2. **Land the missed tripwire from 2026-04-27** (the `pre-commit` diff-name check). Cheap, lands now. Won't prevent the race; will detect it loudly. Implementation in this commit.
3. **Distill the worktree-per-session decision to Lihu** as a D5 follow-up question in `usegin/research/slack-integration/CLOSE.md`. This is the architectural call — affects how Oria works in this repo, costs more than half a day, requires posture commitment. Below.

### System (the one fix that closes the cluster)

**Per-session git worktree (`dx session-wt`).** Each Claude session, on SessionStart, allocates `.worktrees/<session-id>/`, operates entirely inside it, and pushes `HEAD:main` from the worktree. The shared root becomes the human's lane, never an agent's. Justification in z097.

**Eight tailwinds say this is ready to build:**

- Hooks are already worktree-aware (`git rev-parse --path-format=absolute --git-common-dir`). Verified in `.husky/pre-commit`, `.husky/post-commit`, `.husky/prepare-commit-msg`, `.husky/pre-push`.
- `scripts/autosync.ts` already detects worktrees via `isWorktree()` and syncs from them.
- `feedback_main_wt_stay_on_main` memory already says "use real git worktrees for branch work, push `HEAD:main` from there."
- `.worktrees/eng-1039` and `.worktrees/eng-1041` exist already — the muscle is partial.
- `EnterWorktree` / `ExitWorktree` tools exist in the SDK already.
- z099 §1 (autonomous protocol) explicitly named "parallel-with-shared-checkout is slower than serial" — the worktree fix is the only thing that unblocks parallel autonomous-vibe.
- Cost (per-session disk: ~50–100MB linked) is small for the unblock.
- Decision is reversible — can be opt-in for autonomous-vibe sessions, bypassable for ad-hoc.

This is *not* in the immediate-fix scope of this turn because it requires a posture call from Lihu (interacts with how Oria works on the same repo). Distilled below.

### Tripwire (how recurrence is detected if the system fix is delayed)

Three layers, increasing strength:

1. **Pre-commit diff-name check** (this turn). Compares `git diff --cached --name-only` between commit-message-formation and commit-execution. Aborts on drift with a pointer at this tikur record. Catches Mode 1 attribution swaps.
2. **Tikur-skill self-tripwire** (this turn, in the skill edit). The skill now requires *every tikur record's "System:" field to cite a commit SHA before status flips to fixed*. Adds a "system-fix-deferred" status as the only honest alternative — naming the gap explicitly, not silently leaving the lesson un-routed.
3. **Worktree-per-session opt-in** (the structural fix, pending Lihu). Eliminates the race rather than detecting it.

## Lekach — what each artifact gets

Same turn, no later (z002):

| Artifact | Change |
|---|---|
| **z097** (existing meta-zettel) | Edited to add the cluster count (9 touches), promote the negligence-at-system-level reading, and cross-link this tikur record. |
| **`.claude/skills/tikur/SKILL.md`** | Edited: same-turn-propagation rule gets a tripwire — "System:" field must cite commit SHA or be marked `system-fix-deferred` with the named gap. Anti-pattern added: "tikur whose system fix never lands becomes the next tikur's root cause" (this very pattern). |
| **`.husky/pre-commit`** | New script `scripts/hooks/check-staging-drift.sh` invoked. Catches Mode 1. |
| **`scripts/hooks/check-staging-drift.sh`** | New. Compares cached file list between message-formation and commit-execution. |
| **`usegin/research/slack-integration/CLOSE.md`** | New entry under D5 — distilled worktree-per-session question for Lihu in z020/CLOSE shape. |
| **This record** | Records all of the above and is itself the new tikur record. |

## Cluster check note (skill rule 4.5)

This tikur **is** a cluster check. The cluster has been forming since z038 (April 11, slice-1 era — concurrent `dx zettel add` race). Today's increment is *the cluster has been recognized as a cluster, and the prior cluster-level tikur did not produce a system fix.* That meta-finding is the most actionable thing in this record.

## Distilled question for Lihu

In `usegin/research/slack-integration/CLOSE.md` under D5. Cost: roughly half a day to spec + build the `dx session-wt` primitive end-to-end. Affects: how Oria's sessions in this repo behave (worktree-per-session is opt-in for autonomous, not mandatory for human-driven). Lean: build it. Risk: agents producing absolute-path artifacts that don't transplant (mitigation: existing CLAUDE.md repo-relative-path conventions).

## Threading

Threads ↑2026-04-27-commit-scope-collision · ↑z081 · ↑z094 · ↑z095 · ↑z096 · ↑z097 · ~z038 · ~z085 · ~z099 · ~`reference_autosync_concurrent_collisions` · ~`tikur` skill (rule 5/step 6 self-tripwire added) · ~`feedback_main_wt_stay_on_main`.

## Notes for follow-up tikur

- If `dx session-wt` ships and one autonomous run completes without a collision, write a successor zettel + this record's `Status: fixed` line. Don't edit this record (append-only per skill rule).
- If `dx session-wt` does not ship within one week and another collision incident lands, that becomes a third-order tikur about *why the second tikur's lekach didn't land* — the same meta-failure recurring is itself a finding.
- The pre-commit drift tripwire's hit-rate is the test of the diagnosis: if it fires often during multi-Gin runs, the structural fix is justified beyond doubt; if it never fires, either the parallel-runs paused (z099 §1) or the diagnosis was wrong.
