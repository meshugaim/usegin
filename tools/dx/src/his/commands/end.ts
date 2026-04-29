import { Command } from "commander";
import { spawn, spawnSync } from "node:child_process";
import { updateState, readState } from "../state";
import { listAspects } from "../aspects";

export function buildHisEndCommand(): Command {
  return new Command("end")
    .description("Mark this session as wrapping up. Interactively, immediately launches the human rating picker; otherwise prints a clear instruction.")
    .option("--session-id <id>", "Session ID (defaults to $CLAUDE_SESSION_ID)")
    .option("--clear", "Clear the force-rate flag without rating", false)
    .option("--no-hold", "Don't spawn the background hold-until-rated daemon")
    .option("--no-picker", "Don't auto-launch the interactive picker (just arm + print hint)")
    .option("--json", "Emit JSON (state + spawned flags + aspects). Default is human-friendly text.")
    .action(actionEnd);
}

async function actionEnd(opts: {
  sessionId?: string;
  clear?: boolean;
  hold?: boolean;
  picker?: boolean;
  json?: boolean;
}) {
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

  if (opts.json) {
    process.stdout.write(
      JSON.stringify({ ok: true, state: next, hold_spawned: holdSpawned, aspects: listAspects() }) + "\n",
    );
    return;
  }

  if (opts.clear) {
    process.stderr.write("force-rate flag cleared.\n");
    return;
  }

  // Interactive: hand off to the picker so the human sees the UI immediately.
  const interactive = process.stdin.isTTY && process.stderr.isTTY;
  if (interactive && opts.picker !== false) {
    process.stderr.write(
      `session ${sessionId} marked ending.\n` +
        (holdSpawned
          ? `[gate active] /exit will warn about the open shell until you rate.\n`
          : ``),
    );
    const argv1 = process.argv[1] ?? "";
    const result = spawnSync(
      process.execPath,
      [argv1, "his", "rate-interactive", "--session-id", sessionId],
      { stdio: "inherit", env: process.env },
    );
    process.exit(result.status ?? 0);
  }

  // Non-interactive (no TTY, or --no-picker): print instructions, no JSON wall.
  process.stderr.write(
    `session ${sessionId} marked ending.\n` +
      (holdSpawned
        ? `[gate active] /exit will warn about the open shell until you rate.\n`
        : ``) +
      `\nOpen YOUR terminal and run:  dx his rate-interactive\n` +
      `   (one keystroke + Enter, or Enter through everything for default 80)\n` +
      `\nClaude side (separate): dx his rate --as=claude --note "..." <aspects>\n`,
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
