import { Command } from "commander";
import { recordSubmission, type Actor, type Trigger } from "../db";
import { parseRatingArgs } from "../parse";
import { readState, updateState } from "../state";
import { dxShouldOutputJson } from "../../output";

export function buildHisRateCommand(): Command {
  const cmd = new Command("rate")
    .description("Append a rating submission for the current session (accumulates).")
    .argument("[args...]", "key=value pairs (1..100). Trailing free-text words become the note.")
    .option("--as <actor>", "Submission actor: human | claude", "human")
    .option("--note <text>", "Explicit note (overrides trailing free-text)")
    .option("--trigger <trigger>", "Submission trigger (manual | stop-hook | end-hook | session-end | periodic)", "manual")
    .option("--session-id <id>", "Session ID (defaults to $CLAUDE_SESSION_ID)")
    .option("--turn-index <n>", "Turn index (defaults to current state turn_count)")
    .action(actionRate);
  return cmd;
}

async function actionRate(rawArgs: string[], opts: {
  as: string;
  note?: string;
  trigger: string;
  sessionId?: string;
  turnIndex?: string;
}) {
  const actor = (opts.as === "claude" ? "claude" : "human") as Actor;
  const sessionId = opts.sessionId ?? process.env.CLAUDE_SESSION_ID ?? "unknown";
  const trigger = (opts.trigger as Trigger) ?? "manual";

  const parsed = parseRatingArgs(rawArgs ?? []);
  const note = opts.note ?? parsed.note;

  if (parsed.scores.length === 0 && !note) {
    const msg = "no aspects and no note provided — nothing to record";
    if (dxShouldOutputJson()) {
      process.stdout.write(JSON.stringify({ ok: false, error: msg }) + "\n");
    } else {
      process.stderr.write(`error: ${msg}\n`);
    }
    process.exit(2);
  }

  const ts = new Date().toISOString();
  const state = readState(sessionId);
  const turnIndex = opts.turnIndex !== undefined ? parseInt(opts.turnIndex, 10) : state.turn_count;

  const subId = recordSubmission({
    sessionId,
    cwd: process.cwd(),
    turnIndex,
    actor,
    trigger,
    ts,
    note: note || undefined,
    raw: rawArgs.join(" "),
    scores: parsed.scores.map((s) => ({ aspect: s.aspect, score: s.score })),
  });

  updateState(sessionId, (s) => {
    if (actor === "claude") {
      s.last_claude_rating_turn = turnIndex;
      // Any Claude rating clears the force-rate flag. The end+stop-hook flow
      // sets force_rate=true; once Claude has filed *any* rating after that,
      // we're satisfied — the next Stop fire is allowed through.
      if (s.force_rate) s.force_rate = false;
    } else {
      s.last_human_rating_turn = turnIndex;
    }
    return s;
  });

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify({
      ok: true,
      submission_id: subId,
      actor,
      session_id: sessionId,
      turn_index: turnIndex,
      scores: parsed.scores,
      note,
      warnings: parsed.warnings,
    }) + "\n");
    return;
  }

  const pairs = parsed.scores.map((s) => `${s.aspect}=${s.score}`).join(" ");
  process.stdout.write(`rated [${actor}]: ${pairs || "(no aspects)"}\n`);
  if (note) process.stdout.write(`note: ${note}\n`);
  process.stdout.write(`session: ${sessionId} turn: ${turnIndex} sub: ${subId}\n`);
  for (const w of parsed.warnings) process.stdout.write(`warn:  ${w}\n`);
}
