import { parseResumeArgs } from "../cli-args";
import { fetchSession, formatFetchResult } from "../fetch";

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

export async function runResume(args: string[]) {
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
    // Use "just c" which runs claude-canonical (--dangerously-skip-permissions etc.)
    const resumeProcess = Bun.spawn(
      ["just", "c", "--resume", result.sessionId],
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
