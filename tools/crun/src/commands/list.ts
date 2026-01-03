import { Command } from "commander";
import { listProcesses, listHistoricalProcesses } from "../pm2";
import { getPromptPreview } from "../session";
import { homedir } from "os";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type { CrunProcess, ProcessStatus } from "../types";

const PM2_LOG_DIR = join(homedir(), ".pm2", "logs");

export function createListCommand(): Command {
  const cmd = new Command("list")
    .alias("ls")
    .description("List all crun processes")
    .option("--json", "Output as JSON")
    .option("--all", "Include historical (completed/dead) processes")
    .option("-v, --verbose", "Show output snippet for each process")
    .option("--issue <id>", "Filter by issue ID (e.g., ENG-779 or 779)")
    .action(async (opts) => {
      await runList(opts);
    });

  return cmd;
}

function formatElapsed(startedAt?: Date): string {
  if (!startedAt) return "-";

  const now = Date.now();
  const elapsed = now - startedAt.getTime();
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "<1m";
}

function truncatePrompt(prompt?: string, maxLength: number = 40): string {
  if (!prompt) return "-";
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength - 3) + "...";
}

/**
 * Truncate a line to maxLength, adding ellipsis if needed.
 * Exported for testing.
 */
export function truncateLine(line: string, maxLength: number): string {
  if (line.length <= maxLength) return line;
  return line.slice(0, maxLength - 3) + "...";
}

/**
 * Get last N lines of output from a session's log file.
 * Exported for testing.
 */
export async function getOutputSnippet(sessionId: string, lines: number = 5): Promise<string | null> {
  try {
    const files = await readdir(PM2_LOG_DIR);
    const outLog = files.find(
      (f) => f.includes(sessionId) && f.endsWith("-out.log")
    );
    if (!outLog) return null;

    const content = await readFile(join(PM2_LOG_DIR, outLog), "utf-8");
    if (!content.trim()) return null;

    // Get last N non-empty lines
    const allLines = content.split("\n").filter((l) => l.trim());
    const lastLines = allLines.slice(-lines);
    return lastLines.join("\n");
  } catch {
    return null;
  }
}

// Column widths for table alignment
// ID(8) + 2 spaces + STATUS(10) + 2 spaces + ELAPSED(8) + 2 spaces + ISSUE(10) + 2 spaces = 44
const PROMPT_COLUMN_OFFSET = 44;

/**
 * Format output snippet with arrow prefix and alignment under PROMPT column.
 * Exported for testing.
 */
export function formatOutputSnippet(
  snippet: string,
  maxLineLength: number = 50,
  maxLines: number = 3
): string {
  if (!snippet.trim()) return "";

  const lines = snippet.split("\n").filter((l) => l.trim());
  const truncatedLines = lines.slice(-maxLines);
  const indent = " ".repeat(PROMPT_COLUMN_OFFSET);

  return truncatedLines
    .map((line) => `${indent}→ ${truncateLine(line, maxLineLength)}`)
    .join("\n");
}

/**
 * Format indicator for processes with no logs available.
 * Exported for testing.
 */
export function formatNoLogsIndicator(): string {
  const indent = " ".repeat(PROMPT_COLUMN_OFFSET);
  return `${indent}(no logs)`;
}

/**
 * Filter processes by issue ID.
 * Supports short form (779 matches ENG-779) and is case-insensitive.
 * Exported for testing.
 */
export function filterByIssue(
  processes: CrunProcess[],
  issueFilter?: string
): CrunProcess[] {
  if (!issueFilter || issueFilter.trim() === "") {
    return processes;
  }

  const filter = issueFilter.trim();
  const isShortForm = /^\d+$/.test(filter);

  return processes.filter((p) => {
    if (!p.issueId) return false;

    if (isShortForm) {
      // Short form: check if issueId ends with the number (e.g., ENG-779 matches 779)
      return p.issueId.endsWith(`-${filter}`);
    } else {
      // Full form: case-insensitive match
      return p.issueId.toLowerCase() === filter.toLowerCase();
    }
  });
}

/**
 * Format summary line showing status counts.
 * Example: "3 running, 2 done, 1 errored (6 total)"
 * Exported for testing.
 */
export function formatSummaryLine(statuses: ProcessStatus[]): string {
  if (statuses.length === 0) return "";

  // Count each status type in display order
  const statusOrder: ProcessStatus[] = [
    "running",
    "done",
    "errored",
    "stopped",
    "historical",
  ];
  const counts = new Map<ProcessStatus, number>();
  for (const status of statuses) {
    counts.set(status, (counts.get(status) || 0) + 1);
  }

  // Build parts for non-zero counts
  const parts: string[] = [];
  for (const status of statusOrder) {
    const count = counts.get(status);
    if (count && count > 0) {
      parts.push(`${count} ${status}`);
    }
  }

  return `${parts.join(", ")} (${statuses.length} total)`;
}

function formatTableRow(process: CrunProcess): string {
  const id = process.sessionId.slice(0, 8);
  const status = process.status.padEnd(10);
  const elapsed = formatElapsed(process.startedAt).padEnd(8);
  const issue = (process.issueId || "-").padEnd(10);
  const prompt = truncatePrompt(process.prompt);

  return `${id}  ${status}  ${elapsed}  ${issue}  ${prompt}`;
}

async function runList(opts: { json?: boolean; all?: boolean; verbose?: boolean; issue?: string }): Promise<void> {
  try {
    // Get active processes
    const activeProcesses = await listProcesses();

    // Optionally get historical processes
    let allProcesses: CrunProcess[];
    if (opts.all) {
      const historicalProcesses = await listHistoricalProcesses();
      // Active first, then historical
      allProcesses = [...activeProcesses, ...historicalProcesses];
    } else {
      allProcesses = activeProcesses;
    }

    // Apply issue filter
    allProcesses = filterByIssue(allProcesses, opts.issue);

    if (allProcesses.length === 0) {
      if (opts.json) {
        console.log("[]");
      } else {
        console.log("No crun processes found");
      }
      return;
    }

    // Fetch prompt previews for all processes
    const processesWithPrompts = await Promise.all(
      allProcesses.map(async (proc) => ({
        ...proc,
        prompt: (await getPromptPreview(proc.sessionId)) ?? undefined,
      }))
    );

    if (opts.json) {
      console.log(JSON.stringify(processesWithPrompts, null, 2));
      return;
    }

    // Print header
    console.log("ID        STATUS      ELAPSED   ISSUE       PROMPT");

    // Print rows
    for (const proc of processesWithPrompts) {
      console.log(formatTableRow(proc));

      // Show output snippet in verbose mode
      if (opts.verbose) {
        const snippet = await getOutputSnippet(proc.sessionId);
        if (snippet) {
          const formatted = formatOutputSnippet(snippet);
          if (formatted) {
            console.log(formatted);
          }
        } else {
          console.log(formatNoLogsIndicator());
        }
      }
    }

    // Print summary line
    const statuses = processesWithPrompts.map((p) => p.status);
    const summary = formatSummaryLine(statuses);
    if (summary) {
      console.log("");
      console.log(summary);
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
