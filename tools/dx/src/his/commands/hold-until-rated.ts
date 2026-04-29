import { Command } from "commander";
import { lastHumanSubmissionSince } from "../db";

export function buildHisHoldUntilRatedCommand(): Command {
  return new Command("hold-until-rated")
    .description("Long-running holder: stays alive until a human rating lands for this session, then exits 0. Spawned by `dx his end` so the upstream Claude Code CLI's open-shell prompt becomes the exit gate.")
    .option("--session-id <id>", "Session ID (defaults to $CLAUDE_SESSION_ID)")
    .option("--timeout-sec <n>", "Give up and exit 0 after N seconds (default 3600)", "3600")
    .option("--poll-ms <n>", "Poll interval (default 1000)", "1000")
    .action(actionHoldUntilRated);
}

async function actionHoldUntilRated(opts: {
  sessionId?: string;
  timeoutSec: string;
  pollMs: string;
}) {
  const sessionId = opts.sessionId ?? process.env.CLAUDE_SESSION_ID ?? "unknown";
  const timeoutSec = parseInt(opts.timeoutSec, 10);
  const pollMs = parseInt(opts.pollMs, 10);
  const startIso = new Date().toISOString();
  const deadline = Date.now() + timeoutSec * 1000;

  process.stderr.write(
    `[his hold] session=${sessionId} — holding until human rating lands. Run \`dx his rate-interactive\` to release.\n`,
  );

  while (Date.now() < deadline) {
    const row = lastHumanSubmissionSince(sessionId, startIso);
    if (row) {
      process.stderr.write(`[his hold] released — human submission ${row.id} landed.\n`);
      process.exit(0);
    }
    await sleep(pollMs);
  }

  process.stderr.write(`[his hold] timeout (${timeoutSec}s) — exiting clean.\n`);
  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
