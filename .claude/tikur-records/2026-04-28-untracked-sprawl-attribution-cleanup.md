# Tikur: untracked-file sprawl from concurrent multi-agent sessions (2026-04-28 attribution cleanup)

**Date:** 2026-04-28
**Severity:** medium  (recurrence: high — every multi-agent day produces sprawl; blast: real work sits unprotected for hours, vulnerable to z094-style `git reset --hard` wipes by sibling agents)
**Status:** lekach-landed (this record); system-fix-deferred (autosync untracked-snapshot)
**Category:** error  (no safeguard was bypassed; the substrate has no per-author commit pressure on new files)
**Author:** Zisser (sub-agent of `843f23c9`, ziser tmux window)

## Timeline

- **2026-04-27** afternoon onward: at least four sessions write new files into the working tree without committing. RD whiteboards (Gin-C3 autonomous, ENG-5416), z094 itself (the *zettel that names this exact failure mode*), zisser persona scaffolding, slack/drive tikur drafts.
- **2026-04-28** all morning + afternoon: ziser session (`843f23c9`) and three sibling sessions (eval `c9d84b44`, drive `2e850507`, slack-2 `1bd3d9e0`/`fd77d383`) all Write into the working tree. Eval session crashes mid-S5 leaving five `tools/dx/src/evals/{commands,lib}/iterate*.ts` files in mid-fix state. Slack and drive sessions add tikur records but don't commit. Ziser session adds 50+ files (glasses, personas, cage, moazash, memento, m-stop/m-resume skills, zettels z110/z111) without per-file commits.
- **2026-04-28 ~16:00 UTC**: working tree shows ~27 untracked-entry roots = ~81 files. Lihu spawns Zisser sub-agent with explicit charter: *"don't bulk-commit them under one author. Find who created each, and have THEM commit their own work."*
- **2026-04-28 ~16:30 UTC**: attribution map built from JSONL `Write`/`Edit` tool-use grep against parent + subagent JSONLs. Per-owner commits dispatched: 6 commits by Zisser (own + dead-author), 2 tmux directives sent to alive owners (eval + drive). Untracked count drops to 9 entries — exactly the residual the charter reserved for alive agents.

## What went right

- **Per-author attribution worked.** JSONL grep for `"file_path":"/workspaces/test-mvp/<path>"` against parent+subagent JSONLs gave a clean signal for every file with active write attribution. Files whose Writes were in *sub-agent* JSONLs (z094 from autonomous Gin-C3, evals iterate-*.ts from c9d84b44 sub-agents, app-driver tikur from agent-a2) showed up correctly when the search descended into `<parent>/subagents/`.
- **Specific-path staging held.** Six commits, never `-A`, never `git add .`. Two concurrent-commit collisions (drive session + me) handled cleanly via lock-clears + retries — no work lost.
- **Origin contents verified after each push.** `git log --oneline origin/main -1` matched local SHA every time; per `reference_autosync_concurrent_collisions`, that's the only honest verification.
- **Charter's "do NOT commit on behalf of alive eval session" honored.** Eval files (mid-flight S5) stayed untracked; eval session got a tmux directive with the gitignore + env-gate pre-conditions from their own polaroid.

## What went wrong

- **Files sat in the working tree for ~24 hours unprotected.** z094 itself — the zettel that *names* the exact failure mode of "untracked files vanish on `git reset --hard`" — was untracked for 18+ hours after creation. If any sibling agent had run `git reset --hard` in that window, z094 would have died. The doctrine ("commit-on-Write, not commit-at-end-of-task" per z094) didn't compound into per-session habit.
- **Memory note `feedback_first_place_we_looked` says: when a capability is missed, the fix lands in the first place we looked.** The cluster is now visible: at least three tikurs/zettels in the corpus name this pattern (z094 autonomous-collision, `feedback_git_add_rm_pattern` rename+sed RM-status gap, `reference_autosync_concurrent_collisions` Mode-2 silent-revert). The substrate keeps producing the same failure shape because no per-Write commit pressure exists. *Three touches = the cluster is the finding, not the incident* (cluster-search principle 9).

## Lekach (לקח)

**The fix is not "remind every Gin to commit on Write."** That's the existing rule and it doesn't compound. The fix is **infrastructure-level**:

1. **Autosync watcher should `git stash --include-untracked` before any reset.** Already named as open-end in z094; still unimplemented.
2. **Per-agent `dx wt` (work-tree) discipline.** Each long-running session in its own real git worktree, so untracked files in tree A can't be wiped by `git reset` in tree B. (Existing partial: `.claude/skills/use-gin/SKILL.md` already documents `enter-worktree` for branch work; the missing piece is *long-running-multi-agent main sessions also belong in worktrees*, not just feature branches.)
3. **A periodic untracked-sweep tool.** Not a hook (too aggressive); a `dx untracked-sweep --attribute-and-direct` command that does what this Zisser invocation just did, runnable any time the tree gets sprawling. Until then, the same Zisser charter is the manual procedure.
4. **Per-session "open-to-empty Polaroid pressure" already exists** via memento; what's missing is the same pressure applied to *uncommitted-on-disk*. A scoped Polaroid that says "I have N untracked files older than M minutes" would close the gap.

## Cluster

| Touch | Artifact | What it names |
|---|---|---|
| 1 | `usegin/zettel/zettels/z094-autonomous-collision-untracked-files-can-vanish-on-reset.md` | reset-hard wipes untracked siblings' work |
| 2 | `feedback_git_add_rm_pattern` (memory) | `awk '/^ M/'` misses RM status — over-narrow staging selectors |
| 3 | `reference_autosync_concurrent_collisions` (memory) | concurrent push silently reverts committed work |
| 4 | this tikur | per-author commit pressure missing for new files in multi-agent sessions |

Cluster signal: **the substrate's git story doesn't account for N concurrent agents writing into one working tree.** Each of the four touches names a *symptom*; none of the four has landed an *infrastructure fix*. The lekach's #1–#3 above are the candidate fixes; pick one and ship it.

## Per-author commits made by this cleanup

- `5b2941ac1` recover: zettel z094 + personas-and-teams RD whiteboards [recovered] (dead author: Gin-C3 autonomous)
- `d7f502b48` memento: introduce Polaroid system (zisser session)
- `38663a572` usegin: introduce glasses, cage, moazash (zisser session)
- `920574d1d` personas: wild-glass animals + creative archetypes (zisser session)
- `c6959c68b` zettels: z110 + z111 (zisser session)
- `6573359a6` skills: m-stop and m-resume (zisser session)
- `55c8c89e8` (already landed by main session before this cleanup) tikur: app-driver+rtk silent-exit

## Directives sent to alive agents

- **eval session** (`c9d84b44`, window 3): commit `tools/dx/src/evals/{commands,lib}/iterate*.ts` + `.claude/skills/evals-iterate/` + `usegin/evals/effi/iterate-runs/` + `usegin/memento/scopes/evals-build/latest.md`. Pre-conditions per their polaroid: gitignore for `iterate-runs/`, env-gate for evals-iterate hook.
- **drive session** (`2e850507`, window 1): commit `.claude/tikur-records/2026-04-27-stale-client-ids-in-browser-prompt.md` + `usegin/memento/scopes/effi-drive-oauth/latest.md`.

## Tattoos that held

- `feedback_git_add_rm_pattern`: specific paths, never `-A`. Held.
- `reference_autosync_concurrent_collisions`: verify origin contents after push. Held — every push verified.
- `feedback_main_wt_stay_on_main`: never `git checkout` away from main in `/workspaces/test-mvp`. Held.
- z094 (open-end): commit-on-Write to make new files durable. **The cleanup itself is the manual application of this rule across 24h of accumulated drift.**
- z109 (tikur self-tripwire): if you defer a system-fix mid-cleanup, name it. Done — lekach #1–#3 explicitly named, status `system-fix-deferred`.

## Don't-trust-yourself

- The 9 residual untracked entries are **not done** — they're owned by alive agents. If those agents go to sleep without committing, the next Zisser cleanup needs to commit-on-behalf with the dead-author shape used here for `[recovered]`.
- This tikur lands the lekach; it does **not** land any of the three system fixes. Per z109, an unlanded tikur becomes the next tikur's root cause. Lihu / future Zisser: pick one of #1–#3 and land it before the next sprawl event.
