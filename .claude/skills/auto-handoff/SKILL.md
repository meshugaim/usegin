# Auto-Handoff Skill

Performs a clean handoff to a fresh Claude agent when context is running high. This ensures continuity of work without losing progress.

## When to Use

- Context utilization is above 75% (warning) or 85% (mandatory handoff required)
- You want to proactively hand off before context fills up
- You're at a natural stopping point in your current task

## Handoff Process

### Step 1: Check Current Context

```bash
cctx
```

At 85%+ handoff is mandatory. At 75-84% it's recommended.

### Step 2: Identify What's Being Worked On

Before handing off, identify:
- **Main issue**: What Linear issue (ENG-XXX) is the focus of this session?
- **Current task**: What specific work was in progress?
- **Next step**: What should the continuation agent do first?

Run `plan list` if you need to check current issues.

### Step 3: Export Session

Export the current session transcript for the continuation agent:

```bash
# Get the current session ID
SESSION_ID="$CLAUDE_SESSION_ID"

# Create handoff directory
HANDOFF_DIR="/workspaces/test-mvp/.claude/handoffs"
mkdir -p "$HANDOFF_DIR"

# Export transcript in terminal format (smaller than raw JSONL)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
HANDOFF_FILE="$HANDOFF_DIR/handoff_${TIMESTAMP}.md"
session "$SESSION_ID" --format terminal > "$HANDOFF_FILE"

# Update latest symlink
ln -sf "$HANDOFF_FILE" "$HANDOFF_DIR/latest.md"

echo "Exported to: $HANDOFF_FILE"
```

### Step 4: Extract Issue Context

Find the main issues from this session:

```bash
# Most frequently mentioned issue (main focus)
MAIN_ISSUE=$(grep -oE 'ENG-[0-9]+' "$HANDOFF_FILE" | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')

# Most recently mentioned issue (likely what was interrupted)
RECENT_ISSUE=$(grep -oE 'ENG-[0-9]+' "$HANDOFF_FILE" | tail -1)

echo "Main issue: $MAIN_ISSUE"
echo "Recent issue: $RECENT_ISSUE"
```

### Step 5: Spawn Continuation Agent

Build the continue prompt and spawn in tmux:

```bash
# Determine window name from issue
WINDOW_ISSUE="${RECENT_ISSUE:-${MAIN_ISSUE:-continue}}"

# Build the continue prompt - IMPORTANT: customize this with your current context
CONTINUE_PROMPT="Context was running high. Session handed off.

Previous session transcript: $HANDOFF_FILE

The previous agent was working on a task. The work may not be complete.
The handoff is almost always about the LAST task the previous agent was working on.

Issue context:
- Main issue this session: $MAIN_ISSUE (most frequently mentioned)
- Most recent issue: $RECENT_ISSUE

Instructions:
1. Read the handoff file, focusing on the LAST 20% of the conversation to understand the most recent task
2. Present to the user:
   a. What I understood: 2-3 sentences on what the previous session was working on (focus on the last task)
   b. What I plan to do: concrete next steps, starting from where the previous agent left off
   c. Questions (if any): anything unclear or ambiguous
3. Use the AskUserQuestion tool to ask: 'Does my understanding and plan look right, or would you like to adjust anything?' with options 'Looks good, go ahead' and 'Let me adjust'. This is a HARD GATE — do NOT proceed to any implementation until the user responds.
4. Only consult the full transcript if you are genuinely missing context after reading the last 20%."

# Check if in tmux
if [ -n "$TMUX" ]; then
    echo "Spawning new claude session in tmux..."
    tmux new-window -n "claude-${WINDOW_ISSUE}" \
        "claude --dangerously-skip-permissions --append-system-prompt 'Handoff file: $HANDOFF_FILE' '$CONTINUE_PROMPT'"
    echo "Done! New agent spawned in window: claude-${WINDOW_ISSUE}"
else
    # Not in tmux - save resume command
    RESUME_FILE="$HANDOFF_DIR/resume_command.sh"
    cat > "$RESUME_FILE" << 'RESUME_EOF'
#!/bin/bash
claude --dangerously-skip-permissions --append-system-prompt 'Handoff file: $HANDOFF_FILE' '$CONTINUE_PROMPT'
RESUME_EOF
    chmod +x "$RESUME_FILE"

    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  HANDOFF READY - Not in tmux, manual action required"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo "  Session exported to: $HANDOFF_FILE"
    echo "  To continue, run: $RESUME_FILE"
    echo ""
    echo "  Or start tmux for automatic handoffs: tmux new-session"
    echo "════════════════════════════════════════════════════════════════"
fi
```

### Step 6: Confirm and Exit

After spawning, you can exit this session. The new agent will continue the work.

## Quick One-Liner (if in tmux)

If you're in a hurry and in tmux, you can run this combined command:

```bash
HANDOFF_DIR="/workspaces/test-mvp/.claude/handoffs" && \
mkdir -p "$HANDOFF_DIR" && \
TIMESTAMP=$(date +%Y%m%d_%H%M%S) && \
HANDOFF_FILE="$HANDOFF_DIR/handoff_${TIMESTAMP}.md" && \
session "$CLAUDE_SESSION_ID" --format terminal > "$HANDOFF_FILE" && \
ln -sf "$HANDOFF_FILE" "$HANDOFF_DIR/latest.md" && \
MAIN_ISSUE=$(grep -oE 'ENG-[0-9]+' "$HANDOFF_FILE" | sort | uniq -c | sort -rn | head -1 | awk '{print $2}') && \
RECENT_ISSUE=$(grep -oE 'ENG-[0-9]+' "$HANDOFF_FILE" | tail -1) && \
WINDOW_ISSUE="${RECENT_ISSUE:-${MAIN_ISSUE:-continue}}" && \
tmux new-window -n "claude-${WINDOW_ISSUE}" \
    "claude --dangerously-skip-permissions --append-system-prompt 'Handoff file: $HANDOFF_FILE' 'Context was running high. Session handed off. Previous session: $HANDOFF_FILE. Main issue: $MAIN_ISSUE. Recent issue: $RECENT_ISSUE. Read the handoff file (focus on the last 20% — the handoff is almost always about the last task). Present what you understood and your plan, then use the AskUserQuestion tool to confirm before starting any work.'"
```

## Notes

- The handoff preserves the full conversation history in the exported file
- The new agent should read the handoff file to understand context
- Issue detection uses simple grep - it finds ENG-XXX patterns in the transcript
- If not in tmux, you'll need to manually run the resume command
