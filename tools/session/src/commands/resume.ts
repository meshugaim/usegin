import { parseResumeArgs } from "../cli-args";
import { fetchSession, formatFetchResult } from "../fetch";
import { readCredentials, getApiUrl } from "../../../lib/auth/credentials";
import { detectEnvironment } from "../../../session-sync/src/env-detect.ts";
import { extractMetadata } from "../../../session-sync/src/extractor.ts";
import { queryLockState } from "./lock-state";
import { performForkAndInitialSync } from "./resume-fork";

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

/**
 * Format the holder fields into a refusal stderr line. Includes:
 *   - environment kind/id and username (who has the lock).
 *   - expires_at — both ISO substring (for assertion stability) and a
 *     human-friendly "expires" word so a future UX pass can swap the ISO
 *     for a relative ("expires in 47s") without re-pinning the test.
 *   - "--fork" remediation hint (per spec line 139: "offers --fork").
 */
function formatLockHeldRefusal(holder: {
  environment_kind: string | null;
  environment_id: string | null;
  username: string | null;
  expires_at: string | null;
}): string {
  const kind = holder.environment_kind ?? "<unknown>";
  const envId = holder.environment_id ?? "<unknown>";
  const user = holder.username ?? "<unknown>";
  const expires = holder.expires_at ?? "<unknown>";
  return (
    `Session is locked by ${kind}/${envId} (${user}); lock expires at ${expires}. ` +
    `Run with --fork to create a forked copy that resumes from the same history under a new id.`
  );
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
      console.log(formatFetchResult(result));
    }

    // Step 2: Probe lock state. The CLI needs to know — BEFORE spawning
    // `claude --resume` — whether another live environment holds the
    // dev-session lock. We do this through the same auth surface
    // (`readCredentials` + `getApiUrl`) that the daemon already uses.
    //
    // If credentials aren't readable we proceed with the legacy spawn —
    // the lock probe is an enhancement, not a precondition for resume.
    // Same goes for env detection: a missing or unrecognized env still
    // gets a usable resume (the legacy path predates env detection).
    const creds = await readCredentials();
    const apiUrl = creds ? await getApiUrl() : null;
    const env = creds ? detectEnvironment(process.env) : null;

    if (creds && apiUrl && env) {
      const lockState = await queryLockState({
        apiUrl,
        token: creds.access_token,
        sessionId: result.sessionId,
        environmentKind: env.kind,
        environmentId: env.id,
      });

      if (lockState.held && !lockState.ours) {
        if (!resumeArgs.fork) {
          // Lock-held refusal. Print the holder identity + --fork hint.
          // Exit non-zero so callers (shell, CI) see the failure.
          console.error(formatLockHeldRefusal(lockState.holder));
          process.exit(1);
        }

        // --fork path. Read the source JSONL to derive `forked_at_turn`
        // from extractMetadata's turn_count — the spec pins this as
        // "the last turn count of the source at fork time" (AC 36 (d)).
        // If the source file isn't readable here (e.g. the daemon raced
        // and removed it, or the fetch step put it somewhere we can't
        // re-read), fall back to turn 0 and let performForkAndInitialSync
        // re-attempt the read against the same path; that way the lineage
        // field is always present in the metadata even when extraction
        // races a parallel writer.
        let forkedAtTurn = 0;
        try {
          const sourceContent = await Bun.file(result.localPath).text();
          forkedAtTurn = extractMetadata(sourceContent).turn_count;
        } catch {
          // Leave forkedAtTurn at 0; the orchestrator will surface a clean
          // sync_failed if the file is truly unreadable.
        }

        const forkOutcome = await performForkAndInitialSync({
          apiUrl,
          token: creds.access_token,
          originalSessionId: result.sessionId,
          originalLocalPath: result.localPath,
          forkedAtTurn,
          environmentKind: env.kind,
          environmentId: env.id,
          username: creds.email,
          projectPath: process.cwd(),
        });

        if (!forkOutcome.ok) {
          // Translate typed failures into user-facing stderr.
          const err = forkOutcome.error;
          if (err.kind === "subagent_fork_not_supported") {
            console.error(
              `Cannot fork session: source has ${err.subagentCount} subagent ` +
                `file(s). Subagent-fork is not supported in v1; resume the ` +
                `parent session directly (without --fork) once the lock holder ` +
                `releases, or clear the subagent files manually.`,
            );
          } else {
            console.error(
              `Fork initial-sync failed (status ${err.status}). ` +
                `The forked JSONL is on local disk but the server doesn't ` +
                `know about it yet; retry the resume to re-sync, or contact ` +
                `the team if the failure persists. Body: ${err.body}`,
            );
          }
          process.exit(1);
        }

        // Fork succeeded — surface the lineage line and resume the NEW id.
        const shortNew = forkOutcome.result.newSessionId.slice(0, 8);
        const shortOrig = result.sessionId.slice(0, 8);
        console.log(
          `Forked ${shortOrig} → ${shortNew} (initial sync at ${forkOutcome.result.syncedAt})`,
        );
        const forkProcess = Bun.spawn(
          ["just", "c", "--resume", forkOutcome.result.newSessionId],
          { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
        );
        await forkProcess.exited;
        process.exit(forkProcess.exitCode ?? 0);
      }
    }

    // Step 3: Spawn claude --resume on the original id (no-lock-conflict
    // path, OR the lock is held by ourselves, OR creds/env weren't
    // available to probe).
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
      // Don't double-print our own "__test_exit_<n>__" markers — those are
      // the test stub's signal that process.exit was called, not real
      // errors to report.
      if (!error.message.startsWith("__test_exit_")) {
        console.error(`Error: ${error.message}`);
      }
      throw error;
    }
    console.error("An unknown error occurred");
    process.exit(1);
  }
}
