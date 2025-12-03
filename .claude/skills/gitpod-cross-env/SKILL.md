---
name: gitpod-cross-env
description: This skill should be used when interacting with other Gitpod environments from within an environment. Use for SSH sessions, running commands remotely, or managing multiple environments. Triggered by phrases like "ssh into environment", "connect to other env", or "run command on <env-id>".
---

# Gitpod Cross-Environment Interaction

## Overview

Interact with other Gitpod environments from within an environment. Requires user/org authentication (not the default environment identity).

## When to Use

Use this skill when:
- SSHing into another Gitpod environment
- Running commands on a remote environment
- Managing multiple environments (list, stop, etc.)
- Running Claude Code on a remote environment

## Workflow

### 1. Check Current Identity

```bash
gitpod whoami
```

If it shows `PRINCIPAL_ENVIRONMENT`, you can only see the current environment. Need to login as user/org.

### 2. Login as User/Org

```bash
gitpod login
```

This opens a browser auth flow. After login, you can see all environments in your org.

### 3. List All Environments

```bash
gitpod environment list
```

### 4. SSH into Another Environment

Use tmux for interactive SSH sessions (see `interactive-cli` skill):

```bash
tmux new-window -n gitpod-ssh
tmux send-keys -t gitpod-ssh 'gitpod environment ssh <env-id>' Enter
sleep 3 && tmux capture-pane -t gitpod-ssh -p
```

### 5. Verify Connection

**Gotcha:** When SSHing between environments of the same repo, the shell prompt looks identical (same path, same branch). This makes it appear the SSH returned immediately without connecting.

Always verify you're in the remote environment:

```bash
tmux send-keys -t gitpod-ssh 'echo "ENV_ID: $GITPOD_ENVIRONMENT_ID"' Enter
sleep 1 && tmux capture-pane -t gitpod-ssh -p
```

The `GITPOD_ENVIRONMENT_ID` confirms which environment you're in.

### 6. Run Commands Remotely

```bash
# Via SSH session
tmux send-keys -t gitpod-ssh '<command>' Enter
sleep 1 && tmux capture-pane -t gitpod-ssh -p

# Or directly without SSH
gitpod environment exec <env-id> -- <command>
```

### 7. Run Claude Code Remotely

For non-interactive Claude Code on the remote environment:

```bash
tmux send-keys -t gitpod-ssh 'claude --print --permission-mode bypassPermissions "<prompt>"' Enter
sleep 15 && tmux capture-pane -t gitpod-ssh -p
```

Key flags:
- `--print`: Non-interactive output mode
- `--permission-mode bypassPermissions`: Skip approval prompts for tool use

### 8. Clean Up

```bash
# Exit SSH session
tmux send-keys -t gitpod-ssh 'exit' Enter

# Kill the tmux window
tmux kill-window -t gitpod-ssh
```

## Other Environment Commands

```bash
# Stop an environment
gitpod environment stop <env-id>

# Get environment details
gitpod environment get <env-id>
```

## Tips

- **Always verify connection** - Check `$GITPOD_ENVIRONMENT_ID` after SSH
- **Use descriptive window names** - e.g., `gitpod-ssh-<short-id>`
- **Wait for Claude** - Remote Claude commands need 10-20s to complete
- **Read before writing** - Always capture pane before sending commands
