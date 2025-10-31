---
name: delegating-to-claude-bot
description: This skill should be used when the user wants to delegate a task to the @claude GitHub bot. Triggered by phrases like "let's give this to claude[bot]", "let's ask claude[bot] to...", "please delegate to the bot", or "use the gh app to...". Helps create GitHub issues with appropriate context and trigger the bot via @mention.
---

# Delegate to Claude Bot

## Overview

This skill facilitates delegating tasks to the @claude GitHub bot by creating GitHub issues and triggering the bot through @mentions.

**Core principle:** The whole point of delegation is to offload the work - including investigation and context gathering - to the cloud bot. This saves local tokens and compute time. Provide minimal viable descriptions and let the bot do the exploration.

## When to Use

Use this skill when the user wants to delegate work to the @claude GitHub bot. Common trigger phrases include:

- "let's give this to claude[bot]"
- "let's ask claude[bot] to XXX"
- "please delegate to the bot"
- "use the gh app to XXX"

## Workflow

### Step 1: Understand the Task

Clarify what needs to be delegated. Focus on:
- WHAT needs to be done (not HOW or detailed WHY)
- Any user preferences or constraints the bot can't infer
- Desired outcome if it's not obvious

**Delegation checklist - ask yourself:**
- Could the bot figure this out by exploring the codebase? → Don't include it
- Is this about user intent or preference? → Include it
- Is this factual information about the code? → Let the bot investigate

Default to minimal descriptions. The bot has full codebase access.

### Step 2: Draft the Issue

**Title:** Clear, concise description of the task

**Body:** Minimal viable description
- State WHAT needs doing in 1-2 sentences
- Only include user preferences/constraints the bot can't infer
- Avoid explaining current code state - let the bot explore
- Avoid implementation suggestions - trust the bot

**When to provide context:**
- User has specific preferences (e.g., "keep it concise", "prioritize performance")
- External constraints (e.g., "must work with legacy API v1")
- Non-obvious desired outcome
- Specific files IF they're hard to find (rare - bot can usually find them)

**When NOT to provide context:**
- Current project structure (bot can explore)
- How things currently work (bot can read code)
- What needs to change technically (bot can figure it out)
- Implementation approach (that's what you're delegating!)

**Examples:**

❌ **Over-detailed (bad):**
```
Update README to reflect current project status

Current status:
- Monorepo with Next.js app (nextjs-app/) and Python services (python-services/)
- Root-level Bun project for global tooling
- Deployed on Railway via GitHub integration
- Python services using FastAPI with uv
- [5 more bullet points of current state...]
```

✅ **Minimal viable (good):**
```
Update README to reflect current project status
```

✅ **With user preference (good):**
```
Update README to reflect current project status. Keep it concise.
```

✅ **With constraint (good):**
```
Update README to reflect current project status. Keep the deployment links section.
```

### Step 3: Get User Approval

Present the drafted issue to the user and ask for confirmation before creating it. Show:
- The issue title
- The issue body
- Confirmation that a comment with @claude mention will be added

Wait for user approval before proceeding.

### Step 4: Create Issue and Trigger Bot

Once approved:
1. Create the GitHub issue using the `gh` CLI tool
2. Add a comment to the newly created issue that @mentions the bot (use `@claude`, not `@claude-bot`)
3. Confirm to the user that the issue has been created and the bot has been triggered

Example command flow:
```bash
gh issue create --title "Title" --body "Body"
gh issue comment <issue-number> --body "@claude please handle this"
```

**Important:** The correct mention is `@claude`, not `@claude-bot`.

### Step 5: Verify Bot Started Working

After triggering the bot:
1. Wait a few moments for the bot to respond (typically 5-10 seconds)
2. Check the issue comments to verify the bot has acknowledged the task
3. Confirm to the user that the bot has started working on the issue

Example command to check comments:
```bash
gh issue view <issue-number> --json comments --jq '.comments[] | "\(.author.login): \(.body[0:100])"'
```

Look for a response from the Claude bot in the comments.

## Best Practices

- **Minimal by default:** Start with the simplest possible description. You can always clarify in follow-up comments if the bot asks
- **Trust the bot's exploration:** The bot has full codebase access and can read code, explore structure, and understand context
- **Offload the work:** The whole point is to save local tokens and time. Don't spend time gathering context to hand-feed the bot
- **User preferences only:** Focus on what the bot CAN'T figure out - user intent, preferences, and external constraints
- **Confirm first:** Always get user approval before creating the issue
- **One sentence is often enough:** "Update README", "Fix the login bug", "Add dark mode toggle"

## Common Pitfalls

- ❌ Spending local tokens exploring the codebase to explain it to the bot
- ❌ Listing current file structure, dependencies, or how code currently works
- ❌ Suggesting implementation approaches
- ❌ Providing detailed "current status" when "current status" is literally what you're asking the bot to investigate
- ✅ Stating what needs doing in one sentence
- ✅ Adding user preferences if they exist
- ✅ Letting the bot do the investigation work
