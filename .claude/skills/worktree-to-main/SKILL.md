---
name: worktree-to-main
description: Fix it in a worktree, pushing directly to main. Other agents will pull to main worktree. Triggered by "in a worktree push to main", "use a worktree, push direct to main", or when the primary worktree must stay on main.
---

# worktree-to-main

Fix it in a worktree, pushing directly to main. Other agents will pull to main worktree.

```bash
git worktree add -b <slug> /tmp/wt-<slug> origin/main
cd /tmp/wt-<slug>
# edit, commit
git push origin HEAD:main
git worktree remove /tmp/wt-<slug> && git branch -D <slug>
```
