---
name: autosync
description: Automatic git sync after commits. Triggered by phrases like "enable autosync", "disable autosync", "turn on auto push", or "sync commits automatically".
---

# Autosync

Automatically push commits to origin after each commit. Keeps multiple Gitpod environments in sync with linear history.

## When to Use

- User wants to enable/disable automatic git sync
- User asks about keeping environments in sync
- User mentions "auto push", "sync commits", "linear history"

## CLI Reference

```bash
# Enable for this environment
bun run autosync enable

# Disable
bun run autosync disable

# Check status
bun run autosync status
```

## How It Works

When enabled, a post-commit hook runs after each commit:

1. Fetch from origin
2. Rebase if remote has new commits
3. Push to origin
4. If rebase conflicts: abort, keep local commit, notify user

## Key Points

| Behavior | Description |
|----------|-------------|
| Opt-in | Must explicitly enable per environment |
| Main only | Only syncs on `main` branch or worktrees |
| Silent success | Single line output on push |
| Safe conflicts | Aborts rebase, preserves local commit |

## Branch Behavior

Autosync only triggers when:
- On the `main` branch directly, OR
- In a worktree (which pushes to `main` regardless of local branch name)

Autosync is **inactive** (silently skipped) on:
- `staging` branch
- `production` branch
- Any other feature/topic branches

This prevents accidental pushes to deployment branches while keeping the convenience for trunk-based development.

## Companion: Autopull

See also `autopull` - the companion feature that polls and pulls from main periodically. Together they provide complete bi-directional sync:

- **autosync**: post-commit hook → push to origin
- **autopull**: polling → pull from main

## Spec

See `docs/autosync.spec.md` for full details.
