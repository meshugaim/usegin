import { Command } from "commander";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { readState } from "../state";
import { recordSubmission, lastHumanSubmissionSince } from "../db";

const SENTINEL_PATH = join(homedir(), ".claude", "dx-his", "last-ended-session.json");

export function buildHisHookSessionEndCommand(): Command {
  return new Command("hook-session-end")
    .description("SessionEnd hook handler — records a meta marker if the session ended without a Claude final rating, and drops a sentinel so the parent shell's claude() wrapper can drop the human into the picker.")
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

  // Drop a sentinel for the parent shell's claude() wrapper to pick up.
  // Best-effort — never break SessionEnd.
  try {
    const humanRated =
      state.last_human_rating_turn !== null ||
      lastHumanSubmissionSince(sessionId, "1970-01-01T00:00:00.000Z") !== undefined;
    if (state.force_rate && !humanRated) {
      mkdirSync(dirname(SENTINEL_PATH), { recursive: true });
      writeFileSync(
        SENTINEL_PATH,
        JSON.stringify({
          session_id: sessionId,
          ended_at: new Date().toISOString(),
          force_rate: true,
          cwd: process.cwd(),
        }, null, 2),
      );
    }
  } catch {
    // ignore — sentinel write is best-effort
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
