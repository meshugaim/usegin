---
name: interactive-cli
description: This skill should be used when running interactive CLI tools that require user input, browser authentication, or long-running processes. Use tmux to manage interactive sessions, handle prompts, and monitor output for commands like `railway login`, `railway ssh`, SSH sessions, or interactive installers.
---

# Interactive CLI

## Overview

Run interactive CLI tools using tmux to handle user prompts, browser authentication flows, and long-running processes. This enables interaction with CLIs that don't work in non-interactive mode.

## When to Use

Use this skill when:
- CLI requires interactive prompts (e.g., "Open browser? (Y/n)")
- Command fails with "Cannot run in non-interactive mode"
- Need to manually test or execute an interactive CLI
- Running a long interaction with a remote terminal (e.g., SSH)
- Starting a long-running process to check later

## Workflow

### 1. Check if Already in tmux

```bash
tmux display-message -p '#S'
```

If this returns a session name, already in tmux. If error, create a new session first.

### 2. Create a Dedicated Window

```bash
tmux new-window -n <descriptive-name>
```

Use a clear, descriptive name that indicates what the window is for (e.g., `railway-login`, `ssh-prod`, `npm-install`).

### 3. Read Before Writing

Always capture the pane first to see the current state:

```bash
tmux capture-pane -t <window-name> -p
```

### 4. Navigate to Correct Directory

```bash
tmux send-keys -t <window-name> 'cd /path/to/project' Enter
```

Wait briefly, then capture to verify:

```bash
sleep 0.2 && tmux capture-pane -t <window-name> -p
```

### 5. Send Commands

```bash
tmux send-keys -t <window-name> 'command here' Enter
```

### 6. Monitor Output

Wait appropriately for the command, then capture output:

```bash
sleep <seconds> && tmux capture-pane -t <window-name> -p
```

Adjust sleep duration based on expected response time.

### 7. Respond to Prompts

When prompts appear, send responses:

```bash
tmux send-keys -t <window-name> 'Y' Enter
```

Then monitor again to see the result.

### 8. Clean Up

When done, kill the temporary window:

```bash
tmux kill-window -t <window-name>
```

## Tips

- **Read more often than write** - Always capture before sending commands
- **Pause for interactive CLIs** - Some tools need brief pauses (0.1-0.2s) between commands
- **Use descriptive window names** - Makes it easy to identify and manage multiple sessions
- **Wait appropriately** - Adjust sleep duration based on command complexity
- **Monitor continuously** - Check output after each command to ensure success

## Example: Railway Login

```bash
# Check if in tmux
tmux display-message -p '#S'

# Create window
tmux new-window -n railway-login

# Read current state
tmux capture-pane -t railway-login -p

# Navigate to project
tmux send-keys -t railway-login 'cd /Users/user/project' Enter
sleep 0.2 && tmux capture-pane -t railway-login -p

# Run login command
tmux send-keys -t railway-login 'bunx railway login' Enter
sleep 1 && tmux capture-pane -t railway-login -p

# Respond to prompt
tmux send-keys -t railway-login 'Y' Enter
sleep 2 && tmux capture-pane -t railway-login -p

# Verify login successful, then clean up
tmux kill-window -t railway-login
```
