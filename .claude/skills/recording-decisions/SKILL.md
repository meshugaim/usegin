---
name: recording-decisions
description: This skill should be used when the user wants to record a decision. Triggered by phrases like "record this decision", "document this decision", "let's add this to decisions", "create a decision doc", or "decision: xxx". Helps create lightweight decision documents in docs/decisions/.
---

# Recording Decisions

## Overview

This skill helps capture team decisions in lightweight, informal markdown files. Decisions can be about anything: architecture, product, design, process, next steps - any record of team decision-making.

**Core principle:** Keep it short and informal. Capture the essence, not a dissertation.

## When to Use

Use this skill when the user wants to document a decision. Common trigger phrases include:

- "record this decision"
- "document this decision"
- "let's add this to decisions"
- "create a decision doc"
- "decision: xxx"

## Workflow

### Step 1: Analyze the Context

Review the current conversation to identify:
- **What** decision was made
- **Why** it matters (the direction/rationale)
- **Next steps** if any were mentioned

Keep it concise. Don't overthink it.

### Step 2: Draft the Decision Document

**Auto-number:**
- Check `docs/decisions/` for existing files
- Find the highest number (e.g., `0001-xxx.md`)
- Increment by 1 for the new file (e.g., `0002-xxx.md`)

**Generate filename:**
- Format: `XXXX-descriptive-title.md`
- Use lowercase with hyphens
- Keep title short and descriptive

**Document format:**
```markdown
# Title

**Date**: YYYY-MM-DD

## Direction

[The actual decision and rationale - keep it brief and informal]

## Next Steps

[Any follow-up actions, if applicable. Omit this section if there are no next steps]
```

**Style guidelines:**
- ✅ **Informal and conversational** - write like you're talking to a teammate
- ✅ **Short and concise** - a few sentences or bullet points is often enough
- ✅ **Focus on the decision** - what was decided and why
- ❌ **Don't write essays** - this isn't a formal document
- ❌ **Don't overthink** - capture the essence and move on

### Step 3: Get User Approval

Present the drafted decision document to the user:
- Show the proposed filename
- Show the full document content
- Ask for confirmation or edits

Wait for user approval before creating the file.

### Step 4: Create the File

Once approved:
1. Write the file to `docs/decisions/XXXX-title.md`
2. Confirm to the user that the decision has been recorded

## Best Practices

- **Keep it short:** Most decisions fit in a few sentences
- **Informal tone:** Write like you're leaving a note for your team
- **Capture the why:** The rationale matters more than implementation details
- **Next steps are optional:** Only include if there are clear follow-up actions
- **Don't overthink:** If you're spending more than a minute drafting, it's too long

## Examples

✅ **Good (concise):**
```markdown
# Use Bun for package management

**Date**: 2025-11-04

## Direction

We're using Bun instead of npm/yarn for faster installs and better DX. The Next.js runtime still uses Node.js 20 in production (Railway requirement), but Bun handles all package management.

## Next Steps

Update CLAUDE.md to reflect this default.
```

❌ **Too formal/long:**
```markdown
# Decision to Use Bun for Package Management

**Date**: 2025-11-04

## Context

After evaluating multiple package managers including npm, yarn, and pnpm, we conducted performance benchmarks and developer experience surveys...

[5 more paragraphs]
```

✅ **Good (simple product decision):**
```markdown
# Chat interface with Effi

**Date**: 2025-11-03

## Direction

After sign-in, users interact with Effi through a chat interface. Main pane for chat, collapsible left pane for previous chats and projects.

## Next Steps

Details about specific behaviors and UX flows will be refined in subsequent decisions.
```

## Common Pitfalls

- ❌ Writing formal ADRs when a few bullets would do
- ❌ Over-documenting implementation details
- ❌ Spending too much time on structure vs. content
- ❌ Treating this like official documentation
- ✅ Keeping it casual and brief
- ✅ Capturing just enough context for the team
- ✅ Moving fast
