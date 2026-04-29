import { Command } from "commander";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { recordSubmission, type Trigger } from "../db";
import { listAspects, resolveAspect, knownAspect } from "../aspects";
import { updateState, readState } from "../state";
import { SCORE_MIN, SCORE_MAX } from "../parse";

export function buildHisRateInteractiveCommand(): Command {
  return new Command("rate-interactive")
    .alias("ri")
    .description("Interactive human rating: general 1..100 → optional aspects → optional personal aspect → note. Press Enter to skip anything.")
    .option("--session-id <id>", "Session ID (defaults to $CLAUDE_SESSION_ID)")
    .option("--quick", "Skip everything but the general score (one keystroke + Enter)")
    .action(actionRateInteractive);
}

type Score = { aspect: string; score: number; original_key: string };

async function actionRateInteractive(opts: { sessionId?: string; quick?: boolean }) {
  const sessionId = opts.sessionId ?? process.env.CLAUDE_SESSION_ID ?? "unknown";
  const ask = await makeAsk();

  process.stderr.write("\nHow was the session? (1..100, Enter = 80)  ");
  const generalRaw = (await ask("")).trim();
  const general = parseScore(generalRaw, 80);

  const scores: Score[] = [{ aspect: "general", score: general, original_key: "general" }];
  let note = "";

  if (!opts.quick) {
    process.stderr.write(`\nMore aspects? [y/N] `);
    const more = (await ask("")).trim().toLowerCase();
    if (more === "y" || more === "yes") {
      await unfoldAspects(ask, scores);
    }

    process.stderr.write(`\nPersonal aspect (your own key)? [y/N] `);
    const personal = (await ask("")).trim().toLowerCase();
    if (personal === "y" || personal === "yes") {
      await addPersonalAspect(ask, scores);
    }

    process.stderr.write(`\nNote (optional, Enter = skip): `);
    note = (await ask("")).trim();
  }

  ask.close();

  const deduped = dedupeScores(scores);
  const ts = new Date().toISOString();
  const state = readState(sessionId);

  const subId = recordSubmission({
    sessionId,
    cwd: process.cwd(),
    turnIndex: state.turn_count,
    actor: "human",
    trigger: "rate-interactive" as Trigger,
    ts,
    note: note || undefined,
    raw: "interactive",
    scores: deduped.map((s) => ({ aspect: s.aspect, score: s.score })),
  });

  updateState(sessionId, (s) => {
    s.last_human_rating_turn = state.turn_count;
    return s;
  });

  process.stderr.write(
    `\nrecorded — ${deduped.map((s) => `${s.aspect}=${s.score}`).join(" ")}` +
      (note ? `  note: ${note}` : "") +
      `  (sub ${subId})\n`,
  );
}

function parseScore(input: string, fallback: number): number {
  if (!input) return fallback;
  const n = parseInt(input, 10);
  if (Number.isNaN(n)) return fallback;
  if (n < SCORE_MIN || n > SCORE_MAX) {
    process.stderr.write(`(score ${n} outside ${SCORE_MIN}..${SCORE_MAX} — stored anyway)\n`);
  }
  return n;
}

async function unfoldAspects(
  ask: (q: string) => Promise<string>,
  scores: Score[],
) {
  const all = listAspects();
  process.stderr.write(`\nAspects (pick comma-separated keys; aliases ok):\n`);
  for (const a of all) {
    const aliases = a.aliases.length ? ` (${a.aliases.join(",")})` : "";
    const hint = a.hint ? ` — ${a.hint}` : "";
    process.stderr.write(`  [${a.bucket[0]}] ${a.key}${aliases}${hint}\n`);
  }
  process.stderr.write(`\nKeys to rate (Enter = none): `);
  const raw = (await ask("")).trim();
  if (!raw) return;

  const keys = raw.split(/[,\s]+/).map((k) => k.trim()).filter(Boolean);
  for (const rawKey of keys) {
    const aspect = resolveAspect(rawKey);
    process.stderr.write(`  ${aspect} (1..100): `);
    const v = (await ask("")).trim();
    if (!v) continue;
    const score = parseScore(v, NaN);
    if (Number.isNaN(score)) continue;
    scores.push({ aspect, score, original_key: rawKey });
  }
}

async function addPersonalAspect(
  ask: (q: string) => Promise<string>,
  scores: Score[],
) {
  process.stderr.write(`Personal aspect key (free text, will dedupe against known aliases): `);
  const rawKey = (await ask("")).trim();
  if (!rawKey) return;
  const aspect = resolveAspect(rawKey);
  if (knownAspect(aspect)) {
    process.stderr.write(`  → resolved to existing aspect "${aspect}"\n`);
  }
  process.stderr.write(`  ${aspect} (1..100): `);
  const v = (await ask("")).trim();
  if (!v) return;
  const score = parseScore(v, NaN);
  if (Number.isNaN(score)) return;
  scores.push({ aspect, score, original_key: rawKey });
}

function dedupeScores(scores: Score[]): Score[] {
  // last write wins per aspect (canonical key after alias resolution)
  const map = new Map<string, Score>();
  for (const s of scores) map.set(s.aspect, s);
  return [...map.values()];
}

type Asker = ((q: string) => Promise<string>) & { close: () => void };

async function makeAsk(): Promise<Asker> {
  // For non-TTY stdin (piped/heredoc) the readline-question dance is racy with
  // EOF — we read all of stdin up front and pop one line per question. For TTY,
  // we use readline live.
  if (!process.stdin.isTTY) {
    const queue = await readAllLines();
    const fn = ((_q: string) => Promise.resolve(queue.shift() ?? "")) as Asker;
    fn.close = () => {};
    return fn;
  }
  let rl: ReadlineInterface | null = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  let closed = false;
  rl.on("close", () => { closed = true; rl = null; });
  const fn = ((q: string) =>
    new Promise<string>((res) => {
      if (closed || !rl) return res("");
      rl.question(q, (a) => res(a));
    })) as Asker;
  fn.close = () => { rl?.close(); };
  return fn;
}

async function readAllLines(): Promise<string[]> {
  let buf = "";
  for await (const chunk of process.stdin) buf += chunk;
  return buf.split("\n");
}
