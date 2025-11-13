---
name: searching-bash-history
description: This skill should be used when searching through bash command history using atuin. Triggered by phrases like "search history for", "find commands that", "what commands did I run", or "show me bash history". Helps search and retrieve relevant commands from atuin shell history.
---

# Searching Bash History

## Overview

Search through bash command history using atuin. All bash commands executed by Claude Code are automatically logged to atuin via the PostToolUse hook.

## Getting Started

**First, use `atuin --help` and `atuin history --help` to understand available commands.**

## Common Examples

### Search for commands with timestamps
```bash
atuin search "git"
```

### List recent commands (newest first)
```bash
atuin history list --cmd-only --reverse false | head -20
```

### Find specific patterns
```bash
atuin history list --cmd-only | grep "npm"
```

## Tips

- Use `atuin --help` and subcommand help (e.g., `atuin search --help`) to explore options
- Combine with grep/head/tail for filtering
- All Claude Code bash commands are automatically logged
