# Gitpod Cross-Environment Interaction

## Overview

Interact with other Gitpod environments from within an environment.

## Key Insight

By default, each Gitpod environment is authenticated as `PRINCIPAL_ENVIRONMENT` (its own identity), which only sees itself. To see and interact with other environments, you need to log in as your user/org.

## Workflow

### 1. Check Current Identity

```bash
gitpod whoami
```

If it shows `PRINCIPAL_ENVIRONMENT`, you can only see the current environment.

### 2. Login as User/Org

```bash
gitpod login
```

This opens a browser auth flow. After login, you can see all environments in your org.

### 3. List All Environments

```bash
gitpod environment list
```

### 4. Interact with Other Environments

```bash
# SSH into another environment
gitpod environment ssh <env-id>

# Run a command in another environment
gitpod environment exec <env-id> -- <command>

# Stop an environment
gitpod environment stop <env-id>
```

## Using with Interactive CLI Skill

For SSH sessions, use tmux (see `interactive-cli` skill):

```bash
tmux new-window -n gitpod-ssh
tmux send-keys -t gitpod-ssh 'gitpod environment ssh <env-id>' Enter
sleep 3 && tmux capture-pane -t gitpod-ssh -p
```
