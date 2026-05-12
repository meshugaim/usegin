# Nitsan — personal CLAUDE.md

Per-user instructions surfaced at session start when `dx identify` says
`live_user=nitsan`. Other live users never see this file.

Add preferences, working style notes, or per-user overrides here.
Empty body = silent banner.

## Worktrees push directly to main

Worktrees are great for filesystem isolation between parallel agents, but
I prefer agents push directly to `main` from the worktree (like the
`/wt` / `worktree-to-main` skill) rather than creating feature branches.
One trunk, many worktrees. The worktree is for fs isolation, not branch
isolation — other agents pull from `main`, so work needs to land there
to be visible.
