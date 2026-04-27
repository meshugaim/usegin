import { Command } from "commander";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync, createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { homedir, hostname } from "node:os";
import { getDb, recordSubmission, type Actor, type Trigger, type SubmissionRow, type AspectScoreRow } from "../db";
import { dxShouldOutputJson } from "../../output";

const SYNC_MARKER = join(homedir(), ".claude", "dx-his", "sync-last-exported");

type ExportedSubmission = {
  origin_host: string;
  session_id: string;
  ts: string;
  actor: Actor;
  trigger: string;
  turn_index: number | null;
  note: string | null;
  raw: string | null;
  cwd: string | null;
  scores: Array<{ aspect: string; score: number }>;
};

export function buildHisSyncCommand(): Command {
  const cmd = new Command("sync")
    .description("Export/import submissions for cross-machine team aggregation. JSONL files, dedupes on import.");
  cmd.addCommand(buildExportCommand());
  cmd.addCommand(buildImportCommand());
  return cmd;
}

function buildExportCommand(): Command {
  return new Command("export")
    .description("Write new submissions (since last sync export) as JSONL. Stdout if no path.")
    .argument("[path]", "Output file path; if omitted, writes to stdout")
    .option("--all", "Export everything, ignoring the sync marker", false)
    .option("--dry-run", "Report counts without writing or updating the marker", false)
    .action(actionExport);
}

function buildImportCommand(): Command {
  return new Command("import")
    .description("Import submissions from one or more JSONL files. Dedupes on (origin_host, session_id, ts, actor).")
    .argument("<paths...>", "JSONL files to import (or '-' for stdin)")
    .option("--dry-run", "Report what would be imported", false)
    .action(actionImport);
}

async function actionExport(path: string | undefined, opts: { all?: boolean; dryRun?: boolean }) {
  const db = getDb();
  const since = opts.all ? null : readMarker();
  const subs = (
    since
      ? db.prepare(`SELECT * FROM submissions WHERE ts > ? ORDER BY ts ASC, id ASC;`).all(since)
      : db.prepare(`SELECT * FROM submissions ORDER BY ts ASC, id ASC;`).all()
  ) as SubmissionRow[];
  const scoreStmt = db.prepare(`SELECT * FROM aspect_scores WHERE submission_id = ?;`);
  const sessionStmt = db.prepare(`SELECT cwd FROM sessions WHERE id = ?;`);
  const host = hostname();

  const records: ExportedSubmission[] = subs.map((sub) => ({
    origin_host: host,
    session_id: sub.session_id,
    ts: sub.ts,
    actor: sub.actor,
    trigger: sub.trigger,
    turn_index: sub.turn_index,
    note: sub.note,
    raw: sub.raw,
    cwd: (sessionStmt.get(sub.session_id) as { cwd: string | null } | undefined)?.cwd ?? null,
    scores: (scoreStmt.all(sub.id) as AspectScoreRow[]).map((s) => ({
      aspect: s.aspect,
      score: s.score,
    })),
  }));

  if (opts.dryRun) {
    if (dxShouldOutputJson()) {
      process.stdout.write(JSON.stringify({ dry_run: true, count: records.length, since }) + "\n");
      return;
    }
    process.stdout.write(`would export ${records.length} submission${records.length === 1 ? "" : "s"} (since ${since ?? "beginning"})\n`);
    return;
  }

  const writeLine = path
    ? (() => {
        mkdirSync(dirname(path), { recursive: true });
        const stream = createWriteStream(path, { flags: "w" });
        return (s: string) => stream.write(s);
      })()
    : (s: string) => process.stdout.write(s);
  for (const r of records) writeLine(JSON.stringify(r) + "\n");
  if (path) writeMarker(new Date().toISOString());

  if (dxShouldOutputJson() && path) {
    process.stdout.write(JSON.stringify({ exported: records.length, path }) + "\n");
  } else if (path) {
    process.stdout.write(`exported ${records.length} submissions → ${path}\n`);
  }
}

async function actionImport(paths: string[], opts: { dryRun?: boolean }) {
  const db = getDb();
  // Index existing rows for dedup. Since the local DB doesn't track origin_host
  // for native rows, we treat (session_id, ts, actor) as the dedup key. For
  // imported rows, we additionally tag the session row's cwd with origin_host
  // so downstream queries can tell where it came from.
  const existing = new Set<string>(
    (
      db
        .prepare(`SELECT session_id, ts, actor FROM submissions;`)
        .all() as Array<{ session_id: string; ts: string; actor: string }>
    ).map((r) => `${r.session_id}|${r.ts}|${r.actor}`),
  );

  let imported = 0;
  let skipped = 0;
  let bad = 0;
  for (const p of paths) {
    const lines = await readJsonlLines(p);
    for (const line of lines) {
      let r: ExportedSubmission;
      try {
        r = JSON.parse(line) as ExportedSubmission;
      } catch {
        bad++;
        continue;
      }
      if (!r.session_id || !r.ts || !r.actor) {
        bad++;
        continue;
      }
      const key = `${r.session_id}|${r.ts}|${r.actor}`;
      if (existing.has(key)) {
        skipped++;
        continue;
      }
      if (!opts.dryRun) {
        recordSubmission({
          sessionId: r.session_id,
          cwd: r.cwd ?? `imported:${r.origin_host}`,
          turnIndex: r.turn_index ?? undefined,
          actor: r.actor,
          trigger: (r.trigger as Trigger) ?? "manual",
          ts: r.ts,
          note: r.note ?? undefined,
          raw: r.raw ?? undefined,
          scores: r.scores ?? [],
        });
      }
      existing.add(key);
      imported++;
    }
  }

  if (dxShouldOutputJson()) {
    process.stdout.write(
      JSON.stringify({ imported, skipped, malformed: bad, dry_run: !!opts.dryRun }) + "\n",
    );
    return;
  }
  process.stdout.write(
    `${opts.dryRun ? "would import" : "imported"} ${imported}, skipped ${skipped} (already present)${
      bad ? `, ${bad} malformed lines` : ""
    }\n`,
  );
}

async function readJsonlLines(path: string): Promise<string[]> {
  if (path === "-") {
    let buf = "";
    for await (const chunk of process.stdin) buf += chunk;
    return buf.split("\n").filter((l) => l.trim());
  }
  if (!existsSync(path)) {
    process.stderr.write(`warn: ${path} not found, skipping\n`);
    return [];
  }
  if (!statSync(path).isFile()) {
    process.stderr.write(`warn: ${path} is not a file, skipping\n`);
    return [];
  }
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim());
}

function readMarker(): string | null {
  if (!existsSync(SYNC_MARKER)) return null;
  return readFileSync(SYNC_MARKER, "utf8").trim() || null;
}

function writeMarker(ts: string) {
  mkdirSync(dirname(SYNC_MARKER), { recursive: true });
  writeFileSync(SYNC_MARKER, ts);
}
