#!/usr/bin/env bun

/**
 * Session CLI
 *
 * Parse Claude session JSONL files with configurable verbosity.
 *
 * Usage:
 *   session <file.jsonl> [options]
 *
 * Options:
 *   --tool-input     Include tool call inputs
 *   --tool-output    Include tool results
 *   --truncate <n>   Truncate tool I/O to n chars (default: 500)
 *   --subagents      Include subagent transcripts
 *   --help           Show this help
 */

import { parseMainArgs } from "./cli-args-main";
import {
  runFind,
  runPick,
  runList,
  runFetch,
  runResume,
  runFork,
  runRm,
  runBash,
  runSearchIn,
  runDocs,
  runParse,
} from "./commands";

function printHelp() {
  console.log(`
Session - Parse Claude session JSONL files

USAGE:
  session <file.jsonl|session-id|prefix> [options]
  session list [options]    List sessions (non-interactive)
  session ls [options]      Alias for 'list'
  session find [options]    Browse sessions interactively with fzf
  session pick [options]    Pick session via popup (for Claude)
  session fetch <id>        Fetch archived session to local storage
  session resume <id>       Fetch (if needed) and resume a session
  session fork <id>         Fork a session (copy + resume the copy)
  session rm <id> [--yes]   Delete a session and its subagent files
  session delete <id>       Alias for 'rm'
  session bash [id] [--grep <p>]  Browse Bash commands from sessions
  session search-in <id> <query>  Search within a session's turns
  session docs [list|show]  Browse embedded documentation

SESSION IDENTIFIERS:
  You can specify sessions by:
  - Full path: /home/user/.claude/projects/foo/abc123.jsonl
  - Full UUID: 502de9c7-684a-4724-b592-34aa88aac626
  - Short prefix: 502de9c7 (minimum 4 hex characters)

PICK OPTIONS:
  --method <method>  Picker method: auto, tmux, vsc (default: auto)
  --all-projects     Show sessions from all projects
  --since <filter>   Filter sessions by date (e.g., 1d, 2w, 2024-01-15)

LIST OPTIONS:
  --limit, -n <n>    Limit results (default: 10)
  --project <hash>   Filter to specific project (default: current project)
  --all-projects     Show sessions from all projects
  --output <format>  Output format: path, id, json (default: path)
  --since <filter>   Filter sessions by date (e.g., 1d, 2w, 2024-01-15)
  --remote           Include remote sessions from ~/agent-records/

FIND OPTIONS:
  --project <hash>   Filter to specific project (default: current project)
  --all-projects     Show sessions from all projects
  --output <format>  Output format: path, id, json (default: path)
  --since <filter>   Filter sessions by date (e.g., 1d, 2w, 2024-01-15)
  --remote           Include remote sessions from ~/agent-records/
  --no-preview       Disable preview pane
  --output-file <path>  Write selection to JSON file (for tmux integration)

FETCH:
  session fetch <id>   Fetch an archived session from ~/agent-records/ to local storage.
                       If the session is already local, prints its path and exits.
                       Also fetches associated subagent files.

RESUME:
  session resume <id>  Fetch the session (if remote) then spawn claude --resume.
                       Equivalent to: session fetch <id> && claude --resume <id>

FORK:
  session fork <id>    Create a copy of the session with a new ID and resume it.
                       The original session is untouched. Like git branch.
                       --dry-run  Show what would be copied without doing it.

RM / DELETE:
  session rm <id|path> [--yes]
                       Delete a session and its subagent files.
                       Shows what will be deleted and asks for confirmation.
                       --yes, -y  Skip the confirmation prompt.

SEARCH-IN:
  session search-in <id|path> <query>
                       Search within a session's turns for matching text.
                       Searches turn text and tool result content (case-insensitive).
                       Shows matching turns with index, role, and a context snippet.

OPTIONS:
  --full             Full narrative output (default: compact stats card)
  --timeline         Chronological flow of events (messages, subagents, commits)
  --show-tools       Include tool calls in timeline (off by default)
  --report-lines <n> Number of report lines from subagent results (default: 3)
  --format <fmt>     Output format: stats (default), narrative, terminal, markdown, json
                     Overrides --full when specified explicitly
  --tool <name>      Show only calls for a specific tool (e.g., --tool Bash)
                     Case-sensitive. Replaces normal output with focused list.
                     Note: combine with --tool-output to see actual results.
  --tools <names>    Show calls for multiple tools (e.g., --tools Bash,Edit,Write)
                     Comma-separated, case-sensitive. Mutually exclusive with --tool.
  --since-turn <n>   Show turns from index N onward. Can combine with --last.
  --since-timestamp <t>  Show turns at or after time T. Supports ISO 8601
                     (e.g., 2026-03-19T10:30:00Z) or relative (5m, 1h, 2d).
                     Applied before --since-turn/--last windowing.
  --since-commit <sha>   Show turns at or after the given git commit's timestamp.
                     Sugar over --since-timestamp — resolves the time from a commit.
                     Accepts full or short (7+ char) SHAs.
  --last <n>         Show last N turns. When combined with --since-turn, caps the count.
  --exclude-notifications  Filter out task-notification turns (from background agents)
  --commits          Interleave commits chronologically in narrative output
                     (default: append at end). Uses Claude-Session trailer for
                     precise discovery, falls back to time-window.
  --stream           Stream mode: read from stdin, output in real-time
  --tool-input       Include tool call inputs
  --tool-output      Include tool results
  --truncate <n>     Truncate tool I/O to n chars (default: 500)
  --subagents        Include subagent transcripts (appended at end)
  --include-warmups  Include warmup subagents (excluded by default)
  --list-files       List all related files (main + subagents), one per line
  --issues           Show Linear issues touched by this session (delegates to plan list --session)
  --debug            Show timing and progress info (also: DEBUG=session env var)
  --timeout <secs>   Timeout in seconds (default: 30, 0 to disable)
  --help, -h         Show this help

REWIND DETECTION:
  Rewinds (conversation branches) are automatically detected.
  Rewound branches are marked with [REWIND] prefix.
  A summary "REWINDS: N" is shown at the top if rewinds exist.

NOT YET IMPLEMENTED:
  --subagents-inline   Inline subagent content at Task call site
  --timestamps         Show timestamps
  --costs              Show token/cost per turn

EXAMPLES:
  # Quick stats card (default)
  session session.jsonl

  # Use short session ID prefix
  session 502de9c7

  # Full narrative output
  session session.jsonl --full

  # Chronological timeline
  session session.jsonl --timeline

  # Terminal format (replicates /export)
  session session.jsonl --format terminal

  # JSON output for programmatic consumption
  session session.jsonl --format json

  # Show only Bash commands
  session session.jsonl --tool Bash

  # Include tool inputs
  session session.jsonl --tool-input

  # Full verbosity with subagents
  session session.jsonl --full --tool-input --tool-output --subagents

  # Custom truncation
  session session.jsonl --tool-output --truncate 1000

  # Stream from stdin (pipe from tail -f or claude --output-format stream-json)
  tail -f session.jsonl | session --stream
  claude -p "hello" --output-format stream-json | session --stream
`);
}

async function main() {
  const rawArgs = process.argv.slice(2);

  // Check for 'list' or 'ls' subcommand
  if (rawArgs[0] === "list" || rawArgs[0] === "ls") {
    await runList(rawArgs.slice(1));
    return;
  }

  // Check for 'find' subcommand
  if (rawArgs[0] === "find") {
    await runFind(rawArgs.slice(1));
    return;
  }

  // Check for 'pick' subcommand
  if (rawArgs[0] === "pick") {
    await runPick(rawArgs.slice(1));
    return;
  }

  // Check for 'fetch' subcommand
  if (rawArgs[0] === "fetch") {
    await runFetch(rawArgs.slice(1));
    return;
  }

  // Check for 'fork' subcommand
  if (rawArgs[0] === "fork") {
    await runFork(rawArgs.slice(1));
    return;
  }

  // Check for 'rm' / 'delete' subcommand
  if (rawArgs[0] === "rm" || rawArgs[0] === "delete") {
    await runRm(rawArgs.slice(1));
    return;
  }

  // Check for 'bash' subcommand
  if (rawArgs[0] === "bash") {
    await runBash(rawArgs.slice(1));
    return;
  }

  // Check for 'search-in' subcommand
  if (rawArgs[0] === "search-in") {
    await runSearchIn(rawArgs.slice(1));
    return;
  }

  // Check for 'resume' subcommand
  if (rawArgs[0] === "resume") {
    await runResume(rawArgs.slice(1));
    return;
  }

  // Check for 'docs' subcommand
  if (rawArgs[0] === "docs") {
    runDocs(rawArgs.slice(1));
    process.exit(0);
  }

  const args = parseMainArgs(rawArgs);

  if (args.help || (!args.file && !args.stream)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  await runParse(args);
}

main();
