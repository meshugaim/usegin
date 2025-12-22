---
name: referencing-previous-sessions
description: This skill allows Claude to reference previous sessions during conversation. Triggered by phrases like "remember that session where", "that conversation about", "what did we do when", or "find the session where". Auto-detects tmux or VS Code for interactive session selection.
---

# Referencing Previous Sessions

## Overview

Allow users to reference a previous Claude session during the current conversation. Claude opens an interactive session browser (via tmux popup or VS Code terminal), the user selects a session, and Claude parses it to provide context.

## When to Use

Use this skill when the user:
- Asks about a previous session ("remember that session where we fixed the auth bug?")
- Wants to continue work from a previous session
- Needs context from past conversations ("what approach did we use for X?")
- References past work vaguely ("that thing we built last week")

## Requirements

One of:
- Running inside tmux (`$TMUX` env var set), OR
- VS Code with vsc-bridge extension installed

The picker auto-detects which is available (prefers tmux if both available).

## Workflow

### 1. Open session picker (single command!)

```bash
bun /workspaces/test-mvp/tools/session/src/cli.ts pick
```

Options:
- `--method auto|tmux|vsc` - Force specific picker method (default: auto)
- `--all-projects` - Show sessions from all projects
- `--since 1d` - Filter to recent sessions

This:
1. Auto-detects tmux or vsc-bridge
2. Opens a popup/terminal with the session browser
3. User searches/selects a session and presses Enter
4. Outputs JSON with session info

**Tell the user:** "I've opened the session browser. Please select a session and press Enter."

### 2. Parse the output

The command outputs JSON:
```json
{
  "path": "/path/to/session.jsonl",
  "id": "session-uuid",
  "date": "2024-11-29T14:32:00Z",
  "project": "-workspaces-foo",
  "summary": "Session summary if available"
}
```

### 3. Parse the session content

Use a subagent to parse and summarize the session:

```
Spawn a subagent to read and summarize the session at <path>.

Instructions for subagent:
1. Read the session file using the session CLI
2. Summarize what was discussed and accomplished
3. Note any key decisions, code changes, or outcomes
4. Return a concise summary to help continue the conversation
```

### 4. Provide context to user

Share the summary with the user and offer to:
- Continue where that session left off
- Apply similar approaches to current work
- Reference specific code or decisions from that session

## Example Interaction

```
User: "Remember that session where we implemented the auth flow? I want to do something similar."

Claude: I'll open the session browser for you to find that session.
[Runs: bun /workspaces/test-mvp/tools/session/src/cli.ts pick]

Claude: Please select the session in the popup and press Enter.

[User selects session, popup closes, command outputs JSON]

Claude: [Parses JSON output]
Claude: [Spawns subagent to parse session file]

Claude: Found it! In that session from Nov 15th, we implemented JWT-based authentication:
- Created auth middleware in src/middleware/auth.ts
- Added login/logout routes in src/routes/auth.ts
- Used bcrypt for password hashing
- Stored tokens in httpOnly cookies

Would you like me to use a similar approach for the current task?
```

## Tips

- If user is vague, suggest they search for keywords in the session browser
- The session browser shows summaries and user messages to help identification
- Multiple sessions can be referenced by running the workflow multiple times
- Use `--all-projects` if the session might be from a different project

## Fallback

If neither tmux nor vsc-bridge available (command will error with helpful message):
> To reference previous sessions interactively, please either:
> 1. Run Claude inside tmux, OR
> 2. Ensure the vsc-bridge extension is installed (check: `vsc status`)
>
> Alternatively, you can manually find and provide the session path, and I can parse it directly.

Manual alternative:
```bash
# List recent sessions
bun /workspaces/test-mvp/tools/session/src/cli.ts find --output path
```
