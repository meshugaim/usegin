---
name: autopull
description: Automatic polling to pull from main branch. Triggered by phrases like "enable autopull", "disable autopull", "pull from main", "poll main", or "keep branch updated".
---

# Autopull

Automatically poll and rebase from origin/main to keep feature branches current. Companion to autosync (which handles pushing).

## When to Use

- User wants to keep their branch up-to-date with main
- User mentions "pull from main", "stay current", "sync from main"
- User wants to reduce merge conflicts
- User mentions "polling", "auto-pull"

## CLI Reference

```bash
# Enable with default interval (5 minutes)
bun run autopull enable

# Enable with custom interval (in seconds)
bun run autopull enable 120  # Poll every 2 minutes

# Disable
bun run autopull disable

# Check status
bun run autopull status

# Start the background daemon
bun run autopull start

# Stop the daemon
bun run autopull stop

# Run a single poll cycle (manual)
bun run autopull poll

# Resume after conflict resolution
bun run autopull resume
```

## How It Works

When enabled and daemon is running:

1. Poll periodically (configurable interval)
2. Skip if working tree is dirty (uncommitted changes)
3. Skip if rebase already in progress
4. Fetch from origin/main
5. Rebase if remote has new commits
6. If conflict: abort rebase, pause polling, notify user

## Key Points

| Behavior | Description |
|----------|-------------|
| Opt-in | Must explicitly enable per environment |
| Daemon-based | Background process polls on interval |
| Safe | Won't pull with dirty working tree |
| Conflict handling | Pauses and waits for manual resolution |
| Resumable | After fixing conflicts, run `autopull resume` |

## Conflict Resolution

When autopull detects a conflict during rebase:

1. Rebase is aborted (your changes are preserved)
2. Polling is paused
3. You'll see a notification

To resolve:
```bash
# 1. Manually rebase and resolve conflicts
git fetch && git rebase origin/main
# (fix conflicts, git add, git rebase --continue)

# 2. Resume polling
bun run autopull resume
```

## Configuration

State stored in git config (local per environment):

```bash
# Check all autopull settings
git config --local --get-regexp autopull

# autopull.enabled: true/false
# autopull.interval: seconds between polls
# autopull.paused: true when conflict detected
```

## Together with Autosync

Complete bi-directional sync:

- **autosync**: post-commit hook → push to origin
- **autopull**: polling → pull from main

Enable both for full automatic sync:
```bash
bun run autosync enable
bun run autopull enable
bun run autopull start
```
