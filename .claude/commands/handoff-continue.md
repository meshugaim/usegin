---
description: Pick up from the latest handoff note
---

**STOP. You have exactly TWO jobs: (1) read the handoff, (2) present your understanding and ask for confirmation. Do NOT write code, edit files, run commands (except reading the handoff), check Linear, or start implementing.**

## Step 1: Read the handoff

```bash
HANDOFF_DIR="/workspaces/test-mvp/.claude/handoffs"
ls -la "$HANDOFF_DIR/latest.md"
```

Read the file at the symlink target using the `Read` tool. The handoff note is your ONLY source of truth for what to work on — do not check Linear, git log, or other sources to find work.

If the handoff references a session transcript, note its path but don't read it yet.

## Step 2: Present understanding and ask for confirmation

Output a SHORT summary:

1. **What I understood**: 2-3 sentences on what the previous session was working on (the handoff is almost always about the last thing being worked on — focus on that)
2. **What I plan to do**: A concrete list of next steps, based ONLY on what the handoff says
3. **Questions** (if any): Anything unclear or ambiguous

Then — in the SAME response — call `AskUserQuestion`:

```
Question: "Does my understanding and plan look right?"
Options:
  - "Looks good, go ahead"
  - "Let me adjust"
```

**This is where your turn ENDS.** Do not call any other tools after `AskUserQuestion`. Do not start implementing. Wait for the user's response.
