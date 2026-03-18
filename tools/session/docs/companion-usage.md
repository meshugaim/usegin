---
name: Companion session usage guide
handle: companion-usage
type: how-to
context: How companion sub-agents should use the session CLI for observation
---

# Companion Session Usage Guide

This guide is for companion sub-agents using the `session` CLI to observe a parent session.

## Quick Reference

| Goal | Command |
|------|---------|
| Full observation | `session <id> --full --tool-input --tool-output --truncate 2000` |
| Incremental (since last check-in) | `session <id> --since-turn N --full --tool-output --truncate 2000` |
| Last N turns | `session <id> --last 20 --full --tool-output` |
| Quick scan | `session <id> --timeline --show-tools` |
| Tool focus (e.g., Bash) | `session <id> --tool Bash --tool-input --tool-output` |
| Stats overview | `session <id>` (default) |
| JSON for parsing | `session <id> --format json` |

## Critical Flags

### `--tool-output`
Shows the actual results of tool calls (test failures, file contents, command output). **Without this flag, you only see summaries.**

### `--tool-input`
Shows the arguments passed to each tool call (what command was run, what file was read/edited).

### `--truncate <n>`
Controls how many characters of tool I/O are shown. Default is 500, which is often too short for test output. Use `--truncate 2000` or higher for check-ins.

### `--tool <name>`
Filters output to show only calls for a specific tool type. **Case-sensitive** — use `Bash`, not `bash`.

Combine with `--tool-output` and `--tool-input` to see full details:
```
session <id> --tool Bash --tool-input --tool-output --truncate 2000
```

Without `--tool-output`, you'll only see one-line summaries.

### `--timeline`
Shows a chronological flow of events: messages, tool calls, subagent spawns/returns, commits, idle gaps. Good for understanding the session's rhythm.

Add `--show-tools` to include tool calls in the timeline.

### `--format <fmt>`
- `stats` (default) — compact stats card
- `narrative` — full conversation transcript
- `terminal` — compact format with tool output
- `markdown` — conversation as markdown
- `json` — structured data (currently stats only)

### `--subagents`
Includes sub-agent transcripts appended after the main session. Useful when your parent delegates to workers.

## Recipes

### Full check-in (recommended)
See everything the parent did since your last check-in:
```bash
session <id> --full --tool-input --tool-output --truncate 2000
```

### Quick orientation
Get the shape of the session fast:
```bash
session <id> --timeline --show-tools
```

### Review test results
See what tests passed/failed:
```bash
session <id> --tool Bash --tool-output --truncate 5000
```

### Review code changes
See what files were read/edited:
```bash
session <id> --tool Edit --tool-input --tool-output
session <id> --tool Write --tool-input --tool-output
```

### Review sub-agent work
```bash
session <id> --full --subagents --tool-output --truncate 2000
```

## Gotchas

1. **`--tool` is case-sensitive.** Use `Bash`, `Read`, `Edit`, `Write`, `Grep`, `Glob` — not lowercase.
2. **`--tool` without `--tool-output` shows only summaries.** Always combine them.
3. **Default truncation is 500 chars.** Test output, stack traces, and file contents are usually longer. Use `--truncate 2000` or more.
4. **`--full` sets format to narrative.** If you also pass `--format json`, `--format` wins.
5. **Don't rely on the parent's narration.** Verify claims independently by reading tool output (test results, git diffs).

## Independent Verification

As a companion, your value comes from independent observation. When the parent says "tests pass" or "the fix is clean":

1. Look at the actual Bash output with `--tool Bash --tool-output`
2. Check the Edit/Write inputs with `--tool Edit --tool-input` to see what code changed
3. Cross-reference: does the code change match what was claimed?

Trust the tool output over the parent's summary.
