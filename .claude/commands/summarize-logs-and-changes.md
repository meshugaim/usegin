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
| `--all` | `--all` | Process all users and dates, creating any missing summaries |

Examples:
- `/summarize-logs-and-changes --date 2025-12-07`
- `/summarize-logs-and-changes --from 2025-12-05 --username nitsan-avni`
- `/summarize-logs-and-changes --all` - Generate all missing summaries

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

## --all Flag Workflow

When `--all` is specified, process ALL missing summaries across all users and dates:

1. Run `just agent-records overview` (no filters) to see all user/date combinations
2. For each user/date with missing conversation summaries (process oldest dates first):
   - Run `just agent-records find --date {date} --username {username}` to get conversations without summaries
   - Spawn sub-agents in parallel (max 8 at a time) to generate missing conversation summaries
   - **IMPORTANT: Run sub-agents in background** - they write directly to `.summary.md` files
   - Use `AgentOutputTool` with `block=false` to check completion status periodically
   - Only collect pass/fail status, NOT full reports (sub-agents output to files, not context)
3. After ALL conversation summaries exist, check for missing daily summaries:
   - List existing: `ls ~/agent-records/*-daily-summary.md`
   - For each date that has all conversation summaries but no daily summary, spawn a sub-agent to create the arc summary (it reads the `.summary.md` files directly)
4. Push all changes: `cd ~/agent-records && git push`

**Progress Tracking:** After each batch completes, output a single line:
```
Progress: [completed/total] conversations | Remaining: N
```
Example: `Progress: [12/47] conversations | Remaining: 35`

**Context Management:** Sub-agents write output to files. The main agent only tracks success/failure to avoid context exhaustion.

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

**IMPORTANT - Terse Final Report:** Return ONLY a single line like:
- `✓ {filename}` on success
- `✗ {filename}: {brief error}` on failure

Do NOT include the summary content in your report - it's already written to the file.

## Arc Summary

After all individual summaries are created, synthesize an arc summary:

1. Review all sub-agent reports
2. Write the arc summary covering the full narrative across all conversations
3. Save to: `~/agent-records/{YYYY-MM-DD}-daily-summary.md`
4. Commit and push:

```bash
cd ~/agent-records && git add . && git commit -m "Add daily summary for {date}" && git push
```
