import { Command } from "commander";
import { readState } from "../state";
import { recordSubmission } from "../db";

export function buildHisHookSessionEndCommand(): Command {
  return new Command("hook-session-end")
    .description("SessionEnd hook handler — records a meta marker if the session ended without a Claude final rating.")
    .action(actionHookSessionEnd);
}

type HookInput = { session_id?: string };

async function actionHookSessionEnd() {
  const payload = await readStdinJson<HookInput>();
  const sessionId = payload?.session_id ?? process.env.CLAUDE_SESSION_ID ?? "unknown";
  const state = readState(sessionId);

  const ratedAtCurrentTurn =
    state.last_claude_rating_turn !== null &&
    state.last_claude_rating_turn >= state.turn_count - 1;

  if (!ratedAtCurrentTurn) {
    recordSubmission({
      sessionId,
      cwd: process.cwd(),
      turnIndex: state.turn_count,
      actor: "claude",
      trigger: "session-end",
      ts: new Date().toISOString(),
      note: "session ended without a Claude final rating (auto-marker)",
      raw: "auto:session-end",
      scores: [],
    });
  }

  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
}

async function readStdinJson<T>(): Promise<T | null> {
  if (process.stdin.isTTY) return null;
  let buf = "";
  for await (const chunk of process.stdin) buf += chunk;
  if (!buf.trim()) return null;
  try {
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}
