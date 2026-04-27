import { Command } from "commander";
import { getDb, type SubmissionRow, type AspectScoreRow } from "../db";
import { dxShouldOutputJson } from "../../output";

export function buildHisLastCommand(): Command {
  return new Command("last")
    .description("Show the most recent submission for a session.")
    .option("--session-id <id>", "Session ID (defaults to $CLAUDE_SESSION_ID)")
    .option("--actor <actor>", "Limit to human | claude")
    .action(actionLast);
}

async function actionLast(opts: { sessionId?: string; actor?: string }) {
  const sessionId = opts.sessionId ?? process.env.CLAUDE_SESSION_ID ?? "unknown";
  const db = getDb();
  const sub = (
    opts.actor
      ? db
          .prepare(
            `SELECT * FROM submissions WHERE session_id = ? AND actor = ? ORDER BY ts DESC, id DESC LIMIT 1;`,
          )
          .get(sessionId, opts.actor)
      : db
          .prepare(
            `SELECT * FROM submissions WHERE session_id = ? ORDER BY ts DESC, id DESC LIMIT 1;`,
          )
          .get(sessionId)
  ) as SubmissionRow | undefined;

  if (!sub) {
    if (dxShouldOutputJson()) {
      process.stdout.write(JSON.stringify({ submission: null }) + "\n");
      return;
    }
    process.stdout.write("no submissions yet\n");
    return;
  }

  const scores = db
    .prepare(`SELECT * FROM aspect_scores WHERE submission_id = ?;`)
    .all(sub.id) as AspectScoreRow[];

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify({ submission: { ...sub, scores } }, null, 2) + "\n");
    return;
  }

  const pairs = scores.map((s) => `${s.aspect}=${s.score}`).join(" ");
  process.stdout.write(`[${sub.ts}] sub#${sub.id} ${sub.actor}/${sub.trigger} turn=${sub.turn_index ?? "-"}\n`);
  if (pairs) process.stdout.write(`  ${pairs}\n`);
  if (sub.note) process.stdout.write(`  note: ${sub.note}\n`);
}
