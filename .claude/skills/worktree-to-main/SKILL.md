---
name: worktree-to-main
description: work in a worktree, pushing directly to main. Other agents will pull to main worktree. Triggered by "in a worktree push to main", "use a worktree, push direct to main", or when the primary worktree must stay on main.
---

# worktree-to-main

Work in a worktree, pushing directly to main. Other agents will pull to main worktree.

```bash
git worktree add -b <slug> /tmp/wt-<slug> origin/main
cd /tmp/wt-<slug>
# edit, commit
git push origin HEAD:main
git worktree remove /tmp/wt-<slug> && git branch -D <slug>
```

## node_modules in the worktree

A fresh worktree has no `node_modules`. Two paths:

- **Symlink (fast, default):** `ln -sf /workspaces/test-mvp/nextjs-app/node_modules /tmp/wt-<slug>/nextjs-app/node_modules`. Works for pre-push hooks that only run lint / typecheck / unit tests (the common case).
- **Real `bun install` (slow but build-safe):** `cd /tmp/wt-<slug>/nextjs-app && bun install`. Required when pre-push will trigger a Next.js build — i.e. when the diff touches Server Actions, pages, or config that pre-push detects as build-affecting. Turbopack rejects symlinks that point outside the worktree filesystem root with `Symlink [project]/node_modules is invalid, it points out of the filesystem root`.

If unsure, start with the symlink and fall back to `bun install` (or push from the main worktree using `git push origin <sha>:main`) if the build leg of pre-push trips. Don't `--no-verify`.
