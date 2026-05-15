/**
 * dx fleet — pure logic for joining the jobs/ and sessions/ registries into
 * a single fleet view. All IO is parameterized (homeDir, now) so tests can
 * seed temp directories and freeze time.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

export interface JobState {
  jobId: string;
  state: string;
  tempo: string | null;
  intent: string;
  needs: string | null;
  sessionId: string | null;
  cwd: string;
  updatedAt: string;
  createdAt: string | null;
}

export interface SessionState {
  jobId: string | null;
  sessionId: string;
  cwd: string;
  updatedAtMs: number;
  status: string;
  name: string;
  pid: number;
}

export interface FleetRow {
  jobId: string;
  jobIdShort: string;
  sessionId: string;
  sessionIdShort: string;
  live: boolean;
  state: string;
  tempo: string | null;
  ageSeconds: number;
  ageHuman: string;
  updatedAt: string;
  needs: string;
  intent: string;
  cwd: string;
}

// State sort priority — lower = first.
const STATE_RANK: Record<string, number> = {
  blocked: 0,
  working: 1,
  done: 2,
};

function shortId(id: string | null | undefined): string {
  if (!id) return "";
  return id.slice(0, 8);
}

function firstLineTrim(s: string | null | undefined, max = 80): string {
  if (!s) return "";
  const line = s.split("\n", 1)[0].trim();
  if (line.length <= max) return line;
  return line.slice(0, max - 1) + "…";
}

function safeReadJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function readJobsRegistry(homeDir: string): JobState[] {
  const dir = join(homeDir, ".claude", "jobs");
  if (!existsSync(dir)) return [];
  const out: JobState[] = [];
  for (const entry of readdirSync(dir)) {
    const statePath = join(dir, entry, "state.json");
    if (!existsSync(statePath)) continue;
    const data = safeReadJson<Record<string, unknown>>(statePath);
    if (!data) continue;
    out.push({
      jobId: entry,
      state: typeof data.state === "string" ? data.state : "unknown",
      tempo: typeof data.tempo === "string" ? data.tempo : null,
      intent: typeof data.intent === "string" ? data.intent : "",
      needs: typeof data.needs === "string" ? data.needs : null,
      sessionId:
        typeof data.sessionId === "string" ? data.sessionId : null,
      cwd: typeof data.cwd === "string" ? data.cwd : "",
      updatedAt:
        typeof data.updatedAt === "string" ? data.updatedAt : "",
      createdAt:
        typeof data.createdAt === "string" ? data.createdAt : null,
    });
  }
  return out;
}

export function readSessionsRegistry(homeDir: string): SessionState[] {
  const dir = join(homeDir, ".claude", "sessions");
  if (!existsSync(dir)) return [];
  const out: SessionState[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue;
    if (entry === "pins.json") continue;
    const data = safeReadJson<Record<string, unknown>>(join(dir, entry));
    if (!data) continue;
    out.push({
      jobId: typeof data.jobId === "string" ? data.jobId : null,
      sessionId: typeof data.sessionId === "string" ? data.sessionId : "",
      cwd: typeof data.cwd === "string" ? data.cwd : "",
      updatedAtMs:
        typeof data.updatedAt === "number" ? data.updatedAt : 0,
      status: typeof data.status === "string" ? data.status : "",
      name: typeof data.name === "string" ? data.name : "",
      pid: typeof data.pid === "number" ? data.pid : 0,
    });
  }
  return out;
}

export function relativeAge(ageSeconds: number): string {
  const s = Math.max(0, Math.floor(ageSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function compareRows(a: FleetRow, b: FleetRow): number {
  const ra = STATE_RANK[a.state] ?? 99;
  const rb = STATE_RANK[b.state] ?? 99;
  if (ra !== rb) return ra - rb;
  // Newer updatedAt first.
  if (a.updatedAt > b.updatedAt) return -1;
  if (a.updatedAt < b.updatedAt) return 1;
  return 0;
}

export function joinFleet(
  jobs: JobState[],
  sessions: SessionState[],
  now: Date,
): FleetRow[] {
  const sessionByJob = new Map<string, SessionState>();
  for (const s of sessions) {
    if (s.jobId) sessionByJob.set(s.jobId, s);
  }
  const seenJobIds = new Set<string>();
  const rows: FleetRow[] = [];

  for (const job of jobs) {
    seenJobIds.add(job.jobId);
    const sess = sessionByJob.get(job.jobId) ?? null;
    const updatedAtIso = job.updatedAt;
    const updatedAtMs = updatedAtIso ? Date.parse(updatedAtIso) : NaN;
    const ageSeconds = Number.isFinite(updatedAtMs)
      ? Math.floor((now.getTime() - updatedAtMs) / 1000)
      : 0;
    const sessionId = sess?.sessionId ?? job.sessionId ?? "";
    rows.push({
      jobId: job.jobId,
      jobIdShort: shortId(job.jobId),
      sessionId,
      sessionIdShort: shortId(sessionId),
      live: sess !== null,
      state: job.state,
      tempo: job.tempo,
      ageSeconds,
      ageHuman: relativeAge(ageSeconds),
      updatedAt: updatedAtIso,
      needs: job.needs ?? "",
      intent: firstLineTrim(job.intent),
      cwd: job.cwd,
    });
  }

  // Sessions without a matching job folder — synthesize a minimal row.
  for (const sess of sessions) {
    if (sess.jobId && seenJobIds.has(sess.jobId)) continue;
    const jobId = sess.jobId ?? sess.sessionId;
    const updatedAtIso = sess.updatedAtMs
      ? new Date(sess.updatedAtMs).toISOString()
      : "";
    const ageSeconds = sess.updatedAtMs
      ? Math.floor((now.getTime() - sess.updatedAtMs) / 1000)
      : 0;
    rows.push({
      jobId,
      jobIdShort: shortId(jobId),
      sessionId: sess.sessionId,
      sessionIdShort: shortId(sess.sessionId),
      live: true,
      state: "unknown",
      tempo: null,
      ageSeconds,
      ageHuman: relativeAge(ageSeconds),
      updatedAt: updatedAtIso,
      needs: "",
      intent: firstLineTrim(sess.name),
      cwd: sess.cwd,
    });
  }

  rows.sort(compareRows);
  return rows;
}

export function countByState(rows: FleetRow[]): {
  total: number;
  blocked: number;
  working: number;
  done: number;
} {
  const counts = { total: rows.length, blocked: 0, working: 0, done: 0 };
  for (const r of rows) {
    if (r.state === "blocked") counts.blocked++;
    else if (r.state === "working") counts.working++;
    else if (r.state === "done") counts.done++;
  }
  return counts;
}

function truncCell(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + "…";
}

function padRight(s: string, width: number): string {
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

export function formatHumanTable(rows: FleetRow[]): string {
  // Column widths chosen to keep each row ≤120 chars.
  // job(9) sess(9) state(8) live(5) age(5) intent(40) needs(40) = 116 + spaces
  const widths = {
    jobId: 9,
    sessionId: 9,
    state: 8,
    live: 5,
    age: 5,
    intent: 40,
    needs: 40,
  };
  const header =
    padRight("JOB", widths.jobId) +
    padRight("SESS", widths.sessionId) +
    padRight("STATE", widths.state) +
    padRight("LIVE", widths.live) +
    padRight("AGE", widths.age) +
    padRight("INTENT", widths.intent) +
    "NEEDS";
  const lines: string[] = [header];
  for (const r of rows) {
    lines.push(
      padRight(r.jobIdShort, widths.jobId) +
        padRight(r.sessionIdShort, widths.sessionId) +
        padRight(r.state, widths.state) +
        padRight(r.live ? "yes" : "no", widths.live) +
        padRight(r.ageHuman, widths.age) +
        padRight(truncCell(r.intent, widths.intent - 1), widths.intent) +
        truncCell(r.needs, widths.needs),
    );
  }
  const counts = countByState(rows);
  lines.push(
    `${counts.total} jobs: ${counts.blocked} blocked, ${counts.working} working, ${counts.done} done.`,
  );
  return lines.join("\n");
}

export function formatJson(rows: FleetRow[], snapshotAt: Date): string {
  return JSON.stringify(
    {
      snapshotAt: snapshotAt.toISOString(),
      counts: countByState(rows),
      jobs: rows,
    },
    null,
    2,
  );
}

export function formatSnapshotMarkdown(
  rows: FleetRow[],
  snapshotAtIso: string,
): string {
  const counts = countByState(rows);
  const lines: string[] = [];
  lines.push(`# Fleet snapshot — ${snapshotAtIso}`);
  lines.push("");
  lines.push(
    `${counts.total} jobs: ${counts.blocked} blocked, ${counts.working} working, ${counts.done} done.`,
  );
  lines.push("");
  for (const r of rows) {
    lines.push(`## ${r.jobIdShort} · ${r.state} · ${r.ageHuman} ago`);
    lines.push("");
    lines.push(`- Intent: ${r.intent || "(none)"}`);
    lines.push(`- Needs: ${r.needs || "(none)"}`);
    lines.push(`- cwd: ${r.cwd || "(unknown)"}`);
    lines.push(`- sessionId: ${r.sessionId || "(unknown)"}`);
    lines.push(`- Live: ${r.live ? "yes" : "no"}`);
    lines.push(`- Last update: ${r.updatedAt || "(unknown)"}`);
    lines.push("");
  }
  lines.push("---");
  lines.push("Live read: `dx fleet`");
  lines.push(
    "Re-render this snapshot: `dx fleet snapshot --output <path>` to overwrite with current state.",
  );
  return lines.join("\n") + "\n";
}

/** Walk up from startFrom for the monorepo root (justfile + package.json). */
export function findRepoRoot(startFrom: string = process.cwd()): string {
  let dir = resolve(startFrom);
  while (dir !== "/") {
    if (
      existsSync(join(dir, "justfile")) &&
      existsSync(join(dir, "package.json"))
    ) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error(
    `dx fleet: could not find repo root from ${startFrom}`,
  );
}

export function defaultSnapshotPath(
  repoRoot: string,
  now: Date,
): string {
  const iso = now.toISOString().slice(0, 19).replace(/:/g, "-");
  return join(
    repoRoot,
    "usegin",
    "memento",
    "scopes",
    "fleet-snapshots",
    `${iso}Z.md`,
  );
}

// Re-export node:fs helpers used by command handlers so tests can stub via
// dependency injection if needed in the future.
export const __internal = { readFileSync, statSync };
