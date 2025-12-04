---
name: syncing-claude-sessions-between-gitpod-envs
description: Sync Claude Code sessions between Gitpod environments. Triggered by phrases like "sync sessions", "pull sessions from", "push sessions to", "get conversation history from other env", or "continue conversation from another environment".
---

# Syncing Claude Sessions Between Gitpod Environments

## Overview

Sync `~/.claude/` data between Gitpod environments for conversation continuity. Uses the `gitpod-claude-sync` CLI.

## When to Use

- User wants to continue a conversation from another environment
- User asks to sync sessions, pull/push conversation history
- User mentions "other env", "another environment" with sessions/conversations
- Starting work in a new environment and need previous context

## CLI Reference

```bash
# List available environments
bun run gitpod-claude-sync envs
bun run gitpod-claude-sync envs --running

# Pull sessions FROM remote TO local
bun run gitpod-claude-sync pull <env> --all
bun run gitpod-claude-sync pull <env> --all --dry-run
bun run gitpod-claude-sync pull <env> abc123 def456  # specific sessions

# Push sessions FROM local TO remote
bun run gitpod-claude-sync push <env> --all
bun run gitpod-claude-sync push <env> --full-sync   # includes todos, plans, etc.

# List sessions on remote env
bun run gitpod-claude-sync list <env>
```

## Environment Targeting

| Format | Example |
|--------|---------|
| Name | `red`, `blue` |
| ID prefix | `019ae9fb` |
| Full ID | `019ae9fb-a0c1-7ec3-a15e-c422a7804e40` |

## Workflow

### 1. Check Available Environments

```bash
bun run gitpod-claude-sync envs --running
```

### 2. Preview What Would Sync

```bash
bun run gitpod-claude-sync pull <env> --all --dry-run
```

### 3. Pull Sessions

```bash
bun run gitpod-claude-sync pull <env> --all
```

### 4. Full Sync (Optional)

For todos, plans, history, and more:

```bash
bun run gitpod-claude-sync pull <env> --full-sync
```

## Sync Modes

| Flag | What syncs |
|------|------------|
| `--all` | All sessions for current project |
| `--full-sync` | projects, todos, plans, history, session-env, file-history |
| `<session-ids>` | Specific sessions only |

**Never synced:** `.credentials.json` (security)

## Error Handling

| Error | Solution |
|-------|----------|
| Not logged in | Run `gitpod login` |
| Env not found | CLI shows available envs |
| Env not running | Start the environment first |

## Tips

- Always use `--dry-run` first to preview
- Use env names instead of IDs when available
- Pull is more common than push (get history into new env)
