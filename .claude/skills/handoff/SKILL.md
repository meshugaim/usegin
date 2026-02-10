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

### Step 2: Write the handoff note

Use the `Write` tool to create the file at `$HANDOFF_FILE`. Follow this structure:

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
```

**Guidelines:**
- Be specific: file paths, function names, migration names
- Focus on what the next agent needs to ACT, not just understand
- Include any user preferences or decisions made during this session
- If there's a relevant Linear issue, include it in the title
- If no Linear issue, use a descriptive title instead

### Step 3: Update the symlink

```bash
ln -sf "$HANDOFF_FILE" "$HANDOFF_DIR/latest.md"
echo "Handoff written: $HANDOFF_FILE"
echo "Latest symlink updated"
```

### Step 4: Confirm to the user

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

### Step 3: Get to work

Start on the first pending item. Don't ask for permission — the handoff IS the instruction.
