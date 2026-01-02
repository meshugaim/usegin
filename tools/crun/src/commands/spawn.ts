import { Command } from "commander";
import { spawnProcess, streamLogs } from "../pm2";

export function createSpawnCommand(): Command {
  const cmd = new Command("spawn")
    .description("Spawn a new background Claude process")
    .argument("<prompt>", "The prompt to send to Claude")
    .option("-f, --follow", "Stream output, exit when process completes")
    .option("--issue <id>", "Link to Linear issue (updates on completion)")
    .option("--resume <session-id>", "Continue existing session in background")
    .option("--model <model>", "Override default model")
    .action(async (prompt: string, opts) => {
      await runSpawn(prompt, opts);
    });

  return cmd;
}

async function runSpawn(
  prompt: string,
  opts: {
    follow?: boolean;
    issue?: string;
    resume?: string;
    model?: string;
  }
): Promise<void> {
  try {
    const result = await spawnProcess({
      prompt,
      follow: opts.follow,
      issueId: opts.issue,
      resumeSessionId: opts.resume,
      model: opts.model,
    });

    if (opts.issue) {
      console.log(`Started: ${result.sessionId}, linked to ${opts.issue}`);
    } else {
      console.log(`Started: ${result.sessionId}`);
    }

    if (opts.follow) {
      // Stream logs until process exits
      const logProc = streamLogs(result.sessionId, false);
      await logProc.exited;
      console.log(`Done: ${result.sessionId}`);
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
