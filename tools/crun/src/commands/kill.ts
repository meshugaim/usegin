import { Command } from "commander";
import { deleteProcess, deleteAllProcesses } from "../pm2";

export function createKillCommand(): Command {
  const cmd = new Command("kill")
    .description("Kill a crun process")
    .argument("[session-id]", "Session ID to kill (required unless --all)")
    .option("--all", "Kill all crun processes")
    .action(async (sessionId: string | undefined, opts) => {
      await runKill(sessionId, opts);
    });

  return cmd;
}

async function runKill(
  sessionId: string | undefined,
  opts: { all?: boolean }
): Promise<void> {
  try {
    if (opts.all) {
      const count = await deleteAllProcesses();
      console.log(`Killed ${count} processes`);
      return;
    }

    if (!sessionId) {
      console.error("Error: session-id is required (or use --all)");
      process.exit(1);
    }

    const success = await deleteProcess(sessionId);
    if (success) {
      console.log(`Killed: ${sessionId}`);
    } else {
      console.error(`Process not found: ${sessionId}`);
      process.exit(1);
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
