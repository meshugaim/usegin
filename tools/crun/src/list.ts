/**
 * List command for crun
 *
 * Displays invocations in a formatted table.
 */

import {
  listInvocations,
  type InvocationEntry,
  type ListInvocationsOptions,
  getInvocationsPath,
} from "./invocations";

/** Options parsed from CLI arguments */
export interface ListCommandOptions {
  running: boolean;
  today: boolean;
  limit: number;
}

/**
 * Truncate a string to maxLength with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + "...";
}

/**
 * Format session ID for display (first 6 chars + ellipsis)
 */
function formatSessionId(sessionId: string): string {
  return truncate(sessionId, 6);
}

/**
 * Format status with exit code if available
 */
function formatStatus(entry: InvocationEntry): string {
  if (entry.status === "completed" || entry.status === "failed") {
    const exitCode = entry.exitCode ?? "?";
    return `${entry.status} (${exitCode})`;
  }
  return entry.status;
}

/**
 * Format invocations as a table string
 */
export function formatInvocationsTable(invocations: InvocationEntry[]): string {
  // Column definitions
  const columns = [
    { header: "ID", width: 10 },
    { header: "SESSION", width: 12 },
    { header: "NOTE-TO-SELF", width: 35 },
    { header: "STATUS", width: 16 },
  ];

  // Build header row
  const headerRow = columns.map((col) => col.header.padEnd(col.width)).join("");
  const lines: string[] = [headerRow];

  // Build data rows
  for (const inv of invocations) {
    const id = inv.id.padEnd(columns[0].width);
    const session = formatSessionId(inv.sessionId).padEnd(columns[1].width);
    const note = truncate(inv.noteToSelf || "", 32).padEnd(columns[2].width);
    const status = formatStatus(inv).padEnd(columns[3].width);

    lines.push(`${id}${session}${note}${status}`);
  }

  return lines.join("\n");
}

/**
 * Parse CLI arguments for list command
 */
export function parseListArgs(args: string[]): ListCommandOptions {
  const result: ListCommandOptions = {
    running: false,
    today: false,
    limit: 10, // default limit
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--running") {
      result.running = true;
    } else if (arg === "--today") {
      result.today = true;
    } else if (arg === "--limit" || arg === "-l") {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        result.limit = parseInt(nextArg, 10);
        i++; // Skip next arg
      }
    }
  }

  return result;
}

/**
 * Run the list command and return formatted output
 */
export async function runList(
  options: ListCommandOptions,
  filePath: string = getInvocationsPath()
): Promise<string> {
  const listOptions: ListInvocationsOptions = {
    running: options.running || undefined,
    today: options.today || undefined,
    limit: options.limit,
  };

  const invocations = await listInvocations(listOptions, filePath);

  if (invocations.length === 0) {
    return "No invocations found.";
  }

  return formatInvocationsTable(invocations);
}
