---
name: using-agent-records
description: Use the Agent Records system to query, summarize, and reference past Claude conversations. Triggered by "find conversations", "agent records", "summarize conversations", "show overview", or "create summaries".
---

# Using Agent Records

Query and summarize past Claude conversations stored in `~/agent-records/`.

## When to Use

- Finding past conversations by date/user
- Creating summaries for conversations
- Getting an overview of conversation activity
- Referencing past work for context

## Directory Structure

```
~/agent-records/
├── {username}/
│   └── YYYY-MM/
│       └── YYYY-MM-DD/
│           ├── HHMMSS-conversation-{uuid}.txt
│           └── HHMMSS-conversation-{uuid}.summary.md
└── YYYY-MM-DD-daily-summary.md
```

| File Type | Description |
|-----------|-------------|
| `.txt` | Raw conversation log |
| `.summary.md` | Individual conversation summary |
| `*-daily-summary.md` | Arc summary for all conversations on a date |

## CLI Reference

### Commands

| Command | Description |
|---------|-------------|
| `agent-records find` | Find conversations matching criteria |
| `agent-records overview` | Show stats grouped by user/date |
| `agent-records help` | Show help |

### Options

| Option | Description |
|--------|-------------|
| `--date YYYY-MM-DD` | Specific date |
| `--from YYYY-MM-DD` | Start of range |
| `--to YYYY-MM-DD` | End of range |
| `--username <name>` | Filter by user (auto kebab-cased) |
| `--records-dir <path>` | Custom dir (default: `~/agent-records`) |
| `--ignore-content <regex>` | Exclude by content pattern (repeatable) |
| `--with-subagents` | Include sub-agent conversations |

### Output

**find** returns table with: Path, Summary (Yes/No), Lines

**overview** returns table with: Username, Date, Conversations, Summaries, Missing, Total Lines, Avg Lines

### Examples

```bash
# Today's conversations
agent-records find --date $(date +%Y-%m-%d)

# Date range for specific user
agent-records find --from 2025-12-01 --to 2025-12-07 --username nitsan-avni

# Overview of all activity
agent-records overview

# Find conversations missing summaries
agent-records find --date 2025-12-07  # check "Summary" column for "No"
```

## Default Exclusions

| Exclusion | Reason |
|-----------|--------|
| Warmup conversations | Start with `USER:\nWarmup` |
| Sub-agent conversations | Use `--with-subagents` to include |
| Summarize commands | Avoids recursive summaries |

## Workflows

### Query Conversations

```bash
# 1. Get overview
agent-records overview --from 2025-12-01

# 2. Drill into specific date
agent-records find --date 2025-12-07
```

### Create Missing Summaries

1. Find conversations without summaries:
   ```bash
   agent-records find --date 2025-12-07
   ```
2. For each with `Summary: No`, spawn a subagent (see `subagent-prompts.md`)
3. Subagent writes `{filename}.summary.md` and commits

### Create Daily Arc Summary

After all individual summaries exist:
1. Read all `.summary.md` files for the date
2. Synthesize into `~/agent-records/YYYY-MM-DD-daily-summary.md`
3. Commit and push

## Related Commands

| Command | Use Case |
|---------|----------|
| `/summarize-logs` | Quick summarization workflow |
| `/summarize-logs-and-changes` | Summarize with git history context |

## Subagent Instructions

See `subagent-prompts.md` for exact prompts to use when spawning summarization subagents.
