import { parseResumeArgs } from "../cli-args";
import { fetchSession, formatFetchResult } from "../fetch";

function printResumeHelp() {
  console.log(`
session resume - Fetch (if needed) and resume a session

USAGE:
  session resume <session-id|prefix> [--fork]

Fetches the session from ~/agent-records/ if it's not already local,
checks whether another environment currently holds the dev-session
lock, then spawns \`claude --resume <session-id>\` with interactive
stdio. If the lock is held by another live environment, the CLI
shows the holder's identity and refuses unless --fork is passed.

OPTIONS:
  --fork    When the lock is held by another live environment, fork
            this session under a fresh UUID (rewriting only the
            top-level sessionId field on each JSONL line), initial-
            sync to Supabase with parent_session_id +
            forked_at_turn metadata, and resume the fork.
            Subagent-fork is not supported in v1; sessions with
            subagent files refuse with a clear message.

EXAMPLES:
  session resume 159b7095                              # Resume by short prefix
  session resume 159b7095-3f96-4de5-a8a5-7cf445849bd6  # Resume by full UUID
  session resume 159b7095 --fork                       # Fork-on-conflict resume
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

  // ENG-5862 step 8 (AC 36) — Red phase: --fork is parsed (see
  // `parseResumeArgs`) but the lock-state probe + fork-and-initial-sync
  // orchestration is left un-wired here. The test file
  // (`./resume.test.ts`) pins the four behavioral assertions Green must
  // satisfy:
  //
  //   1. Lock-held, no --fork → print holder + suggest --fork + exit≠0.
  //   2. Lock-held, --fork    → fork orchestrator called with
  //                              originalSessionId + forkedAtTurn.
  //   3. --fork                → claude --resume spawns with a NEW
  //                              UUIDv4, not the original.
  //   4. --fork on session with subagents → refuse with v1 message.
  //
  // Green will:
  //   - Read creds via `tools/lib/auth/credentials.readCredentials`.
  //   - Resolve api_url via `getApiUrl()`.
  //   - Detect env via `tools/session-sync/src/env-detect`.
  //   - Call `queryLockState` (see `./lock-state.ts` — Red stub).
  //   - If held & !ours & !--fork → printLockHeldRefusal + exit.
  //   - If held & !ours & --fork → call performForkAndInitialSync (see
  //     `./resume-fork.ts` — Red stub), translate failures, spawn
  //     `just c --resume <new_id>`.
  //   - Otherwise → existing legacy spawn (unchanged).

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
      },
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
