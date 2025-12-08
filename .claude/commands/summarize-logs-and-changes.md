---
description: Summarize agent logs and related git history
---

!`date`

I'll retrieve and summarize the agent conversation logs and related git history.

## Arguments

| Argument | Example | Description |
|----------|---------|-------------|
| `--date` | `--date 2025-12-07` | Specific date |
| `--from` | `--from 2025-12-05` | Start of range |
| `--to` | `--to 2025-12-07` | End of range |
| `--username` | `--username nitsan-avni` | Filter by user |

Examples:
- `/summarize-logs-and-changes --date 2025-12-07`
- `/summarize-logs-and-changes --from 2025-12-05 --username nitsan-avni`

Current arguments: $ARGUMENTS

## Agent Records Structure

```
~/agent-records/
├── {username}/
│   └── YYYY-MM/
│       └── YYYY-MM-DD/
│           └── HHMMSS-conversation-*.txt
```

- Files are organized by: username → year-month → day → timestamp
- Conversations are .txt files with HHMMSS timestamp prefixes
- Warmup conversations start with exactly: USER:\nWarmup

## Step 1: Get Overview

```bash
just agent-records overview --from 2025-12-05 --to 2025-12-07
```

## Step 2: Find Conversations

```bash
just agent-records find --date 2025-12-07 --username nitsan-avni
```

## Workflow

1. Run `just agent-records overview` with the relevant date arguments
2. Run `just agent-records find` to locate specific conversations
3. Exclude sub-agent conversations (excluded by default in `find`)
4. Avoid meta-summaries - skip sections using `/summaries...` commands and note "(Summary section excluded to avoid meta-summary)"

## Processing Each Conversation

For each conversation found:

**If `.summary.md` exists:** Use it directly (this is output from a previous sub-agent).

**If no summary exists:** Spawn a sub-agent with these instructions:

## Subagent Instructions for Missing Summaries

For each conversation without a `.summary.md`:

1. Read the conversation file
2. Find related git commits: `git log --oneline --since="{date}" --until="{next_day}"`
3. Write summary preserving dialogue nature - tell the story of what happened:
   - Who initiated what?
   - Key moments and how they unfolded
   - Don't preserve full details, but capture the happenings
4. For relevant commits, use `git log --name-only` and `git show` for context
5. Save to: `{conversation_path_without_extension}.summary.md`
6. Commit: `cd ~/agent-records && git add {file} && git commit -m "Add summary for {filename}"`

## Arc Summary

After all individual summaries are created, synthesize an arc summary:

1. Review all sub-agent reports
2. Write the arc summary covering the full narrative across all conversations
3. Save to: `~/agent-records/{YYYY-MM-DD}-daily-summary.md`
4. Commit and push:

```bash
cd ~/agent-records && git add . && git commit -m "Add daily summary for {date}" && git push
```
