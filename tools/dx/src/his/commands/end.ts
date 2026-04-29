import { Command } from "commander";
import { spawn } from "node:child_process";
import { updateState, readState } from "../state";
import { listAspects } from "../aspects";
import { dxShouldOutputJson } from "../../output";

export function buildHisEndCommand(): Command {
  return new Command("end")
    .description("Mark this session as wrapping up — forces Claude to file a final rating + note before stop.")
    .option("--session-id <id>", "Session ID (defaults to $CLAUDE_SESSION_ID)")
    .option("--clear", "Clear the force-rate flag without rating", false)
    .option("--no-hold", "Don't spawn the background hold-until-rated daemon")
    .action(actionEnd);
}

async function actionEnd(opts: { sessionId?: string; clear?: boolean; hold?: boolean }) {
  const sessionId = opts.sessionId ?? process.env.CLAUDE_SESSION_ID ?? "unknown";
  const next = updateState(sessionId, (s) => ({
    ...s,
    force_rate: !opts.clear,
    ended: !opts.clear,
  }));

  let holdSpawned = false;
  if (!opts.clear && opts.hold !== false) {
    holdSpawned = spawnHoldDaemon(sessionId);
  }

  if (dxShouldOutputJson()) {
    process.stdout.write(
      JSON.stringify({ ok: true, state: next, hold_spawned: holdSpawned, aspects: listAspects() }) + "\n",
    );
    return;
  }

  if (opts.clear) {
    process.stdout.write("force-rate flag cleared.\n");
    return;
  }

  process.stdout.write(
    `session ${sessionId} marked ending.\n` +
      `\nHuman: rate the session before exiting →  \`dx his rate-interactive\`\n` +
      `       (one keystroke + Enter is enough; Enter through the rest to skip)\n` +
      (holdSpawned
        ? `\n[gate active] a background hold is keeping this shell open until you rate. /exit will warn you.\n`
        : ``) +
      `\nClaude (separate): \`dx his rate --as=claude --note "..." <aspects>\` before stopping.\n` +
      `Aspects: ${listAspects().map((a) => a.key).join(", ")}\n`,
  );
}

function spawnHoldDaemon(sessionId: string): boolean {
  try {
    const child = spawn(
      process.execPath,
      [process.argv[1] ?? "", "his", "hold-until-rated", "--session-id", sessionId],
      { detached: true, stdio: "ignore", env: process.env },
    );
    child.unref();
    return true;
  } catch {
    return false;
  }
}
