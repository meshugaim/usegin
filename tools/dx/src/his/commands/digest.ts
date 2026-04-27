import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { getDb } from "../db";
import { dxShouldOutputJson } from "../../output";

const MARKER_PATH = join(homedir(), ".claude", "dx-his", "digest-last-seen");

type SessionDigest = {
  session_id: string;
  cwd: string | null;
  started_at: string;
  last_seen_at: string;
  n_subs: number;
  n_human: number;
  n_claude: number;
  hot_aspects: Array<{ aspect: string; max_score: number }>;
  notable_notes: string[];
};

type AspectMovement = {
  aspect: string;
  prev_avg: number | null;
  curr_avg: number;
  delta: number | null;
  n: number;
};

const HIGH_FRICTION_THRESHOLD = 70;
const NOTE_PREVIEW_CHARS = 140;

export function buildHisDigestCommand(): Command {
  return new Command("digest")
    .description("Periodic digest — high-friction sessions and aspect drift over a window.")
    .option("--days <n>", "Window in days", "7")
    .option("--prev-days <n>", "Comparison window for drift (default = same length, immediately before)", "")
    .option("--since-last", "Use the last digest run as the window start (for cron/scheduled delivery). Updates the marker on success.", false)
    .option("--markdown", "Render as Markdown (paste-friendly for Slack / digests / GitHub issues).", false)
    .action(actionDigest);
}

async function actionDigest(opts: {
  days?: string;
  prevDays?: string;
  sinceLast?: boolean;
  markdown?: boolean;
}) {
  const days = opts.days ? parseInt(opts.days, 10) : 7;
  const prevDays = opts.prevDays ? parseInt(opts.prevDays, 10) : days;
  const now = Date.now();
  let currStart: string;
  let windowLabel: string;
  if (opts.sinceLast) {
    const last = readMarker();
    currStart = last ?? new Date(now - days * 86_400_000).toISOString();
    windowLabel = last ? `since last digest (${last})` : `last ${days} day${days === 1 ? "" : "s"} (no prior marker)`;
  } else {
    currStart = new Date(now - days * 86_400_000).toISOString();
    windowLabel = `last ${days} day${days === 1 ? "" : "s"}`;
  }
  const currStartMs = Date.parse(currStart);
  const prevWindowSpanMs = prevDays * 86_400_000;
  const prevStart = new Date(currStartMs - prevWindowSpanMs).toISOString();
  const prevEnd = currStart;

  const sessions = digestSessions(currStart);
  const movement = aspectMovement(currStart, prevStart, prevEnd);

  if (dxShouldOutputJson()) {
    process.stdout.write(
      JSON.stringify(
        { window_days: days, window: windowLabel, since: currStart, sessions, aspect_movement: movement },
        null,
        2,
      ) + "\n",
    );
    if (opts.sinceLast) writeMarker(new Date(now).toISOString());
    return;
  }

  if (opts.markdown) {
    renderMarkdown(windowLabel, currStart, sessions, movement, prevDays);
    if (opts.sinceLast) writeMarker(new Date(now).toISOString());
    return;
  }

  process.stdout.write(`How-Is-Session digest — ${windowLabel}\n`);
  process.stdout.write(`${"=".repeat(60)}\n\n`);

  if (sessions.length === 0) {
    process.stdout.write("no rated sessions in window\n\n");
  } else {
    process.stdout.write(`Sessions (${sessions.length}):\n`);
    for (const s of sessions) {
      const hot = s.hot_aspects.length
        ? `  hot: ${s.hot_aspects.map((h) => `${h.aspect}=${h.max_score}`).join(", ")}`
        : "";
      process.stdout.write(
        `  ${s.session_id.slice(0, 8)}  ${s.last_seen_at.slice(0, 16)}  subs=${s.n_subs} (h:${s.n_human} c:${s.n_claude})${hot}\n`,
      );
      for (const note of s.notable_notes.slice(0, 2)) {
        process.stdout.write(`    · ${note}\n`);
      }
    }
    process.stdout.write("\n");
  }

  if (movement.length === 0) {
    process.stdout.write("no aspect movement (need data in both windows)\n");
    return;
  }

  process.stdout.write(`Aspect drift vs prior ${prevDays}-day window:\n`);
  const aspectWidth = Math.max(...movement.map((m) => m.aspect.length), 6);
  for (const m of movement) {
    const arrow = m.delta === null ? "·" : m.delta > 0 ? "↑" : m.delta < 0 ? "↓" : "·";
    const deltaStr = m.delta === null ? "  -  " : `${m.delta >= 0 ? "+" : ""}${m.delta.toFixed(1)}`;
    const prev = m.prev_avg === null ? "  -  " : m.prev_avg.toFixed(1).padStart(5);
    process.stdout.write(
      `  ${m.aspect.padEnd(aspectWidth)}  ${prev} → ${m.curr_avg.toFixed(1).padStart(5)}  ${arrow} ${deltaStr}  (n=${m.n})\n`,
    );
  }

  if (opts.sinceLast) writeMarker(new Date(now).toISOString());
}

function renderMarkdown(
  windowLabel: string,
  since: string,
  sessions: SessionDigest[],
  movement: AspectMovement[],
  prevDays: number,
) {
  const out: string[] = [];
  out.push(`# How-Is-Session digest — ${windowLabel}`);
  out.push(`_since ${since}_`);
  out.push("");
  if (sessions.length === 0) {
    out.push("_no rated sessions in window_");
  } else {
    out.push(`## Sessions (${sessions.length})`);
    out.push("");
    for (const s of sessions) {
      const hot = s.hot_aspects.length
        ? ` — **hot:** ${s.hot_aspects.map((h) => `\`${h.aspect}=${h.max_score}\``).join(", ")}`
        : "";
      out.push(
        `- \`${s.session_id.slice(0, 8)}\`  ${s.last_seen_at.slice(0, 16)}  subs=${s.n_subs} (h:${s.n_human} c:${s.n_claude})${hot}`,
      );
      for (const note of s.notable_notes.slice(0, 2)) {
        out.push(`  - ${note}`);
      }
    }
    out.push("");
  }
  if (movement.length > 0) {
    out.push(`## Aspect drift vs prior ${prevDays}-day window`);
    out.push("");
    out.push("| aspect | prev | curr | Δ | n |");
    out.push("|---|---|---|---|---|");
    for (const m of movement) {
      const arrow = m.delta === null ? "·" : m.delta > 0 ? "↑" : m.delta < 0 ? "↓" : "·";
      const delta = m.delta === null ? "—" : `${m.delta >= 0 ? "+" : ""}${m.delta.toFixed(1)}`;
      const prev = m.prev_avg === null ? "—" : m.prev_avg.toFixed(1);
      out.push(`| \`${m.aspect}\` | ${prev} | ${m.curr_avg.toFixed(1)} | ${arrow} ${delta} | ${m.n} |`);
    }
  }
  process.stdout.write(out.join("\n") + "\n");
}

function readMarker(): string | null {
  if (!existsSync(MARKER_PATH)) return null;
  const v = readFileSync(MARKER_PATH, "utf8").trim();
  return v || null;
}

function writeMarker(ts: string) {
  mkdirSync(dirname(MARKER_PATH), { recursive: true });
  writeFileSync(MARKER_PATH, ts);
}

function digestSessions(currStart: string): SessionDigest[] {
  const db = getDb();
  const sessions = db
    .prepare(
      `SELECT s.id, s.cwd, s.started_at, s.last_seen_at,
              COUNT(sub.id) AS n_subs,
              SUM(CASE WHEN sub.actor='human' THEN 1 ELSE 0 END) AS n_human,
              SUM(CASE WHEN sub.actor='claude' THEN 1 ELSE 0 END) AS n_claude
       FROM sessions s
       LEFT JOIN submissions sub ON sub.session_id = s.id AND sub.ts >= ?
       WHERE s.last_seen_at >= ?
       GROUP BY s.id
       HAVING n_subs > 0
       ORDER BY s.last_seen_at DESC;`,
    )
    .all(currStart, currStart) as Array<{
      id: string;
      cwd: string | null;
      started_at: string;
      last_seen_at: string;
      n_subs: number;
      n_human: number;
      n_claude: number;
    }>;

  return sessions.map((s) => {
    const hot = db
      .prepare(
        `SELECT a.aspect AS aspect, MAX(a.score) AS max_score
         FROM aspect_scores a
         JOIN submissions sub ON sub.id = a.submission_id
         WHERE sub.session_id = ? AND a.score >= ?
         GROUP BY a.aspect
         ORDER BY max_score DESC
         LIMIT 5;`,
      )
      .all(s.id, HIGH_FRICTION_THRESHOLD) as Array<{ aspect: string; max_score: number }>;

    const notes = db
      .prepare(
        `SELECT note FROM submissions
         WHERE session_id = ? AND note IS NOT NULL AND length(note) > 10
         ORDER BY ts DESC
         LIMIT 3;`,
      )
      .all(s.id) as Array<{ note: string }>;

    return {
      session_id: s.id,
      cwd: s.cwd,
      started_at: s.started_at,
      last_seen_at: s.last_seen_at,
      n_subs: s.n_subs,
      n_human: s.n_human,
      n_claude: s.n_claude,
      hot_aspects: hot.filter((a) => isFrictionAspect(a.aspect)),
      notable_notes: notes.map((n) => truncateNote(n.note)),
    };
  });
}

function aspectMovement(currStart: string, prevStart: string, prevEnd: string): AspectMovement[] {
  const db = getDb();
  const curr = db
    .prepare(
      `SELECT a.aspect AS aspect, AVG(a.score) AS avg, COUNT(*) AS n
       FROM aspect_scores a
       JOIN submissions s ON s.id = a.submission_id
       WHERE s.ts >= ?
       GROUP BY a.aspect;`,
    )
    .all(currStart) as Array<{ aspect: string; avg: number; n: number }>;
  const prev = db
    .prepare(
      `SELECT a.aspect AS aspect, AVG(a.score) AS avg
       FROM aspect_scores a
       JOIN submissions s ON s.id = a.submission_id
       WHERE s.ts >= ? AND s.ts < ?
       GROUP BY a.aspect;`,
    )
    .all(prevStart, prevEnd) as Array<{ aspect: string; avg: number }>;
  const prevMap = new Map(prev.map((p) => [p.aspect, p.avg]));

  return curr
    .map((c) => {
      const prevAvg = prevMap.get(c.aspect) ?? null;
      return {
        aspect: c.aspect,
        prev_avg: prevAvg,
        curr_avg: c.avg,
        delta: prevAvg === null ? null : c.avg - prevAvg,
        n: c.n,
      };
    })
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
}

function isFrictionAspect(aspect: string): boolean {
  return (
    aspect.startsWith("friction_") ||
    aspect.startsWith("gap_") ||
    aspect === "anger" ||
    aspect === "frustration" ||
    aspect === "tool_thrashing" ||
    aspect === "self_doubt" ||
    aspect === "talked_too_much"
  );
}

function truncateNote(note: string): string {
  const single = note.replace(/\s+/g, " ").trim();
  return single.length > NOTE_PREVIEW_CHARS
    ? `${single.slice(0, NOTE_PREVIEW_CHARS - 1)}…`
    : single;
}
