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
import { formatNarrative, formatMarkdown, formatTerminal, formatToolFilter, dedupTaskNotifications, type FormatOptions } from "./formatter";
import { formatStats } from "./formatter-stats";
import { buildTimeline } from "./timeline";
import { formatTimeline } from "./formatter-timeline";
import { buildJsonOutput } from "./json-format";
import { getSessionCommits } from "./git-commits";
import { loadAllDocs, findDoc } from "../../docs-registry/src/shared";
import { join, dirname } from "path";
import {
  checkFzfAvailable,
  claudeProjectsDirExists,
  discoverRemoteSessions,
  discoverSessions,
  extractSessionMeta,
  formatMultiLineEntry,
  formatOutput,
  formatListLine,
  getCurrentProjectHash,
  mergeSessionLists,
  openSessionPicker,
  resolveSessionPath,
  runFzfMultiLine,
  warnIfConflictingFlags,
  writeOutputFile,
} from "./finder";
import { NoSessionsFoundError, FzfNotFoundError } from "./errors";
import { parseFindArgs, parsePickArgs, parseListArgs, parseFetchArgs, parseResumeArgs, parseForkArgs } from "./cli-args";
import { parseMainArgs, type MainArgs } from "./cli-args-main";
import { fetchSession, formatFetchResult } from "./fetch";
import { debugLog } from "./debug";
import { sliceTurns, formatPositionHeader } from "./incremental";
import { searchInSession } from "./search";

/**
 * Check if debug mode is enabled via --debug flag or DEBUG=session env var
 */
function isDebugEnabled(args: MainArgs): boolean {
  return args.debug || process.env.DEBUG === "session";
}

function getSessionDocsDir(internal = false): string {
  // Resolve from src/ to root/docs
  const base = join(dirname(import.meta.dir), "docs");
  return internal ? join(base, "internal") : base;
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
  session fetch <id>        Fetch archived session to local storage
  session resume <id>       Fetch (if needed) and resume a session
  session fork <id>         Fork a session (copy + resume the copy)
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
  --since-turn <n>   Show turns after index N (0-based). Use for incremental reads.
  --last <n>         Show only the last N turns.
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

  const localSessions = await discoverSessions({
    project: projectFilter,
    allProjects: findArgs.allProjects,
    since: findArgs.since,
  });

  // When --remote is set, discover remote sessions and merge with local ones.
  // Local sessions take priority over remote duplicates (higher fidelity).
  let sessions = localSessions;
  if (findArgs.remote) {
    const remoteSessions = await discoverRemoteSessions({
      since: findArgs.since,
    });
    sessions = mergeSessionLists(localSessions, remoteSessions);
  }

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
    const selectedSession = sessionMap.get(path);

    // For remote sessions, fetch to local storage first so claude can resume them
    if (selectedSession?.source === "remote") {
      try {
        const fetchResult = await fetchSession(selectedSession.id);
        if (!fetchResult.alreadyLocal) {
          console.log(formatFetchResult(fetchResult));
        }
        // Use the fetched session ID for resume
        const resumeProcess = Bun.spawn(["bun", "run", "c", "--resume", fetchResult.sessionId], {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        });
        await resumeProcess.exited;
        process.exit(resumeProcess.exitCode ?? 0);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error fetching remote session: ${error.message}`);
        } else {
          console.error("Failed to fetch remote session");
        }
        process.exit(1);
      }
    }

    // Local session: extract ID directly from the filename
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

  const localSessions = await discoverSessions({
    project: projectFilter,
    allProjects: listArgs.allProjects,
    since: listArgs.since,
  });

  // When --remote is set, discover remote sessions and merge with local ones.
  // Local sessions take priority over remote duplicates (higher fidelity).
  let sessions = localSessions;
  if (listArgs.remote) {
    const remoteSessions = await discoverRemoteSessions({
      since: listArgs.since,
    });
    sessions = mergeSessionLists(localSessions, remoteSessions);
  }

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
    if (process.stdout.isTTY) {
      console.log("\n  Expand: session <id>    Timeline: --timeline    Full: --full");
    }
  } else {
    for (const session of limited) {
      console.log(formatOutput(session, listArgs.output));
    }
  }
}

function printFetchHelp() {
  console.log(`
session fetch - Fetch an archived session to local storage

USAGE:
  session fetch <session-id|prefix>

Searches for the session locally first. If not found, searches the remote
archive at ~/agent-records/, decompresses the .jsonl.gz file, and places
it in the local Claude projects directory for use with other session commands.

Also fetches associated subagent files.

EXAMPLES:
  session fetch 159b7095                              # Fetch by short prefix
  session fetch 159b7095-3f96-4de5-a8a5-7cf445849bd6  # Fetch by full UUID
`);
}

function printResumeHelp() {
  console.log(`
session resume - Fetch (if needed) and resume a session

USAGE:
  session resume <session-id|prefix>

Fetches the session from ~/agent-records/ if it's not already local,
then spawns \`claude --resume <session-id>\` with interactive stdio.

EXAMPLES:
  session resume 159b7095                              # Resume by short prefix
  session resume 159b7095-3f96-4de5-a8a5-7cf445849bd6  # Resume by full UUID
`);
}

async function runFetch(args: string[]) {
  const fetchArgs = parseFetchArgs(args);

  if (fetchArgs.help) {
    printFetchHelp();
    return;
  }

  if (!fetchArgs.sessionId) {
    console.error("Error: session ID required\n");
    printFetchHelp();
    process.exit(1);
  }

  try {
    const result = await fetchSession(fetchArgs.sessionId);
    console.log(formatFetchResult(result));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

async function runResume(args: string[]) {
  const resumeArgs = parseResumeArgs(args);

  if (resumeArgs.help) {
    printResumeHelp();
    return;
  }

  if (!resumeArgs.sessionId) {
    console.error("Error: session ID required\n");
    printResumeHelp();
    process.exit(1);
  }

  try {
    // Step 1: Fetch (no-op if already local)
    const result = await fetchSession(resumeArgs.sessionId);

    if (!result.alreadyLocal) {
      // Print the fetch result so the user knows what happened
      console.log(formatFetchResult(result));
    }

    // Step 2: Spawn claude --resume with interactive stdio
    // Use "bun run c" which runs claude with --dangerously-skip-permissions
    const resumeProcess = Bun.spawn(
      ["bun", "run", "c", "--resume", result.sessionId],
      {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }
    );
    await resumeProcess.exited;
    process.exit(resumeProcess.exitCode ?? 0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

function printForkHelp() {
  console.log(`
session fork - Fork a session (copy + resume the copy)

USAGE:
  session fork <session-id|prefix>

Creates a copy of the session JSONL with a new UUID. The original session
is untouched — like branching in git. Then resumes the copy interactively.

Subagent files (agent-*.jsonl) and nested subagent directories are also
copied to keep the forked session self-contained.

OPTIONS:
  --dry-run   Show what would be copied without doing it

EXAMPLES:
  session fork 3263a294                              # Fork by short prefix
  session fork 3263a294-abcd-4567-8901-234567890abc  # Fork by full UUID
  session fork 3263a294 --dry-run                    # Preview without copying
`);
}

async function runFork(args: string[]) {
  const forkArgs = parseForkArgs(args);

  if (forkArgs.help) {
    printForkHelp();
    return;
  }

  if (!forkArgs.sessionId) {
    console.error("Error: session ID required\n");
    printForkHelp();
    process.exit(1);
  }

  try {
    // Step 1: Fetch if remote (no-op if already local)
    const fetchResult = await fetchSession(forkArgs.sessionId);
    if (!fetchResult.alreadyLocal) {
      console.log(formatFetchResult(fetchResult));
    }

    // Step 2: Resolve to file path
    const sourcePath = await resolveSessionPath(forkArgs.sessionId);
    const sourceDir = (await import("node:path")).dirname(sourcePath);
    const sourceId = (await import("node:path")).basename(sourcePath, ".jsonl");

    // Step 3: Generate new UUID
    const newId = crypto.randomUUID();
    const newPath = (await import("node:path")).join(sourceDir, `${newId}.jsonl`);

    // Step 4: Copy main session file, rewriting sessionId
    const sourceContent = await Bun.file(sourcePath).text();
    const rewrittenContent = sourceContent.replaceAll(sourceId, newId);

    if (forkArgs.dryRun) {
      console.log(`Would fork session:`);
      console.log(`  Source: ${sourceId}`);
      console.log(`  Target: ${newId}`);
      console.log(`  File:   ${newPath}`);

      // Check for subagent files
      const { readdir } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const dirFiles = await readdir(sourceDir);
      const subagentFiles = dirFiles.filter(
        (f) => f.startsWith("agent-") && f.endsWith(".jsonl")
      );

      // Filter to subagents belonging to this session
      for (const subFile of subagentFiles) {
        const subContent = await Bun.file(join(sourceDir, subFile)).text();
        const firstLine = subContent.slice(0, subContent.indexOf("\n") || subContent.length);
        if (firstLine.includes(sourceId)) {
          console.log(`  Copy:   ${subFile}`);
        }
      }

      // Check nested subagents directory
      const nestedDir = join(sourceDir, sourceId, "subagents");
      try {
        const nestedFiles = await readdir(nestedDir);
        for (const f of nestedFiles) {
          if (f.startsWith("agent-") && f.endsWith(".jsonl")) {
            console.log(`  Copy:   ${sourceId}/subagents/${f} → ${newId}/subagents/${f}`);
          }
        }
      } catch {
        // No nested directory
      }

      return;
    }

    // Write the forked session file
    await Bun.write(newPath, rewrittenContent);

    // Step 5: Copy subagent files that belong to this session
    const { readdir, mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dirFiles = await readdir(sourceDir);
    const subagentFiles = dirFiles.filter(
      (f) => f.startsWith("agent-") && f.endsWith(".jsonl")
    );

    let subagentsCopied = 0;
    for (const subFile of subagentFiles) {
      const subPath = join(sourceDir, subFile);
      const subContent = await Bun.file(subPath).text();
      const firstLine = subContent.slice(0, subContent.indexOf("\n") || subContent.length);
      if (firstLine.includes(sourceId)) {
        const rewrittenSub = subContent.replaceAll(sourceId, newId);
        await Bun.write(subPath.replace(sourceId, newId), rewrittenSub);
        subagentsCopied++;
      }
    }

    // Copy nested subagents directory if it exists
    const nestedDir = join(sourceDir, sourceId, "subagents");
    try {
      const nestedFiles = await readdir(nestedDir);
      const targetNestedDir = join(sourceDir, newId, "subagents");
      await mkdir(targetNestedDir, { recursive: true });

      for (const f of nestedFiles) {
        if (f.startsWith("agent-") && f.endsWith(".jsonl")) {
          const content = await Bun.file(join(nestedDir, f)).text();
          const rewritten = content.replaceAll(sourceId, newId);
          await Bun.write(join(targetNestedDir, f), rewritten);
          subagentsCopied++;
        }
      }
    } catch {
      // No nested directory — that's fine
    }

    const shortNew = newId.slice(0, 8);
    const shortSrc = sourceId.slice(0, 8);
    console.log(`Forked ${shortSrc} → ${shortNew}`);
    if (subagentsCopied > 0) {
      console.log(`  Copied ${subagentsCopied} subagent file(s)`);
    }

    // Step 6: Resume the forked session
    const resumeProcess = Bun.spawn(
      ["bun", "run", "c", "--resume", newId],
      {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }
    );
    await resumeProcess.exited;
    process.exit(resumeProcess.exitCode ?? 0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

async function runSearchIn(args: string[]) {
  if (args.length < 2) {
    console.error("Usage: session search-in <id|path> <query>");
    process.exit(1);
  }

  const [fileOrId, ...queryParts] = args;
  const query = queryParts.join(" ");

  try {
    const filePath = await resolveSessionPath(fileOrId);
    const session = await parseSession(filePath, { includeSubagents: false });

    const matches = searchInSession(session.turns, query);

    if (matches.length === 0) {
      console.log(`No matches for "${query}" in ${session.turns.length} turns.`);
      return;
    }

    console.log(`Found ${matches.length} match(es) for "${query}":\n`);
    for (const match of matches) {
      console.log(`  Turn ${match.index} (${match.role}): ${match.snippet}`);
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

function runDocs(args: string[]): void {
  const { user, internal } = loadAllDocs(getSessionDocsDir);
  const allDocs = [...user, ...internal];

  const sub = args[0];

  // "session docs show <ref>"
  if (sub === "show" || sub === "get") {
    const ref = args[1];
    if (!ref) {
      console.error("Usage: session docs show <handle|number>");
      process.exit(1);
    }
    const doc = findDoc(ref, allDocs);
    if (!doc) {
      console.error(`Doc not found: ${ref}\n`);
      if (allDocs.length > 0) {
        console.error("Available docs:");
        for (let i = 0; i < allDocs.length; i++) {
          console.error(`  ${i + 1}  ${allDocs[i].meta.handle}`);
        }
      }
      process.exit(1);
    }
    console.log(doc.content);
    return;
  }

  // Default / "session docs list" / "session docs ls"
  if (allDocs.length === 0) {
    console.log("No docs found.");
    return;
  }

  let num = 1;
  if (user.length > 0) {
    for (const doc of user) {
      const n = (num++).toString().padStart(2);
      console.log(`${n}  ${doc.meta.name.padEnd(50)} [${doc.meta.type}]`);
      console.log(`    ${doc.meta.context}`);
    }
  }
  if (internal.length > 0) {
    if (user.length > 0) console.log();
    console.log("─── internal ───");
    console.log();
    for (const doc of internal) {
      const n = (num++).toString().padStart(2);
      console.log(`${n}  ${doc.meta.name.padEnd(50)} [${doc.meta.type}]`);
      console.log(`    ${doc.meta.context}`);
    }
  }
  console.log();
  console.log("Use: session docs show <handle|number>");
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

    // Stats, JSON, and timeline formats need subagent data for the summaries section
    const includeSubagents = args.subagents || args.timeline || args.format === "stats" || args.format === "json";

    // Parse session with debug timing and timeout
    let stepStart = Date.now();
    debugLog(debug, "Parsing session...");
    let session = await withTimeout(
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

    // Enrich session with git history commits when cwd and session ID are available.
    // Uses trailer-based discovery first (precise), then falls back to time-window.
    if (session.cwd && session.sessionId) {
      stepStart = Date.now();
      debugLog(debug, "Querying git history for commits...");
      try {
        const gitCommits = await getSessionCommits({
          cwd: session.cwd,
          sessionId: session.sessionId,
          startTime: session.startTimestamp,
          endTime: session.endTimestamp,
        });
        if (gitCommits.length > 0) {
          session.gitCommits = gitCommits;
          debugLog(debug, `Found ${gitCommits.length} git commit(s)`, stepStart);
        } else {
          debugLog(debug, "No git commits found for session", stepStart);
        }
      } catch {
        // Graceful degradation: git history is best-effort enrichment.
        // Fall back to regex-extracted commits if this fails.
        debugLog(debug, "Git history query failed, using regex commits", stepStart);
      }
    }

    // --- Turn windowing (--since-turn, --last) ---
    const sliceResult = sliceTurns(session.turns, {
      sinceTurn: args.sinceTurn,
      last: args.last,
    });

    if (args.sinceTurn != null || args.last != null) {
      session = { ...session, turns: sliceResult.turns };
      const header = formatPositionHeader({
        windowStart: sliceResult.windowStart,
        turnCount: sliceResult.turns.length,
        totalTurns: sliceResult.totalTurns,
      });
      if (header) {
        console.log(header);
        console.log();
      }
    }

    // Deduplicate task notifications (queued + delivered with same task-id)
    session = { ...session, turns: dedupTaskNotifications(session.turns) };

    // --timeline: standalone output mode showing chronological event flow
    if (args.timeline) {
      const events = buildTimeline(session, { reportLines: args.reportLines });
      const isTTY = process.stdout.isTTY !== false;
      const lines = formatTimeline(events, { showHints: isTTY, showTools: args.showTools });
      debugLog(debug, "Total parse time", totalStart);
      console.log(lines.join("\n"));
      return;
    }

    // --tool / --tools filter: standalone output mode that replaces normal formatting
    if (args.tool || args.tools) {
      const toolNames = args.tools
        ? args.tools.split(",").map((t) => t.trim())
        : [args.tool!];
      const options: Partial<FormatOptions> = {
        toolInput: args.toolInput,
        toolOutput: args.toolOutput,
        truncate: args.truncate,
      };
      const toolOutput = formatToolFilter(session, toolNames, options);
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
      commits: args.commits,
    };

    let output: string;
    switch (args.format) {
      case "json": {
        const jsonOutput = buildJsonOutput(session, args.truncate);
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
