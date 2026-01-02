import { Command } from "commander";
import { getProcess, spawnProcess } from "../pm2";

export function createSendCommand(): Command {
  const cmd = new Command("send")
    .description("Send a follow-up message to an existing session")
    .argument("<session-id>", "Session ID to send to")
    .argument("<prompt>", "The follow-up prompt")
    .action(async (sessionId: string, prompt: string) => {
      await runSend(sessionId, prompt);
    });

  return cmd;
}

async function runSend(sessionId: string, prompt: string): Promise<void> {
  try {
    // Verify session exists
    const existing = await getProcess(sessionId);
    if (!existing) {
      console.error(`Session not found: ${sessionId}`);
      process.exit(1);
    }

    // Spawn new process resuming the session
    await spawnProcess({
      prompt,
      resumeSessionId: sessionId,
      issueId: existing.issueId,
    });

    console.log(`Sent follow-up to ${sessionId}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
