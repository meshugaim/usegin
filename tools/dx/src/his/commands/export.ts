import { Command } from "commander";
import { getDb, type SubmissionRow, type AspectScoreRow } from "../db";

export function buildHisExportCommand(): Command {
  return new Command("export")
    .description("Export all submissions as JSONL to stdout (for offline analysis / pipelines).")
    .option("--session-id <id>", "Limit to one session")
    .action(actionExport);
}

async function actionExport(opts: { sessionId?: string }) {
  // Quiet EPIPE on `dx his export | head -N` and similar truncating pipes.
  process.stdout.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code === "EPIPE") process.exit(0);
    throw err;
  });

  const db = getDb();
  const subs = (
    opts.sessionId
      ? db
          .prepare(`SELECT * FROM submissions WHERE session_id = ? ORDER BY ts ASC, id ASC;`)
          .all(opts.sessionId)
      : db.prepare(`SELECT * FROM submissions ORDER BY ts ASC, id ASC;`).all()
  ) as SubmissionRow[];
  const stmt = db.prepare(`SELECT * FROM aspect_scores WHERE submission_id = ?;`);
  for (const sub of subs) {
    const scores = stmt.all(sub.id) as AspectScoreRow[];
    process.stdout.write(
      JSON.stringify({
        ...sub,
        scores: scores.map((s) => ({ aspect: s.aspect, score: s.score })),
      }) + "\n",
    );
  }
}
