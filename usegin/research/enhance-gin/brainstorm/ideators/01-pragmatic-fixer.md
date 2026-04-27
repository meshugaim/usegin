# Ideator 01 — Pragmatic Fixer

## Priming (one sentence)
The least-elaborate viable fix is almost always the right one.

## Ideas

- **Lint/test the diff, not the tree**: change pre-push to run tsgo/lint/test against `git diff origin/main...HEAD` filepaths only. Why: directly kills the z095 root cause in ~20 lines of bash; the working tree's unrelated WIP becomes irrelevant.
- **`git stash -u` before pre-push, pop after**: wrap the pre-push hook in stash-unstage-pop so checks run against HEAD only. Why: 5-line shell change, no architectural shift, immediately solves "stranger files block my push".
- **Disable autosync `reset HEAD~1` entirely**: on push failure, just leave the commit and surface "push failed, commit preserved at <sha>". Why: the reset was the loss vector. Removing it ends 4-commits-eaten with one deletion.
- **On push failure, push to `gin/orphan/<sha>` instead of resetting**: cheap side-branch dump, never lose work. Why: one extra `git push origin HEAD:refs/heads/gin/orphan/$(git rev-parse --short HEAD)` line; commit always survives.
- **Per-agent commit author identity**: set `GIT_AUTHOR_NAME=gin-<sessionId>` so attribution is forensic-traceable even when files mix. Why: solves attribution without solving collision; `git log --author` becomes the recovery tool.
- **`dx push` instead of raw `git push`**: a one-screen wrapper that does diff-only checks + side-branch fallback + reflog tag. Why: one place to fix, all agents inherit; no hooks to coordinate.
- **Tag every autosync commit with `gin-autosync-<timestamp>` ref**: recovery is `git for-each-ref refs/tags/gin-autosync-*`. Why: turns reflog-archaeology into a single-command list. ~3 lines.
- **`dx wait-for-clean-tree` primitive**: `until git status --porcelain | grep -q .; do sleep 2; done` with timeout, called before push. Why: cheapest fix for "storm in progress, defer push". The zettel literally lists this as option (c).
- **Lockfile around the commit-and-push critical section**: `flock /tmp/gin-push.lock` on the push pipeline. Why: serializes concurrent agents at git's sharpest edge. 1 line of shell.
- **Only autosync explicitly-staged files**: `git commit` with `-o <paths>` not `-a`. Never sweep up unrelated dirty files. Why: kills Mode-1 (stranger files under my message) at the source. Same turn fix.
- **Per-agent index file**: `GIT_INDEX_FILE=.git/index.gin-<session>` so each agent has its own staging area. Why: git already supports this; concurrent stages stop colliding. Zero new code.
- **Refuse to commit when working tree has files not authored this session**: cheap heuristic, dx-tracks "files I touched this session", refuses to sweep up the rest. Why: one in-process set, prevents Mode-1 cleanly.
- **Pre-push only runs on doc/code split**: if all changed files are `*.md` or `usegin/**`, skip the typecheck. Why: 90% of zettel/docs pushes need zero TS check. Two-line fast-path.
- **Skip pre-push hook for usegin/research/zettel changes via path filter**: same idea, encoded in the hook's first 5 lines. Why: zettels should never wait on someone's broken tsx. Ship.
- **Just turn off the pre-push hook for now**: rely on CI; agents push freely; humans see CI fail. Why: configuration > code; most aggressive simple fix; if CI catches it staging is fine.
- **Commit-only-tracked-and-staged in autosync**: `git add -u` not `git add -A`. Why: untracked sibling files stop riding into your commit. One char change.
- **Per-agent worktree**: each agent runs in `git worktree add ../wt-$session main`; main checkout never touches their dirt. Why: git's built-in solution; 5 lines in agent bootstrap; total isolation.
- **Push retry with exponential backoff + rebase on rejection**: instead of reset, just `git pull --rebase && git push` up to 3 times. Why: most rejections are non-ff, not test failures. Simple loop.
- **Detect storm via stash count**: `if [ $(git stash list | wc -l) -gt 5 ]; then echo "STORM, deferring"; exit 0; fi`. Why: zettel says stash hit 27. Stash count is a free storm-meter.
- **Surface push failures in statusline**: just print "PUSH FAILED — see X" in red on the prompt line. Why: humans notice; agents don't silently swallow. Status line already exists.
- **Remove `git add -A` from autosync entirely**: only commit files modified by this agent's tracked Edit/Write tool calls. Why: the PostToolUse hook already knows what was edited. Use that set.
- **Reflog auto-snapshot before any reset in autosync**: `git tag gin-pre-reset-$(date +%s) HEAD` before `reset HEAD~1`. Why: belt-and-suspenders; reflog already does this but tags survive longer + are findable.
- **Defer push when other agents are mid-edit**: `dx` pidfile lockmap; if any peer's edit-timer is <30s ago, sleep. Why: cheapest collision-avoidance, no git knowledge needed.
- **Pre-push only fails on errors in YOUR files**: parse tsgo output, filter to `git diff origin/main...HEAD --name-only`, exit 0 if no errors in those files. Why: fixes z095 even keeping whole-tree analysis; ~10 lines of grep.
- **`dx recover` command**: prints last 10 reflog entries for HEAD with timestamps + diffstat, prompts "restore which?". Why: turns "investigation" into a menu. Most of the code is already in `git reflog`.
- **Hard limit: one commit per push window**: small commits stop accumulating before push, so blast radius of a reset is one commit. Why: trades push frequency for loss-resistance. Config-only.
- **Default autosync to OFF; opt in per-session**: shift the default; sessions that want it run `dx autosync on`. Why: most sessions don't need every-tool-use commits. The danger only exists when it's on.
- **`git push --no-verify` for usegin-only diffs**: literal escape hatch, applied conditionally. Why: skip the hook when the hook can't possibly fail meaningfully. Already supported by git.
- **Branch protection + require-PR mode for ambitious sessions**: agents push to `gin/<session>` branches, fast-forward into main only when clean. Why: GitHub's existing primitives; humans/CI gate the merge.
- **Just slow down**: rate-limit autosync to once per 60s. Why: most collisions are sub-second races. A simple sleep eliminates the storm shape.
