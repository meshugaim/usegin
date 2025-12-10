# Agent Records CLI

A command-line tool for querying and consuming agent conversation records.

## Overview

This CLI provides commands to find and list agent conversations from the `~/agent-records/` repository. It automatically filters out warmup conversations, conversations with summarize slash commands, and identifies which conversations have existing summaries.

## Installation

From the project root:

```bash
cd agent-records-cli
bun install
```

## Usage

The CLI can be invoked directly:

```bash
./agent-records-cli/src/cli.ts <command> [options]
```

Or from within the module:

```bash
cd agent-records-cli
bun run src/cli.ts <command> [options]
```

## Commands

### `find`

Find conversations matching specific criteria.

```bash
# Find conversations on a specific date
agent-records find --date 2025-11-08

# Find conversations in a date range
agent-records find --from 2025-11-01 --to 2025-11-10

# Find conversations for a specific user
agent-records find --date 2025-11-08 --username nitsan-avni
```

### `list`

List all conversations (optionally filtered).

```bash
# List all conversations
agent-records list

# List conversations for a specific user
agent-records list --username nitsan-avni
```

## Options

- `--date <YYYY-MM-DD>` - Find conversations on a specific date
- `--from <YYYY-MM-DD>` - Find conversations from this date onwards
- `--to <YYYY-MM-DD>` - Find conversations up to this date
- `--username <name>` - Filter by username (kebab-cased automatically)
- `--records-dir <path>` - Path to agent records directory (default: `~/agent-records`)
- `--ignore-content <regex>` - Exclude conversations matching regex pattern in content (can be used multiple times)

## Output Format

### find/list Commands

Displays a table with the following columns:

- **Path** - Full path to the conversation file
- **Summary** - "Yes" if a summary exists, "No" otherwise
- **Lines** - Number of lines in the conversation file

Example output:

```
┌──────────────────────────────────────────────────────────────────┬─────────┬───────┐
│ Path                                                             │ Summary │ Lines │
├──────────────────────────────────────────────────────────────────┼─────────┼───────┤
│ /home/vscode/agent-records/nitsan-avni/2025-11/2025-11-09/...   │ No      │ 266   │
│ /home/vscode/agent-records/nitsan-avni/2025-11/2025-11-09/...   │ Yes     │ 142   │
└──────────────────────────────────────────────────────────────────┴─────────┴───────┘
```

### overview Command

The overview command displays a table with the following columns:
- Username
- Date
- Conversations (total count)
- Summaries (count with summaries)
- Missing (count without summaries)
- Total Lines (sum of all line counts)
- Avg Lines (average lines per conversation)

## Behavior

- **Warmup conversations are always excluded** - Conversations that start with "USER:\nWarmup" are automatically filtered out
- **Summarize commands are excluded by default** - Conversations containing `<command-name>/summarize.*</command-name>` are automatically filtered out to avoid recursive summaries
- **Summary detection** - For each conversation, the CLI checks if a corresponding `.summary.md` file exists
- **Kebab-case normalization** - Usernames are automatically converted to kebab-case (e.g., "Nitsan Avni" → "nitsan-avni")
- **Content filtering** - Use `--ignore-content` with regex patterns to exclude conversations based on their content

## Integration

This CLI is designed to be used by agents and slash commands (like `/summarize-logs`) to:

1. Find relevant conversations based on date/user filters
2. Identify which conversations need summaries
3. Filter out recursive summarization conversations
4. Process conversations efficiently using the table output format

## Examples

```bash
# Get all conversations from Nov 8, 2025
./agent-records-cli/src/cli.ts find --date 2025-11-08

# Get conversations for a specific user in a date range
./agent-records-cli/src/cli.ts find --from 2025-11-01 --to 2025-11-10 --username nitsan-avni

# Exclude conversations with specific content patterns
./agent-records-cli/src/cli.ts find --date 2025-11-08 --ignore-content "custom-pattern"

# Multiple ignore patterns (in addition to default summarize.* pattern)
./agent-records-cli/src/cli.ts list --ignore-content "pattern1" --ignore-content "pattern2"

# Get overview statistics
./agent-records-cli/src/cli.ts overview

# Get overview for specific date range
./agent-records-cli/src/cli.ts overview --from 2025-11-01 --to 2025-11-10
```

## Architecture

```
agent-records-cli/
├── src/
│   ├── cli.ts        # Main CLI entry point with argument parsing
│   ├── config.ts     # Configuration schema and defaults
│   ├── filters.ts    # Warmup and content pattern filtering
│   └── finder.ts     # Core conversation finding logic
├── package.json
├── tsconfig.json
└── README.md
```

Built with:
- **Bun** - Runtime and package manager
- **Zod** - Schema validation for configuration
- **TypeScript** - Type safety
