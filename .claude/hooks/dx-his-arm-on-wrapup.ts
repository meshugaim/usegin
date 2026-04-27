#!/usr/bin/env bun
/**
 * UserPromptSubmit hook — auto-arms the his force-rate flag when the human's
 * message reads as a wrap-up. Saves the human from having to type `/end`
 * explicitly; the next Stop will block until Claude files a final reading.
 *
 * Best-effort. Telemetry must never block normal flow — if anything fails,
 * we silently allow.
 */
import { readState, writeState } from "../../tools/dx/src/his/state";

const WRAPUP_PATTERNS: RegExp[] = [
  /\bthat'?s a wrap\b/i,
  /\bwe'?re done\b/i,
  /\blet'?s call it\b/i,
  /\bcall it a (?:day|night|wrap)\b/i,
  /\bship it and stop\b/i,
  /\bwrap (?:it )?up\b/i,
  /\bsession over\b/i,
  /\bgoodbye gin\b/i,
  /\bthanks,? (?:gin|claude),? bye\b/i,
];

type HookInput = {
  session_id?: string;
  prompt?: string;
  hook_event_name?: string;
};

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

async function main() {
  const payload = await readStdinJson<HookInput>();
  const sessionId = payload?.session_id ?? process.env.CLAUDE_SESSION_ID;
  const prompt = payload?.prompt ?? "";
  if (!sessionId || !prompt) {
    process.stdout.write(JSON.stringify({ continue: true }) + "\n");
    return;
  }

  const matched = WRAPUP_PATTERNS.find((re) => re.test(prompt));
  if (!matched) {
    process.stdout.write(JSON.stringify({ continue: true }) + "\n");
    return;
  }

  const state = readState(sessionId);
  if (state.force_rate) {
    // Already armed — don't double-fire.
    process.stdout.write(JSON.stringify({ continue: true }) + "\n");
    return;
  }
  state.force_rate = true;
  state.ended = true;
  writeState(state);

  // Soft nudge to Claude via additionalContext (non-blocking) so it sees the
  // arm and starts drafting its rating proactively rather than being slapped
  // by the Stop hook later.
  process.stdout.write(
    JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext:
          "[his] Wrap-up phrase detected — force_rate armed. " +
          "When you finish responding, file your final how-is-session reading: " +
          "`dx his rate --as=claude --trigger=stop-hook --note '...' <aspects>`. " +
          "Run `dx his aspects` for the full list. The Stop hook will block until you do.",
      },
    }) + "\n",
  );
}

main().catch(() => {
  // Telemetry is best-effort. Never block the user.
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
});
