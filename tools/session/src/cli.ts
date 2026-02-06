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

import { parseSession, listRelatedFiles, StreamingParser, withTimeout } from "./parser";
import { formatNarrative, formatMarkdown, formatTerminal, formatToolFilter, type FormatOptions } from "./formatter";
import { formatStats } from "./formatter-stats";
import { computeStats } from "./stats";
import {
  checkFzfAvailable,
  claudeProjectsDirExists,
  discoverSessions,
  extractSessionMeta,
  formatMultiLineEntry,
  formatOutput,
  formatListLine,
  getCurrentProjectHash,
  openSessionPicker,
  resolveSessionPath,
  runFzfMultiLine,
  warnIfConflictingFlags,
  writeOutputFile,
} from "./finder";
import { NoSessionsFoundError, FzfNotFoundError } from "./errors";
import { parseFindArgs, parsePickArgs, parseListArgs } from "./cli-args";
import { parseMainArgs, type MainArgs } from "./cli-args-main";
import { debugLog } from "./debug";

/**
 * Check if debug mode is enabled via --debug flag or DEBUG=session env var
 */
function isDebugEnabled(args: MainArgs): boolean {
  return args.debug || process.env.DEBUG === "session";
}

function printHelp() {
  console.log(`
Session - Parse Claude session JSONL files

USAGE:
  session <file.jsonl|session-id|prefix> [options]
  session list [options]    List sessions (non-interactive)
  session ls [options]      Alias for 'list'
  session find [options]    Browse sessions interactively with fzf
  session pick [options]    Pick session via popup (for Claude)

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

FIND OPTIONS:
  --project <hash>   Filter to specific project (default: current project)
  --all-projects     Show sessions from all projects
  --output <format>  Output format: path, id, json (default: path)
  --since <filter>   Filter sessions by date (e.g., 1d, 2w, 2024-01-15)
  --no-preview       Disable preview pane
  --output-file <path>  Write selection to JSON file (for tmux integration)

OPTIONS:
  --full             Full narrative output (default: compact stats card)
  --format <fmt>     Output format: stats (default), narrative, terminal, markdown, json
                     Overrides --full when specified explicitly
  --tool <name>      Show only calls for a specific tool (e.g., --tool Bash)
                     Case-sensitive. Replaces normal output with focused list.
  --stream           Stream mode: read from stdin, output in real-time
  --tool-input       Include tool call inputs
  --tool-output      Include tool results
  --truncate <n>     Truncate tool I/O to n chars (default: 500)
  --subagents        Include subagent transcripts (appended at end)
  --include-warmups  Include warmup subagents (excluded by default)
  --list-files       List all related files (main + subagents), one per line
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

async function runFind(args: string[]) {
  // Check fzf availability before doing any work
  if (!(await checkFzfAvailable())) {
    const error = new FzfNotFoundError();
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  const findArgs = parseFindArgs(args);

  // Warn if conflicting flags are specified
  const conflictWarning = warnIfConflictingFlags({
    project: findArgs.project,
    allProjects: findArgs.allProjects,
  });
  if (conflictWarning) {
    console.error(`Warning: ${conflictWarning}`);
  }

  // Project resolution: --all-projects > --project > current project
  const currentProject = getCurrentProjectHash();
  const projectFilter = findArgs.allProjects
    ? undefined
    : findArgs.project || currentProject || undefined;

  const sessions = await discoverSessions({
    project: projectFilter,
    allProjects: findArgs.allProjects,
    since: findArgs.since,
  });

  if (sessions.length === 0) {
    // Check if the projects directory exists for better error message
    const projectsDirExists = await claudeProjectsDirExists();
    const error = new NoSessionsFoundError({
      project: projectFilter,
      allProjects: findArgs.allProjects,
      since: findArgs.since,
      projectsDirExists,
    });
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  // Build multi-line entries with user messages and summaries
  const entries: string[] = [];
  const sessionMap = new Map<string, typeof sessions[0]>();
  const summaryMap = new Map<string, string | null>();

  for (const session of sessions) {
    const { messages, lineCount, summary } = await extractSessionMeta(session.path);
    const entry = formatMultiLineEntry(
      session,
      messages,
      lineCount,
      6,
      findArgs.allProjects ? undefined : (currentProject || undefined),
      summary
    );
    entries.push(entry);
    // Map the path (last line of entry) to session for output formatting
    sessionMap.set(session.path, session);
    summaryMap.set(session.path, summary);
  }

  const result = await runFzfMultiLine(entries, {
    preview: !findArgs.noPreview,
  });

  if (!result) {
    process.exit(1);
  }

  // Check for RESUME: action marker
  if (result.startsWith("RESUME:")) {
    const path = result.slice(7); // Remove "RESUME:" prefix
    const sessionId = path.replace(/.*\//, "").replace(/\.jsonl$/, "");

    // Spawn claude --resume, inheriting stdio for interactive use
    // Use "bun run c" which runs claude with --dangerously-skip-permissions
    const resumeProcess = Bun.spawn(["bun", "run", "c", "--resume", sessionId], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    await resumeProcess.exited;
    process.exit(resumeProcess.exitCode ?? 0);
  }

  // Check for RETRO: action marker
  if (result.startsWith("RETRO:")) {
    const path = result.slice(6); // Remove "RETRO:" prefix

    // Spawn push-session script, inheriting stdio
    const retroScript = new URL("../../retro/src/push-session.ts", import.meta.url).pathname;
    const retroProcess = Bun.spawn(["bun", retroScript, path], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    await retroProcess.exited;
    process.exit(retroProcess.exitCode ?? 0);
  }

  // Check for EXPORT: action marker
  if (result.startsWith("EXPORT:")) {
    const sessionPath = result.slice(7); // Remove "EXPORT:" prefix
    const sessionId = sessionPath.replace(/.*\//, "").replace(/\.jsonl$/, "");

    // Parse the session and format as markdown
    const session = await parseSession(sessionPath, { includeSubagents: true });
    const markdown = formatMarkdown(session);

    // Write to file in current directory
    const outputPath = `${sessionId}.md`;
    await Bun.write(outputPath, markdown);
    console.log(`Exported to ${outputPath}`);
    process.exit(0);
  }

  // Normal selection - output the path/id/json or write to file
  const session = sessionMap.get(result);
  if (session) {
    if (findArgs.outputFile) {
      // Write to file for external consumption (e.g., Claude via tmux)
      const summary = summaryMap.get(result) ?? null;
      await writeOutputFile(session, findArgs.outputFile, summary);
      // Silent exit - file written
    } else {
      console.log(formatOutput(session, findArgs.output));
    }
  } else {
    if (findArgs.outputFile) {
      // Couldn't find session in map, write minimal info
      console.error("Warning: session not found in map");
    }
    console.log(result);
  }
}

async function runPick(args: string[]) {
  const pickArgs = parsePickArgs(args);

  try {
    const result = await openSessionPicker({
      allProjects: pickArgs.allProjects,
      since: pickArgs.since,
      method: pickArgs.method,
    });

    if (result) {
      // Output as JSON for Claude to parse
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error("No session selected");
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

async function runList(args: string[]) {
  const listArgs = parseListArgs(args);

  // Warn if conflicting flags are specified
  const conflictWarning = warnIfConflictingFlags({
    project: listArgs.project,
    allProjects: listArgs.allProjects,
  });
  if (conflictWarning) {
    console.error(`Warning: ${conflictWarning}`);
  }

  const currentProject = getCurrentProjectHash();
  const projectFilter = listArgs.allProjects
    ? undefined
    : listArgs.project || currentProject || undefined;

  const sessions = await discoverSessions({
    project: projectFilter,
    allProjects: listArgs.allProjects,
    since: listArgs.since,
  });

  if (sessions.length === 0) {
    // Check if the projects directory exists for better error message
    const projectsDirExists = await claudeProjectsDirExists();
    const error = new NoSessionsFoundError({
      project: projectFilter,
      allProjects: listArgs.allProjects,
      since: listArgs.since,
      projectsDirExists,
    });
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  const limited = sessions.slice(0, listArgs.limit);

  // For path (default) output, show rich one-line summaries with metadata.
  // JSON and ID formats remain unchanged for programmatic consumption.
  if (listArgs.output === "path") {
    for (const session of limited) {
      const meta = await extractSessionMeta(session.path);
      console.log(formatListLine(session, meta));
    }
  } else {
    for (const session of limited) {
      console.log(formatOutput(session, listArgs.output));
    }
  }
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

  const args = parseMainArgs(rawArgs);

  if (args.help || (!args.file && !args.stream)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  try {
    // Stream mode - read from stdin
    if (args.stream) {
      const parser = new StreamingParser({
        toolInput: args.toolInput,
        toolOutput: args.toolOutput,
        truncate: args.truncate,
      });

      const decoder = new TextDecoder();
      const stream = Bun.stdin.stream();
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const output = parser.feed(decoder.decode(value));
          for (const line of output) {
            console.log(line);
            console.log("");
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Flush remaining
      const final = parser.end();
      for (const line of final) {
        console.log(line);
      }
      return;
    }

    const debug = isDebugEnabled(args);
    const totalStart = Date.now();

    // Resolve session ID to path if needed
    const filePath = await resolveSessionPath(args.file);

    // List related files mode - just print file paths
    if (args.listFiles) {
      const files = await listRelatedFiles(filePath);
      for (const file of files) {
        console.log(file);
      }
      return;
    }

    // Stats and JSON formats need subagent data for the summaries section
    const includeSubagents = args.subagents || args.format === "stats" || args.format === "json";

    // Parse session with debug timing and timeout
    let stepStart = Date.now();
    debugLog(debug, "Parsing session...");
    const session = await withTimeout(
      parseSession(filePath, {
        includeSubagents,
        includeWarmups: args.includeWarmups,
        debug,
      }),
      args.timeout
    );
    debugLog(debug, `Parsed ${session.turns.length} turns`, stepStart);

    if (includeSubagents && session.subagents.length > 0) {
      debugLog(debug, `Found ${session.subagents.length} subagent(s)`);
    }

    // --tool filter: standalone output mode that replaces normal formatting
    if (args.tool) {
      const toolOutput = formatToolFilter(session, args.tool);
      debugLog(debug, "Total parse time", totalStart);
      console.log(toolOutput);
      return;
    }

    // Format output with debug timing
    stepStart = Date.now();
    debugLog(debug, `Formatting as ${args.format}...`);
    const options: Partial<FormatOptions> = {
      toolInput: args.toolInput,
      toolOutput: args.toolOutput,
      truncate: args.truncate,
      includeSubagents: args.subagents,
    };

    let output: string;
    switch (args.format) {
      case "json": {
        const stats = computeStats(session);
        const jsonOutput = {
          sessionId: session.sessionId,
          model: session.model,
          cwd: session.cwd,
          summary: session.summary ?? null,
          ...stats,
        };
        output = JSON.stringify(jsonOutput, null, 2);
        break;
      }
      case "stats": {
        const showHints = process.stdout.isTTY !== false;
        output = formatStats(session, { showHints });
        break;
      }
      case "terminal":
        output = formatTerminal(session, options);
        break;
      case "markdown":
        output = formatMarkdown(session);
        break;
      case "narrative":
      default:
        output = formatNarrative(session, options);
        break;
    }
    debugLog(debug, "Formatting complete", stepStart);
    debugLog(debug, "Total parse time", totalStart);
    console.log(output);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

main();
