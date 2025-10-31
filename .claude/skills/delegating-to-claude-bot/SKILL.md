---
name: delegating-to-claude-bot
description: This skill should be used when the user wants to delegate a task to the @claude GitHub bot. Triggered by phrases like "let's give this to claude[bot]", "let's ask claude[bot] to...", "please delegate to the bot", or "use the gh app to...". Helps create GitHub issues with appropriate context and trigger the bot via @mention.
---

# Delegate to Claude Bot

## Overview

This skill facilitates delegating tasks to the @claude GitHub bot by creating GitHub issues and triggering the bot through @mentions. The skill helps draft issues with appropriate context while trusting the bot to figure out the details independently.

## When to Use

Use this skill when the user wants to delegate work to the @claude GitHub bot. Common trigger phrases include:

- "let's give this to claude[bot]"
- "let's ask claude[bot] to XXX"
- "please delegate to the bot"
- "use the gh app to XXX"

## Workflow

### Step 1: Understand the Task

Clarify what needs to be delegated. The user may provide:
- A brief description of the problem or feature
- Links to relevant files or code
- Desired outcomes
- Any constraints or preferences

Keep in mind that short descriptions are acceptable - trust the bot to figure out the details.

### Step 2: Draft the Issue

Prepare a GitHub issue that includes:

**Title:** Clear, concise description of the task

**Body:** Include relevant context such as:
- Problem description or feature request
- Links to relevant files (use full GitHub URLs or relative paths)
- Desired outcome
- Any important constraints

**Key principle:** Provide context, not prescription. Avoid being overly detailed or prescriptive about implementation. Trust @claude to figure out the approach.

### Step 3: Get User Approval

Present the drafted issue to the user and ask for confirmation before creating it. Show:
- The issue title
- The issue body
- Confirmation that a comment with @claude mention will be added

Wait for user approval before proceeding.

### Step 4: Create Issue and Trigger Bot

Once approved:
1. Create the GitHub issue using the `gh` CLI tool
2. Add a comment to the newly created issue that @mentions @claude
3. Confirm to the user that the issue has been created and the bot has been triggered

Example command flow:
```bash
gh issue create --title "Title" --body "Body"
gh issue comment <issue-number> --body "@claude please handle this"
```

## Best Practices

- **Trust the bot:** Provide context and desired outcomes, but avoid over-specifying implementation details
- **Be concise:** Short descriptions are fine if they capture the essence of the task
- **Include links:** When relevant, link to specific files, code locations, or related issues
- **Confirm first:** Always get user approval before creating the issue
- **Clear outcomes:** State what success looks like, even if briefly
