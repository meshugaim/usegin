import { Command } from "commander";
import { getDb } from "../db";
import { dxShouldOutputJson } from "../../output";

export function buildHisPruneCommand(): Command {
  return new Command("prune")
    .description("Delete old submissions to keep the store small. Cascades to aspect_scores and empty sessions.")
    .option("--older-than <n>d", "Age threshold (e.g. 90d, 30d, 1d)", "180d")
    .option("--keep-friction", "Preserve submissions whose ratings include any friction_*/gap_*/anger/frustration ≥ 70 (high-signal data we want to keep)", false)
    .option("--dry-run", "Report what would be deleted without touching the DB", false)
    .action(actionPrune);
}

async function actionPrune(opts: { olderThan?: string; keepFriction?: boolean; dryRun?: boolean }) {
  const days = parseDays(opts.olderThan ?? "180d");
  if (days === null) {
    process.stderr.write(`error: --older-than must look like "<n>d" (e.g. 90d). Got "${opts.olderThan}"\n`);
    process.exit(2);
  }
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = getDb();

  const baseFilter = `s.ts < ?`;
  const frictionExclusion = opts.keepFriction
    ? `AND s.id NOT IN (
         SELECT a.submission_id FROM aspect_scores a
         WHERE a.score >= 70 AND (
           a.aspect LIKE 'friction_%' OR
           a.aspect LIKE 'gap_%' OR
           a.aspect IN ('anger','frustration','tool_thrashing','self_doubt')
         )
       )`
    : "";

  const candidates = db
    .prepare(
      `SELECT s.id AS id, s.session_id AS session_id, s.ts AS ts FROM submissions s
       WHERE ${baseFilter} ${frictionExclusion};`,
    )
    .all(cutoff) as Array<{ id: number; session_id: string; ts: string }>;

  if (candidates.length === 0) {
    if (dxShouldOutputJson()) {
      process.stdout.write(JSON.stringify({ deleted_submissions: 0, deleted_sessions: 0, dry_run: !!opts.dryRun, cutoff }) + "\n");
      return;
    }
    process.stdout.write(`nothing to prune older than ${days}d (cutoff ${cutoff})\n`);
    return;
  }

  if (opts.dryRun) {
    if (dxShouldOutputJson()) {
      process.stdout.write(JSON.stringify({
        dry_run: true,
        cutoff,
        would_delete_submissions: candidates.length,
        sessions_affected: new Set(candidates.map((c) => c.session_id)).size,
      }) + "\n");
      return;
    }
    process.stdout.write(`would delete ${candidates.length} submissions across ${new Set(candidates.map((c) => c.session_id)).size} sessions (older than ${days}d). Re-run without --dry-run to apply.\n`);
    return;
  }

  const tx = db.transaction(() => {
    const deleteSub = db.prepare(`DELETE FROM submissions WHERE id = ?;`);
    for (const c of candidates) deleteSub.run(c.id);
    const orphans = db
      .prepare(
        `DELETE FROM sessions WHERE id IN (
           SELECT s.id FROM sessions s
           LEFT JOIN submissions sub ON sub.session_id = s.id
           WHERE sub.id IS NULL
         ) RETURNING id;`,
      )
      .all() as Array<{ id: string }>;
    return orphans.length;
  });
  const deletedSessions = tx();

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify({
      deleted_submissions: candidates.length,
      deleted_sessions: deletedSessions,
      dry_run: false,
      cutoff,
    }) + "\n");
    return;
  }
  process.stdout.write(
    `pruned ${candidates.length} submissions and ${deletedSessions} empty sessions (older than ${days}d)\n`,
  );
}

function parseDays(input: string): number | null {
  const m = input.match(/^(\d+)d$/i);
  return m ? parseInt(m[1], 10) : null;
}
