import { parseFetchArgs } from "../cli-args";
import { fetchSession, formatFetchResult } from "../fetch";

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

export async function runFetch(args: string[]) {
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
