---
name: searching-bash-history
description: This skill should be used when searching through bash command history using atuin. Triggered by phrases like "search history for", "find commands that", "what commands did I run", or "show me bash history". Helps search and retrieve relevant commands from atuin shell history.
---

# Searching Bash History

## Overview

Search through bash command history using atuin to find previously executed commands. All bash commands executed by Claude Code are automatically logged to atuin via the posttool hook.

## When to Use

Use this skill when:
- User asks to find commands they or Claude ran previously
- Need to recall specific commands or patterns
- Looking for examples of how something was done before
- Investigating what commands were executed in a session

## Workflow

### 1. Search for Commands

Use `atuin search` with a query term:

```bash
atuin search "query"
```

This will interactively search history. For non-interactive use, pipe output or use list commands.

### 2. List Recent Commands

Show recent command history:

```bash
atuin history list --cmd-only --reverse false | head -20
```

Options:
- `--cmd-only`: Show only the command text (no timestamps/metadata)
- `--reverse false`: Show newest first (default is oldest first)
- Pipe to `head -N` to limit results

### 3. Search with Filters

Search using grep patterns on the history list:

```bash
atuin history list --cmd-only | grep "pattern"
```

### 4. Get Last Command

Retrieve the most recently executed command:

```bash
atuin history last
```

## Examples

### Find all git commands
```bash
atuin history list --cmd-only | grep "^git"
```

### Show last 10 npm commands
```bash
atuin history list --cmd-only | grep "npm" | head -10
```

### Find commands with specific keywords
```bash
atuin history list --cmd-only | grep -i "docker\|container"
```

### View recent activity
```bash
atuin history list --cmd-only --reverse false | head -30
```

## Tips

- All Claude Code bash commands are automatically logged via the PostToolUse hook
- Search is case-sensitive by default, use `grep -i` for case-insensitive
- Use `--cmd-only` to get clean output without timestamps
- Combine with grep/head/tail for powerful filtering
- The history includes commands from both interactive shell and Claude Code
