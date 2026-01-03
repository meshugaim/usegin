import { Command } from "commander";
import { listProcesses, listHistoricalProcesses } from "../pm2";
import { getPromptPreview } from "../session";
import type { CrunProcess } from "../types";

export function createListCommand(): Command {
  const cmd = new Command("list")
    .alias("ls")
    .description("List all crun processes")
    .option("--json", "Output as JSON")
    .option("--all", "Include historical (completed/dead) processes")
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

function formatTableRow(process: CrunProcess): string {
  const id = process.sessionId.slice(0, 8);
  const status = process.status.padEnd(10);
  const elapsed = formatElapsed(process.startedAt).padEnd(8);
  const issue = (process.issueId || "-").padEnd(10);
  const prompt = truncatePrompt(process.prompt);

  return `${id}  ${status}  ${elapsed}  ${issue}  ${prompt}`;
}

async function runList(opts: { json?: boolean; all?: boolean }): Promise<void> {
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
