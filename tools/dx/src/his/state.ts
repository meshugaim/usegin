import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type SessionState = {
  session_id: string;
  turn_count: number;
  force_rate: boolean;
  last_claude_rating_turn: number | null;
  last_human_rating_turn: number | null;
  ended: boolean;
};

const ROOT = join(homedir(), ".claude", "dx-his", "state");

export function statePath(sessionId: string): string {
  return process.env.DX_HIS_STATE_DIR
    ? join(process.env.DX_HIS_STATE_DIR, `${sessionId}.json`)
    : join(ROOT, `${sessionId}.json`);
}

export function readState(sessionId: string): SessionState {
  const path = statePath(sessionId);
  if (!existsSync(path)) {
    return {
      session_id: sessionId,
      turn_count: 0,
      force_rate: false,
      last_claude_rating_turn: null,
      last_human_rating_turn: null,
      ended: false,
    };
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SessionState;
  } catch {
    return {
      session_id: sessionId,
      turn_count: 0,
      force_rate: false,
      last_claude_rating_turn: null,
      last_human_rating_turn: null,
      ended: false,
    };
  }
}

export function writeState(state: SessionState): void {
  const path = statePath(state.session_id);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

export function updateState(
  sessionId: string,
  mutator: (s: SessionState) => SessionState,
): SessionState {
  const next = mutator(readState(sessionId));
  writeState(next);
  return next;
}
