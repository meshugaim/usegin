import { Command } from "commander";
import { spawnProcess, followProcess } from "../pm2";

export function createSpawnCommand(): Command {
  const cmd = new Command("spawn")
    .description("Spawn a Claude process (streams output by default)")
    .argument("<prompt>", "The prompt to send to Claude")
    .option("-d, --detach", "Run in background without streaming output")
    .option("--issue <id>", "Link to Linear issue (updates on completion)")
    .option("--resume <session-id>", "Continue existing session")
    .option("--model <model>", "Override default model")
    .option("--max-memory <size>", "Memory limit for auto-restart (default: 500M)")
    .action(async (prompt: string, opts) => {
      await runSpawn(prompt, opts);
    });

  return cmd;
}

async function runSpawn(
  prompt: string,
  opts: {
    detach?: boolean;
    issue?: string;
    resume?: string;
    model?: string;
    maxMemory?: string;
  }
): Promise<void> {
  const follow = !opts.detach;

  try {
    const result = await spawnProcess({
      prompt,
      follow,
      issueId: opts.issue,
      resumeSessionId: opts.resume,
      model: opts.model,
      maxMemoryRestart: opts.maxMemory,
    });

    if (opts.issue) {
      console.log(`Started: ${result.sessionId}, linked to ${opts.issue}`);
    } else {
      console.log(`Started: ${result.sessionId}`);
    }

    if (follow) {
      // Stream logs until process exits, then terminate
      await followProcess(result.sessionId, opts.issue);
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
