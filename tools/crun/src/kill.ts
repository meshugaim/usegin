/**
 * Kill command for crun
 *
 * Terminates running worker invocations.
 */

import {
  killInvocation,
  getInvocationsPath,
  type KillResult,
} from "./invocations";

/**
 * Format kill result for display
 */
export function formatKillResult(result: KillResult): string {
  switch (result.status) {
    case "killed":
      return `Killed: ${result.message}`;
    case "not_found":
      return `Not found: ${result.message}`;
    case "already_stopped":
      return `Already stopped: ${result.message}`;
    case "process_not_found":
      return `Stale entry cleaned up: ${result.message}`;
    case "kill_failed":
      return `Failed: ${result.message}`;
  }
}

/**
 * Run the kill command and return formatted output
 */
export async function runKill(
  id: string,
  filePath: string = getInvocationsPath()
): Promise<string> {
  const result = await killInvocation(id, filePath);
  return formatKillResult(result);
}
