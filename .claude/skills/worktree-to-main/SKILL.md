---
name: worktree-to-main
description: Do work in a throwaway git worktree, push HEAD:main, clean up. Use when the user asks to "fix in a worktree pushing to main", "do this in a worktree", "use a worktree, push direct to main", or whenever the main worktree (`/workspaces/test-mvp`) must stay on `main` while you build a commit elsewhere — so other agents can pull from `origin/main` without colliding.
---

# Worktree-to-main

Build a commit in a throwaway worktree, push it to `origin/main`, clean up. The primary worktree at `/workspaces/test-mvp` never leaves `main`.

This is how Gin should ship code when other agents (or the human) might be working in the main worktree: nothing in their working tree changes, they just `git pull` once your commit lands on `origin/main`.

## When to use

- User says "fix in a worktree, push to main" / "use a worktree" / "do it on a side branch and push to main".
- You need to work on multiple things at once and shouldn't disturb the primary worktree.
- Memory rule [`feedback_main_wt_stay_on_main`](memory) — never `git checkout` away from `main` in `/workspaces/test-mvp`.

## When NOT to use

- The change is already aligned with `origin/main` and you're editing in the primary worktree under `main` directly — just commit and push there.
- The work isn't ready for `main` yet (use a feature branch normally).
- Anything that requires force-push, staging/prod deploys, or human review gates — those go through the human.

## Steps

```bash
# 1. Refresh main and create a worktree off origin/main on a throwaway branch.
git fetch origin main --quiet
WT=/tmp/wt-<short-slug>           # e.g. /tmp/wt-eng-5497
BRANCH=<short-slug>-<topic>       # e.g. eng-5497-hudson-placeholder
git worktree add -b "$BRANCH" "$WT" origin/main

# 2. (Optional) Symlink node_modules so tooling (tsgo, eslint, bun) works
#    without a fresh install in the throwaway worktree.
ln -s /workspaces/test-mvp/nextjs-app/node_modules "$WT/nextjs-app/node_modules"
ln -s /workspaces/test-mvp/node_modules            "$WT/node_modules"
# (Add more for python-services / tools/ if you'll touch them.)

# 3. Edit, typecheck, test inside $WT.
cd "$WT"
# ... Edit / Read tools, scoped tests, typecheck ...

# 4. Commit on the throwaway branch.
git add <paths>
git commit -m "fix(scope): subject\n\nBody.\n\nCloses: ENG-XXXX"

# 5. Push the commit to origin/main from the throwaway branch.
git push origin HEAD:main

# 6. Verify origin/main actually has your content
#    (memory: reference_autosync_concurrent_collisions —
#     a successful push log alone is not proof; check the file).
git fetch origin main --quiet
git show origin/main --stat -1
git show origin/main:<path/to/changed/file> | grep <expected-token>

# 7. Cleanup: remove the symlinks (so worktree remove doesn't choke or
#    leak across worktrees), remove the worktree, delete the branch.
rm "$WT/nextjs-app/node_modules" "$WT/node_modules" 2>/dev/null
git worktree remove "$WT"
git branch -D "$BRANCH"
```

## Notes

- **Push form is `HEAD:main`**, not `git push origin main`. The throwaway branch is local-only; `HEAD:main` tells git to push the current commit *to* the remote `main` ref directly.
- **Pre-push hooks run** as usual (lint, typecheck, scoped unit tests) — that's the gate. If the push is rejected for test/lint failures, fix them in the worktree, commit, push again. Never `--no-verify`.
- **If the push is rejected because `origin/main` advanced**, rebase the throwaway branch on the new `origin/main` and push again:
  ```bash
  git fetch origin main --quiet
  git rebase origin/main
  git push origin HEAD:main
  ```
- **Don't skip step 6.** Per memory, two collision modes exist where the push reports success but `origin/main`'s contents don't match what you expect. Reading the file on `origin/main` is the only proof.
- **Don't `git checkout main` in the throwaway worktree** to "merge it back" — there's nothing to merge, the commit is already on `origin/main`. Just remove the worktree.
- **Symlinking node_modules is optional**, but skipping it means `bun install` / `uv sync` from scratch in the throwaway worktree. Symlinks are faster and safe as long as you remove them before `git worktree remove`.

## Linear flow

If the work is tracked in Linear, the canonical flow is `plan start <id>` before step 1, and `plan close <id>` after step 7.
