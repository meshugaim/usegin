# Tikur: commit `4f6988745` swept 36 files of other agents' work under my message

**Date:** 2026-04-27
**Severity:** medium (recurrence × blast-radius — happens whenever ≥2 agents commit concurrently in the same checkout, currently unbounded)
**Status:** open (immediate fix in progress; system fix specced)

## Timeline

- ~13:54 UTC — Concurrent agent A starts staging the "his — close the punch list" work.
- ~13:54 UTC — UseGin (this session) finishes writing `z039`, `gaps.md`, `organizing-process.md`, edits `usegin/zettel/README.md`.
- 13:54 UTC — Agent A commits → SHA `9853ed033` ("feat(dx-app): his — close the punch list"). The commit also sweeps z037 and z040 (UseGin's untracked zettel files) under A's message via A's `git add` scope. Memory entry `reference_autosync_concurrent_collisions.md` Mode 1.
- 13:54 UTC — UseGin runs `git add usegin/zettel/zettels/z039-*.md usegin/zettel/gaps.md usegin/zettel/organizing-process.md usegin/zettel/README.md`. `git diff --cached --name-only` returns exactly those 4 files. Verified.
- 13:55 UTC — UseGin runs `git commit -m "..."`. Commit `4f6988745` lands with **40 files**, not 4. The 36 extras: 5 zettel files created by other agents (z033–z036, z038), 30 small body modifications from a concurrent gin→usegin sed-rename pass, plus `tools/dx/src/cli.ts` and `usegin/zettel/SLICE-1.md`.
- 13:55 UTC — Reflog shows a *second* "feat(dx-app): his — close the punch list" entry: `4ca8d30fe HEAD@{1}`, with `9853ed033 HEAD@{2}: reset: moving to HEAD` between it and `9853ed033 HEAD@{3}` itself. Two parallel `git commit` calls on the same `.git/index`.
- 13:55 UTC — Push to `origin/main` succeeds. Commit message claims 4-file scope; on-disk content is 40-file scope.

## Five whys

- **Why** did a 4-file `git diff --cached` produce a 40-file commit?
  - **A:** Another agent's `git add` ran between UseGin's `git diff --cached` (13:54) and UseGin's `git commit` (13:55). The `.git/index` UseGin's commit captured was not the index UseGin had inspected.
  - **Why** did another agent's `git add` mutate UseGin's index?
    - **A:** There is exactly one `.git/index` per checkout. Both agents share `/workspaces/test-mvp/`. Both agents call `git add` and `git commit` against the same index. Git takes a per-operation lock on `.git/index.lock` but provides no transaction across "diff cached → commit": between those two calls, another writer can re-stage anything, including `-A`-style sweeps from autosync.
      - **Why** do two agents share one checkout?
        - **A:** ← *root cause: leverable here.* The devcontainer assumes one operator per checkout. Multiple concurrent Claude sessions (UseGin main + sub-agents + watcher autosync + Claude in another tab) all run against `/workspaces/test-mvp/`. The shared-checkout model is the systemic enabler; everything else (autosync sweeps, race timing, message-mismatch) is downstream of it.

## Root cause

**One sentence, systemic:** Multiple concurrent Claude sessions share a single git checkout (`/workspaces/test-mvp/`) with one `.git/index`, and `git`'s lockfile protects individual operations but not the "stage → commit" interval, so any concurrent committer can land another agent's staged or unstaged work under their own commit message.

## Fixes

### Immediate

1. `git revert 4f6988745 --no-edit` — append a clean undo commit (no history rewrite per CLAUDE.md "no force-push").
2. `git checkout 4f6988745 -- usegin/zettel/zettels/z039-*.md usegin/zettel/gaps.md usegin/zettel/organizing-process.md usegin/zettel/README.md` — restore UseGin's legitimate files from the bad commit.
3. `git commit` them under a tight, accurate message scoped only to UseGin's 4 files.
4. Push.

The 5 untracked zettel files (z033–z036, z038) and the 30 sed-rename body edits go back to where they were — unstaged and untracked — so their owning agents recommit them under their own messages on their next opportunity. (They will pick them up via the same shared checkout; this is the recurrence vector still being open until the system fix lands.)

### System

The lever identified is **per-agent isolation**: each Claude session works in its own `git worktree` rather than the shared root. Memory entry `feedback_main_wt_stay_on_main.md` already says "use real git worktrees for branch work." Several `.worktrees/eng-*` already exist, suggesting the muscle is partially there.

The system change is one of:

1. **Strict:** every Claude session, on startup, allocates a `.worktrees/<session-id>/` and works there. Push from the worktree to `main`. The shared root is reserved for the human. **Cost:** one-time devcontainer startup change; per-session disk; harder to read each-other's work in real time. **Benefit:** zero shared-index races, ever.
2. **Loose:** add a pre-commit tripwire that compares `git diff --cached --name-only` between commit-message-construction-time and commit-execution-time. If they disagree, abort with a "scope drifted — re-stage" message. **Cost:** small hook. **Benefit:** catches the race; doesn't prevent it.

System change to land *this turn* is option 2 (the tripwire), so recurrence is detected immediately. Option 1 is a follow-on Linear ticket — bigger but the right end-state.

### Tripwire

The pre-commit hook diff-name check above is the tripwire. If recurrence happens, the hook rejects the commit and points at this tikur record.

## Zettel

`z041` — *Two agents, one checkout, one race.* Threads ↑z028 ~z040 ~`reference_autosync_concurrent_collisions`. Distilled in usegin/zettel/zettels/.

## Notes for follow-up tikur

- Re-examine the system fix after one week of operating under the tripwire. If the tripwire fires often, that's evidence option 1 (worktree-per-session) is needed; if it never fires, the loose fix may be sufficient.
- Two agents converged on the same commit *message* (`feat(dx-app): his — close the punch list`) at the same time — that's an independent collision pattern. Also evidence of shared-checkout downstream effects.
