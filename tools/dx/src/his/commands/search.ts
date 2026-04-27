import { Command } from "commander";
import { getDb, type SubmissionRow } from "../db";
import { dxShouldOutputJson } from "../../output";

export function buildHisSearchCommand(): Command {
  return new Command("search")
    .description("Search submission notes (LIKE match).")
    .argument("<query>", "Substring to find in notes")
    .option("--actor <actor>", "Limit to human | claude")
    .option("--limit <n>", "Max rows", "50")
    .action(actionSearch);
}

async function actionSearch(query: string, opts: { actor?: string; limit?: string }) {
  const db = getDb();
  const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
  const where: string[] = ["note IS NOT NULL", "note LIKE ?"];
  const params: (string | number)[] = [`%${query}%`];
  if (opts.actor) {
    where.push("actor = ?");
    params.push(opts.actor);
  }
  params.push(limit);
  const rows = db
    .prepare(
      `SELECT * FROM submissions WHERE ${where.join(" AND ")} ORDER BY ts DESC LIMIT ?;`,
    )
    .all(...params) as SubmissionRow[];

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }

  if (rows.length === 0) {
    process.stdout.write(`no notes match "${query}"\n`);
    return;
  }

  for (const r of rows) {
    process.stdout.write(`[${r.ts}] ${r.actor}/${r.trigger} sess=${r.session_id.slice(0, 8)}\n  ${r.note}\n`);
  }
}
