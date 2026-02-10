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

Use the `Write` tool to create the file at `$HANDOFF_FILE`. Include a reference to the transcript. Follow this structure:

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

### Step 1: Read the latest handoff

```bash
HANDOFF_DIR="/workspaces/test-mvp/.claude/handoffs"
ls -la "$HANDOFF_DIR/latest.md"
```

Then read the file at the symlink target using the `Read` tool.

### Step 2: Orient

After reading, output a SHORT summary (3-5 sentences):
- What was being worked on
- What's pending
- What you'll do first

If the handoff references a session transcript, note its path but **don't read it yet**. Only read the transcript if you need deeper context — e.g., understanding why a decision was made, what approaches were tried and failed, or what the user said about something specific.

### Step 3: Get to work

Start on the first pending item. Don't ask for permission — the handoff IS the instruction.
