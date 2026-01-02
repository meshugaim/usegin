import { Command } from "commander";
import { getProcess, streamLogs } from "../pm2";

export function createTailCommand(): Command {
  const cmd = new Command("tail")
    .description("Stream logs from a crun process")
    .argument("<session-id>", "Session ID to tail")
    .option("--raw", "Stream raw pm2 logs (default: parsed via session CLI)")
    .action(async (sessionId: string, opts) => {
      await runTail(sessionId, opts);
    });

  return cmd;
}

async function runTail(
  sessionId: string,
  opts: { raw?: boolean }
): Promise<void> {
  try {
    const proc = await getProcess(sessionId);

    if (!proc) {
      console.error(`Process not found: ${sessionId}`);
      process.exit(1);
      return;
    }

    // Stream logs
    const logProc = streamLogs(sessionId, opts.raw);
    await logProc.exited;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
