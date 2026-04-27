import { Command } from "commander";
import { listSessions, getDb } from "../db";
import { dxShouldOutputJson } from "../../output";

export function buildHisSessionsCommand(): Command {
  return new Command("sessions")
    .description("List recently rated sessions.")
    .option("--limit <n>", "Limit", "50")
    .action(actionSessions);
}

async function actionSessions(opts: { limit?: string }) {
  const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
  const sessions = listSessions(limit);
  const db = getDb();
  const counts = db
    .prepare(
      `SELECT session_id,
              COUNT(*) AS n_subs,
              SUM(CASE WHEN actor = 'human' THEN 1 ELSE 0 END) AS n_human,
              SUM(CASE WHEN actor = 'claude' THEN 1 ELSE 0 END) AS n_claude
       FROM submissions
       GROUP BY session_id;`,
    )
    .all() as Array<{ session_id: string; n_subs: number; n_human: number; n_claude: number }>;
  const cMap = new Map(counts.map((c) => [c.session_id, c]));

  const enriched = sessions.map((s) => ({
    ...s,
    counts: cMap.get(s.id) ?? { n_subs: 0, n_human: 0, n_claude: 0 },
  }));

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify(enriched, null, 2) + "\n");
    return;
  }

  if (enriched.length === 0) {
    process.stdout.write("no rated sessions yet\n");
    return;
  }

  for (const s of enriched) {
    process.stdout.write(
      `${s.id.slice(0, 8)}  last=${s.last_seen_at}  subs=${s.counts.n_subs} (h:${s.counts.n_human} c:${s.counts.n_claude})  cwd=${s.cwd ?? "-"}\n`,
    );
  }
}
