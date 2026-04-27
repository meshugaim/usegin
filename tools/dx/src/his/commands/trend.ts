import { Command } from "commander";
import { getDb } from "../db";
import { resolveAspect } from "../aspects";
import { dxShouldOutputJson } from "../../output";

type TrendRow = {
  session_id: string;
  ts: string;
  actor: string;
  score: number;
};

export function buildHisTrendCommand(): Command {
  return new Command("trend")
    .description("Show the trend for one aspect across recent sessions.")
    .argument("<aspect>", "Aspect key or alias (e.g. vibe, friction_running_tests, f_rt)")
    .option("--last <n>", "Number of recent sessions to include", "20")
    .option("--actor <actor>", "Limit to human | claude")
    .action(actionTrend);
}

async function actionTrend(aspectInput: string, opts: { last?: string; actor?: string }) {
  const aspect = resolveAspect(aspectInput);
  const last = opts.last ? parseInt(opts.last, 10) : 20;
  const db = getDb();

  const sessionIds = db
    .prepare(`SELECT id FROM sessions ORDER BY last_seen_at DESC LIMIT ?;`)
    .all(last) as Array<{ id: string }>;
  if (sessionIds.length === 0) {
    process.stdout.write(dxShouldOutputJson() ? "[]\n" : "no sessions\n");
    return;
  }
  const placeholders = sessionIds.map(() => "?").join(",");
  const where: string[] = [
    `s.session_id IN (${placeholders})`,
    `a.aspect = ?`,
  ];
  const params: (string | number)[] = [...sessionIds.map((s) => s.id), aspect];
  if (opts.actor) {
    where.push("s.actor = ?");
    params.push(opts.actor);
  }

  const rows = db
    .prepare(
      `SELECT s.session_id AS session_id,
              s.ts AS ts,
              s.actor AS actor,
              ROUND(AVG(a.score), 1) AS score
       FROM aspect_scores a
       JOIN submissions s ON s.id = a.submission_id
       WHERE ${where.join(" AND ")}
       GROUP BY s.session_id, s.actor
       ORDER BY s.ts ASC;`,
    )
    .all(...params) as TrendRow[];

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify({ aspect, rows }, null, 2) + "\n");
    return;
  }

  if (rows.length === 0) {
    process.stdout.write(`no data for aspect "${aspect}" in last ${last} sessions\n`);
    return;
  }

  process.stdout.write(`trend for ${aspect} (last ${last} sessions):\n`);
  for (const r of rows) {
    const bar = "█".repeat(Math.max(1, Math.round(r.score / 5)));
    process.stdout.write(
      `  ${r.ts}  ${r.actor.padEnd(6)}  ${String(r.score).padStart(5)}  ${bar}\n`,
    );
  }
}
