import { Command } from "commander";
import { getDb } from "../db";
import { dxShouldOutputJson } from "../../output";

type AspectStat = {
  aspect: string;
  n: number;
  avg: number;
  min: number;
  max: number;
};

export function buildHisStatsCommand(): Command {
  return new Command("stats")
    .description("Aggregate stats per aspect — avg/min/max across submissions.")
    .option("--session-id <id>", "Limit to one session")
    .option("--actor <actor>", "Limit to human | claude")
    .option("--last-days <n>", "Limit to last N days")
    .option("--aspect <key>", "Limit to one aspect")
    .action(actionStats);
}

async function actionStats(opts: {
  sessionId?: string;
  actor?: string;
  lastDays?: string;
  aspect?: string;
}) {
  const db = getDb();
  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];
  if (opts.sessionId) {
    where.push("s.session_id = ?");
    params.push(opts.sessionId);
  }
  if (opts.actor) {
    where.push("s.actor = ?");
    params.push(opts.actor);
  }
  if (opts.lastDays) {
    const days = parseInt(opts.lastDays, 10);
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    where.push("s.ts >= ?");
    params.push(cutoff);
  }
  if (opts.aspect) {
    where.push("a.aspect = ?");
    params.push(opts.aspect);
  }

  const rows = db
    .prepare(
      `SELECT a.aspect AS aspect,
              COUNT(*) AS n,
              ROUND(AVG(a.score), 1) AS avg,
              MIN(a.score) AS min,
              MAX(a.score) AS max
       FROM aspect_scores a
       JOIN submissions s ON s.id = a.submission_id
       WHERE ${where.join(" AND ")}
       GROUP BY a.aspect
       ORDER BY n DESC, a.aspect ASC;`,
    )
    .all(...params) as AspectStat[];

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }

  if (rows.length === 0) {
    process.stdout.write("no scores match\n");
    return;
  }

  const aspectWidth = Math.max(...rows.map((r) => r.aspect.length), 6);
  process.stdout.write(
    `${"aspect".padEnd(aspectWidth)}  n   avg   min  max\n`,
  );
  for (const r of rows) {
    process.stdout.write(
      `${r.aspect.padEnd(aspectWidth)}  ${String(r.n).padStart(2)}  ${String(r.avg).padStart(5)}  ${String(r.min).padStart(3)}  ${String(r.max).padStart(3)}\n`,
    );
  }
}
