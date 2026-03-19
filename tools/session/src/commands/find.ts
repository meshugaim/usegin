import {
  checkFzfAvailable,
  claudeProjectsDirExists,
  discoverRemoteSessions,
  discoverSessions,
  extractSessionMeta,
  formatMultiLineEntry,
  formatOutput,
  getCurrentProjectHash,
  mergeSessionLists,
  runFzfMultiLine,
  warnIfConflictingFlags,
  writeOutputFile,
} from "../finder";
import type { SessionInfo } from "../finder";
import { NoSessionsFoundError, FzfNotFoundError } from "../errors";
import { parseFindArgs } from "../cli-args";
import { parseSession } from "../parser";
import { formatMarkdown } from "../formatter";
import { fetchSession, formatFetchResult } from "../fetch";

/**
 * Discover sessions and build NUL-separated multi-line entries for fzf.
 * Shared between interactive find and --fzf-entries reload mode.
 */
async function buildFzfEntries(findArgs: ReturnType<typeof parseFindArgs>) {
  const currentProject = getCurrentProjectHash();
  const projectFilter = findArgs.allProjects
    ? undefined
    : findArgs.project || currentProject || undefined;

  const localSessions = await discoverSessions({
    project: projectFilter,
    allProjects: findArgs.allProjects,
    since: findArgs.since,
  });

  let sessions = localSessions;
  if (findArgs.remote) {
    const remoteSessions = await discoverRemoteSessions({
      since: findArgs.since,
    });
    sessions = mergeSessionLists(localSessions, remoteSessions);
  }

  const entries: string[] = [];
  const sessionMap = new Map<string, SessionInfo>();
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
    sessionMap.set(session.path, session);
    summaryMap.set(session.path, summary);
  }

  return { entries, sessionMap, summaryMap, currentProject, projectFilter, sessions };
}

/**
 * Build the shell commands used by the ctrl-x fzf binding.
 *
 * - deleteCommand: deletes the selected session (path extracted from last line of fzf entry)
 * - reloadCommand: re-discovers sessions and outputs NUL-separated entries for fzf reload
 */
function buildFzfDeleteCommands(findArgs: ReturnType<typeof parseFindArgs>) {
  const cliPath = new URL("../cli.ts", import.meta.url).pathname;

  // Reconstruct the find flags so the reload command discovers the same sessions
  const reloadFlags: string[] = ["--fzf-entries"];
  if (findArgs.allProjects) reloadFlags.push("--all-projects");
  if (findArgs.project) reloadFlags.push("--project", findArgs.project);
  if (findArgs.since) reloadFlags.push("--since", findArgs.since);
  if (findArgs.remote) reloadFlags.push("--remote");

  // Delete: extract path from last line of the fzf entry, pass to session rm --yes
  const deleteCommand = `echo {} | tail -1 | xargs bun ${cliPath} rm --yes`;

  // Reload: re-run find in --fzf-entries mode to regenerate the list
  const reloadCommand = `bun ${cliPath} find ${reloadFlags.join(" ")}`;

  return { deleteCommand, reloadCommand };
}

export async function runFind(args: string[]) {
  const findArgs = parseFindArgs(args);

  // Internal mode: output NUL-separated entries for fzf reload, then exit.
  // Used by the ctrl-x delete binding to refresh the session list.
  if (args.includes("--fzf-entries")) {
    const { entries } = await buildFzfEntries(findArgs);
    process.stdout.write(entries.join("\0"));
    return;
  }

  // Check fzf availability before doing any work
  if (!(await checkFzfAvailable())) {
    const error = new FzfNotFoundError();
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  // Warn if conflicting flags are specified
  const conflictWarning = warnIfConflictingFlags({
    project: findArgs.project,
    allProjects: findArgs.allProjects,
  });
  if (conflictWarning) {
    console.error(`Warning: ${conflictWarning}`);
  }

  const { entries, sessionMap, summaryMap, projectFilter, sessions } =
    await buildFzfEntries(findArgs);

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

  const { deleteCommand, reloadCommand } = buildFzfDeleteCommands(findArgs);

  const result = await runFzfMultiLine(entries, {
    preview: !findArgs.noPreview,
    deleteCommand,
    reloadCommand,
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
