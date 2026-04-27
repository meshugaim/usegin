import { Command } from "commander";
import { updateState, readState } from "../state";
import { listAspects } from "../aspects";
import { dxShouldOutputJson } from "../../output";

export function buildHisEndCommand(): Command {
  return new Command("end")
    .description("Mark this session as wrapping up — forces Claude to file a final rating + note before stop.")
    .option("--session-id <id>", "Session ID (defaults to $CLAUDE_SESSION_ID)")
    .option("--clear", "Clear the force-rate flag without rating", false)
    .action(actionEnd);
}

async function actionEnd(opts: { sessionId?: string; clear?: boolean }) {
  const sessionId = opts.sessionId ?? process.env.CLAUDE_SESSION_ID ?? "unknown";
  const next = updateState(sessionId, (s) => ({
    ...s,
    force_rate: !opts.clear,
    ended: !opts.clear,
  }));

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify({ ok: true, state: next, aspects: listAspects() }) + "\n");
    return;
  }

  if (opts.clear) {
    process.stdout.write("force-rate flag cleared.\n");
    return;
  }

  process.stdout.write(
    `session ${sessionId} marked ending.\n` +
      `Claude must run \`dx his rate --as=claude --note "..." <aspects>\` before stopping.\n` +
      `Aspects available: ${listAspects().map((a) => a.key).join(", ")}\n`,
  );
}
