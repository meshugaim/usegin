# Find Session

Search agent-records for a previous session and return its full text as context.

**Query:** $ARGUMENTS

## Instructions

Execute these steps in order:

### Step 1: Catch up on recent unsummarized sessions

First, get today's date and 2 days ago:
```bash
date +%Y-%m-%d        # today
date -d '2 days ago' +%Y-%m-%d  # 2 days ago
```

Then check for unsummarized sessions (exclude subagent files):
```bash
agent-records find --from <2-days-ago-date> 2>/dev/null | grep "No" | grep -v "agent-" | head -10
```

If unsummarized main sessions exist:
1. Tell user: "Found X recent sessions without summaries. Creating summaries first..."
2. For each (limit 5), spawn a subagent in parallel to:
   - Read the conversation .txt file
   - Write summary to `<filename>.summary.md`
   - Commit to agent-records repo

If no unsummarized main sessions, proceed to Step 2.

### Step 2: Search for matching sessions

```bash
grep -ril "$ARGUMENTS" ~/agent-records/ --include="*.summary.md" 2>/dev/null | head -20
```

If no results, tell the user no sessions match and suggest trying different keywords.

### Step 3: Build options for user

For each matching summary file found, extract:
- **Date**: from the path (e.g., `2025-12-25`)
- **Title**: first heading or first line of the summary
- **Path**: the `.txt` conversation file (replace `.summary.md` with `.txt`)

Read each summary file to get the title:
```bash
head -3 <summary-path>
```

### Step 4: Ask user to pick

Use `AskUserQuestion` with the matches as options. Format each option as:
- Label: `YYYY-MM-DD: <summary title snippet>`
- Description: First sentence of the summary

### Step 5: Output the full conversation

Once user picks, read the conversation file:
```bash
cat <conversation-path>
```

Output the full text. This becomes context for continuing the work.

### Step 6: Offer next steps

After outputting, ask:
> "This session is now in context. What would you like to continue or explore from here?"
