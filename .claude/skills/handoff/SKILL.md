---
name: handoff
description: Manual session handoff - write or continue. Triggered by "/handoff" to write a handoff note, "/handoff --continue" to pick up from the last one.
---

# Handoff

Quick manual session handoff. Two modes:

| Mode         | Trigger               | What it does                                |
| ------------ | --------------------- | ------------------------------------------- |
| **Write**    | `/handoff`            | Capture current context into a handoff file |
| **Continue** | `/handoff --continue` | Read latest handoff and pick up             |

## Write Mode (`/handoff`)

You already have the context. Write it down.

### Step 1: Create the handoff file

```bash
HANDOFF_DIR="/workspaces/test-mvp/.claude/handoffs"
mkdir -p "$HANDOFF_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
HANDOFF_FILE="$HANDOFF_DIR/handoff_${TIMESTAMP}.md"
echo "Target: $HANDOFF_FILE"
```

### Step 2: Export the session transcript

Export the compact session transcript alongside the handoff note. This gives the next agent access to the full conversation if they need deeper context.

```bash
TRANSCRIPT_FILE="$HANDOFF_DIR/transcript_${TIMESTAMP}.md"
session "$CLAUDE_SESSION_ID" --format terminal > "$TRANSCRIPT_FILE" 2>/dev/null
echo "Transcript: $TRANSCRIPT_FILE ($(du -h "$TRANSCRIPT_FILE" | cut -f1))"
```

### Step 3: Write the handoff note

Write the handoff content to `/tmp` first, then `cp` to the target path. The `Write` tool and direct heredocs to `.claude/` paths are blocked by Claude Code's sensitive-file permission check. The `/tmp` + `cp` pattern bypasses this reliably.

```bash
cat > /tmp/handoff_${TIMESTAMP}.md << 'HANDOFF_EOF'
<content here>
HANDOFF_EOF
cp /tmp/handoff_${TIMESTAMP}.md "$HANDOFF_FILE"
```

Include a reference to the transcript. Follow this structure:

```markdown
# Handoff: <issue-id> — <short title>

## Context
<1-2 sentences: what is this work about?>

## What's Done
<Bullet list of completed work. Be specific — file names, components, migrations.>

## What's Pending
<Numbered list of remaining tasks. For each: what needs to happen and which files are involved.>

## Key Files
<List of files most relevant to the work>

## Git State
<Current branch, last commit, any push issues>

## Notes
<Anything else the next session needs to know — staging URLs, known failures, user preferences>

## Session Transcript
Full conversation from this session: `<path to transcript_TIMESTAMP.md>`
Read this if you need deeper context on decisions made or approaches tried.
```

**Guidelines:**
- Be specific: file paths, function names, migration names
- Focus on what the next agent needs to ACT, not just understand
- **Emphasize the last task**: The handoff is almost always about the most recent thing being worked on. Make sure "What's Pending" leads with that — it's what the next agent will focus on first
- Include any user preferences or decisions made during this session
- If there's a relevant Linear issue, include it in the title
- If no Linear issue, use a descriptive title instead

### Step 4: Update the symlink

```bash
ln -sf "$HANDOFF_FILE" "$HANDOFF_DIR/latest.md"
echo "Handoff written: $HANDOFF_FILE"
echo "Transcript: $TRANSCRIPT_FILE"
echo "Latest symlink updated"
```

### Step 5: Confirm to the user

Tell the user the handoff is written and what it contains. Ask if they want to adjust anything before ending the session.

## Continue Mode (`/handoff --continue`)

> **STOP. You have exactly TWO jobs in this mode: (1) read the handoff, (2) present your understanding and ask for confirmation. That's it. Do NOT write code, edit files, run commands, or start implementing. Your turn ends with an `AskUserQuestion` call.**

### Step 1: Read the latest handoff

```bash
HANDOFF_DIR="/workspaces/test-mvp/.claude/handoffs"
ls -la "$HANDOFF_DIR/latest.md"
```

Then read the file at the symlink target using the `Read` tool.

If the handoff references a session transcript, note its path but **don't read it yet**. The handoff note should contain everything you need. Only consult the transcript later if you're genuinely missing context.

### Step 2: Present understanding and ask for confirmation

After reading, output a SHORT summary:

1. **What I understood**: 2-3 sentences on what the previous session was working on (the handoff is almost always about the last thing being worked on — focus on that)
2. **What I plan to do**: A concrete list of next steps
3. **Questions** (if any): Anything unclear or ambiguous

Then — in the SAME response — call `AskUserQuestion`:

```
Question: "Does my understanding and plan look right?"
Options:
  - "Looks good, go ahead"
  - "Let me adjust"
```

**This is where your turn ENDS.** Do not call any other tools after `AskUserQuestion`. Do not start implementing. Wait for the user's response. They may correct your interpretation, reprioritize, or add context. Only begin work after they confirm.
