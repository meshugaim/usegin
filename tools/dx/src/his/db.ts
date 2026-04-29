import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_DB_PATH = join(homedir(), ".claude", "dx-his", "his.db");

let _db: Database | undefined;

export function dbPath(): string {
  return process.env.DX_HIS_DB ?? DEFAULT_DB_PATH;
}

export function getDb(): Database {
  if (_db) return _db;
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  _db = new Database(path);
  _db.exec("PRAGMA journal_mode = WAL;");
  _db.exec("PRAGMA foreign_keys = ON;");
  migrate(_db);
  return _db;
}

export function closeDb() {
  _db?.close();
  _db = undefined;
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      cwd TEXT,
      started_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      turn_index INTEGER,
      actor TEXT NOT NULL CHECK (actor IN ('human','claude')),
      trigger TEXT NOT NULL,
      ts TEXT NOT NULL,
      note TEXT,
      raw TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS submissions_by_session ON submissions(session_id, ts);
    CREATE INDEX IF NOT EXISTS submissions_by_actor ON submissions(actor, ts);

    CREATE TABLE IF NOT EXISTS aspect_scores (
      submission_id INTEGER NOT NULL,
      aspect TEXT NOT NULL,
      score INTEGER NOT NULL,
      PRIMARY KEY (submission_id, aspect),
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS aspect_scores_by_aspect ON aspect_scores(aspect);
  `);
}

export type Actor = "human" | "claude";
export type Trigger =
  | "manual"
  | "stop-hook"
  | "end-hook"
  | "session-end"
  | "periodic"
  | "rate-interactive"
  | "auto";

export type SubmissionInput = {
  sessionId: string;
  cwd: string;
  turnIndex?: number;
  actor: Actor;
  trigger: Trigger;
  ts: string;
  note?: string;
  raw?: string;
  scores: Array<{ aspect: string; score: number }>;
};

export function recordSubmission(input: SubmissionInput): number {
  const db = getDb();
  const tx = db.transaction((data: SubmissionInput) => {
    db.prepare(
      `INSERT INTO sessions (id, cwd, started_at, last_seen_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at, cwd = COALESCE(sessions.cwd, excluded.cwd);`,
    ).run(data.sessionId, data.cwd, data.ts, data.ts);

    const result = db.prepare(
      `INSERT INTO submissions (session_id, turn_index, actor, trigger, ts, note, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
    ).run(
      data.sessionId,
      data.turnIndex ?? null,
      data.actor,
      data.trigger,
      data.ts,
      data.note ?? null,
      data.raw ?? null,
    );

    const subId = Number(result.lastInsertRowid);
    const insertScore = db.prepare(
      `INSERT INTO aspect_scores (submission_id, aspect, score) VALUES (?, ?, ?);`,
    );
    for (const s of data.scores) insertScore.run(subId, s.aspect, s.score);
    return subId;
  });

  return tx(input);
}

export type SessionRow = {
  id: string;
  cwd: string | null;
  started_at: string;
  last_seen_at: string;
};

export type SubmissionRow = {
  id: number;
  session_id: string;
  turn_index: number | null;
  actor: Actor;
  trigger: string;
  ts: string;
  note: string | null;
  raw: string | null;
};

export type AspectScoreRow = {
  submission_id: number;
  aspect: string;
  score: number;
};

export function listSubmissions(sessionId: string): SubmissionRow[] {
  return getDb()
    .prepare(`SELECT * FROM submissions WHERE session_id = ? ORDER BY ts ASC, id ASC;`)
    .all(sessionId) as SubmissionRow[];
}

export function listScoresForSubmission(submissionId: number): AspectScoreRow[] {
  return getDb()
    .prepare(`SELECT * FROM aspect_scores WHERE submission_id = ?;`)
    .all(submissionId) as AspectScoreRow[];
}

export function listSessions(limit = 50): SessionRow[] {
  return getDb()
    .prepare(`SELECT * FROM sessions ORDER BY last_seen_at DESC LIMIT ?;`)
    .all(limit) as SessionRow[];
}

export function lastHumanSubmissionSince(sessionId: string, sinceIso: string): SubmissionRow | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM submissions
       WHERE session_id = ? AND actor = 'human' AND ts >= ?
       ORDER BY ts DESC LIMIT 1;`,
    )
    .get(sessionId, sinceIso) as SubmissionRow | undefined;
}

export function lastClaudeSubmissionAt(sessionId: string, turnIndex: number | undefined): SubmissionRow | undefined {
  const db = getDb();
  if (turnIndex === undefined) {
    return db
      .prepare(
        `SELECT * FROM submissions WHERE session_id = ? AND actor = 'claude' ORDER BY ts DESC LIMIT 1;`,
      )
      .get(sessionId) as SubmissionRow | undefined;
  }
  return db
    .prepare(
      `SELECT * FROM submissions WHERE session_id = ? AND actor = 'claude' AND turn_index = ? ORDER BY ts DESC LIMIT 1;`,
    )
    .get(sessionId, turnIndex) as SubmissionRow | undefined;
}
