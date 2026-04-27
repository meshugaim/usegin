import { Command } from "commander";
import { listSubmissions, listScoresForSubmission } from "../db";
import { dxShouldOutputJson } from "../../output";

export function buildHisShowCommand(): Command {
  return new Command("show")
    .description("Show submissions for a session.")
    .option("--session-id <id>", "Session ID (defaults to $CLAUDE_SESSION_ID)")
    .option("--last <n>", "Show only the last N submissions", "0")
    .action(actionShow);
}

async function actionShow(opts: { sessionId?: string; last?: string }) {
  const sessionId = opts.sessionId ?? process.env.CLAUDE_SESSION_ID ?? "unknown";
  const subs = listSubmissions(sessionId);
  const last = opts.last ? parseInt(opts.last, 10) : 0;
  const slice = last > 0 ? subs.slice(-last) : subs;

  const enriched = slice.map((sub) => ({
    ...sub,
    scores: listScoresForSubmission(sub.id),
  }));

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify({ session_id: sessionId, submissions: enriched }, null, 2) + "\n");
    return;
  }

  if (enriched.length === 0) {
    process.stdout.write(`no submissions for session ${sessionId}\n`);
    return;
  }

  for (const sub of enriched) {
    const pairs = sub.scores.map((s) => `${s.aspect}=${s.score}`).join(" ");
    process.stdout.write(
      `[${sub.ts}] sub#${sub.id} ${sub.actor}/${sub.trigger} turn=${sub.turn_index ?? "-"}\n`,
    );
    if (pairs) process.stdout.write(`  ${pairs}\n`);
    if (sub.note) process.stdout.write(`  note: ${sub.note}\n`);
  }
}
