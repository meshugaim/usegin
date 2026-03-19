import {
  claudeProjectsDirExists,
  discoverRemoteSessions,
  discoverSessions,
  extractSessionMeta,
  formatOutput,
  formatListLine,
  getCurrentProjectHash,
  mergeSessionLists,
  warnIfConflictingFlags,
} from "../finder";
import { NoSessionsFoundError } from "../errors";
import { parseListArgs } from "../cli-args";

export async function runList(args: string[]) {
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
