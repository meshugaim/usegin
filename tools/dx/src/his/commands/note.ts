import { Command } from "commander";
import { recordSubmission, type Actor, type Trigger } from "../db";
import { readState, updateState } from "../state";
import { dxShouldOutputJson } from "../../output";

export function buildHisNoteCommand(): Command {
  return new Command("note")
    .description("Append a note-only submission (no aspect scores).")
    .argument("<text...>", "free-form note")
    .option("--as <actor>", "Submission actor: human | claude", "human")
    .option("--trigger <trigger>", "Submission trigger", "manual")
    .option("--session-id <id>", "Session ID (defaults to $CLAUDE_SESSION_ID)")
    .option("--turn-index <n>", "Turn index")
    .action(actionNote);
}

async function actionNote(textParts: string[], opts: {
  as: string;
  trigger: string;
  sessionId?: string;
  turnIndex?: string;
}) {
  const actor = (opts.as === "claude" ? "claude" : "human") as Actor;
  const sessionId = opts.sessionId ?? process.env.CLAUDE_SESSION_ID ?? "unknown";
  const note = textParts.join(" ").trim();
  if (!note) {
    process.stderr.write("error: empty note\n");
    process.exit(2);
  }
  const state = readState(sessionId);
  const turnIndex = opts.turnIndex !== undefined ? parseInt(opts.turnIndex, 10) : state.turn_count;
  const subId = recordSubmission({
    sessionId,
    cwd: process.cwd(),
    turnIndex,
    actor,
    trigger: (opts.trigger as Trigger) ?? "manual",
    ts: new Date().toISOString(),
    note,
    raw: note,
    scores: [],
  });
  updateState(sessionId, (s) => {
    if (actor === "claude") {
      s.last_claude_rating_turn = turnIndex;
      if (s.force_rate) s.force_rate = false;
    } else {
      s.last_human_rating_turn = turnIndex;
    }
    return s;
  });
  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify({ ok: true, submission_id: subId, actor, note }) + "\n");
    return;
  }
  process.stdout.write(`note recorded [${actor}] sub:${subId}\n`);
}
