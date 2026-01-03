import { Command } from "commander";
import { getProcess, spawnProcess } from "../pm2";
import { resolveUniqueSessionId } from "../session";

export function createSendCommand(): Command {
  const cmd = new Command("send")
    .description("Send a follow-up message to an existing session")
    .argument("<session-id>", "Session ID (full or short prefix)")
    .argument("<prompt>", "The follow-up prompt")
    .action(async (sessionId: string, prompt: string) => {
      await runSend(sessionId, prompt);
    });

  return cmd;
}

async function runSend(sessionId: string, prompt: string): Promise<void> {
  try {
    // Resolve short ID to full session ID
    const fullSessionId = await resolveUniqueSessionId(sessionId);

    // Check if session is currently running in pm2 (to get issue ID)
    const existing = await getProcess(fullSessionId);

    // Spawn new process resuming the session
    await spawnProcess({
      prompt,
      resumeSessionId: fullSessionId,
      issueId: existing?.issueId,
    });

    console.log(`Sent follow-up to ${fullSessionId}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
