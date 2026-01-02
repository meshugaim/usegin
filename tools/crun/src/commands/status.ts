import { Command } from "commander";
import { getProcess } from "../pm2";

export function createStatusCommand(): Command {
  const cmd = new Command("status")
    .description("Show status of a crun process")
    .argument("<session-id>", "Session ID to check")
    .option("--json", "Output as JSON")
    .action(async (sessionId: string, opts) => {
      await runStatus(sessionId, opts);
    });

  return cmd;
}

function formatElapsed(startedAt?: Date): string {
  if (!startedAt) return "-";

  const now = Date.now();
  const elapsed = now - startedAt.getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

async function runStatus(
  sessionId: string,
  opts: { json?: boolean }
): Promise<void> {
  try {
    const proc = await getProcess(sessionId);

    if (!proc) {
      console.error(`Process not found: ${sessionId}`);
      process.exit(1);
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(proc, null, 2));
      return;
    }

    console.log(`Session: ${proc.sessionId}`);
    console.log(`Status: ${proc.status}`);
    if (proc.pid) {
      console.log(`PID: ${proc.pid}`);
    }
    console.log(`Elapsed: ${formatElapsed(proc.startedAt)}`);
    if (proc.issueId) {
      console.log(`Issue: ${proc.issueId}`);
    }
    if (proc.prompt) {
      console.log(`Prompt: ${proc.prompt}`);
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
