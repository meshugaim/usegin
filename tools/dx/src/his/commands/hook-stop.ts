import { Command } from "commander";
import { readState, updateState } from "../state";
import { listAspects } from "../aspects";

export function buildHisHookStopCommand(): Command {
  return new Command("hook-stop")
    .description("Stop hook handler — physically blocks Claude from stopping until a final rating is filed when the session is marked ending.")
    .action(actionHookStop);
}

type HookInput = {
  session_id?: string;
  stop_hook_active?: boolean;
  hook_event_name?: string;
};

async function actionHookStop() {
  const payload = await readStdinJson<HookInput>();
  const sessionId =
    payload?.session_id ?? process.env.CLAUDE_SESSION_ID ?? "unknown";

  // Increment turn count every Stop fire — this is our "turn index" approximation.
  const state = updateState(sessionId, (s) => {
    s.turn_count = s.turn_count + 1;
    return s;
  });

  // If the hook has already blocked once and Claude is re-stopping, don't loop.
  if (payload?.stop_hook_active) {
    process.stdout.write(JSON.stringify({ continue: true }) + "\n");
    return;
  }

  if (!state.force_rate) {
    // No force pending — Claude either hasn't been asked to wrap up, or has
    // already filed a rating which cleared the flag. Either way, allow stop.
    process.stdout.write(JSON.stringify({ continue: true }) + "\n");
    return;
  }

  const allAspects = listAspects().map((a) => a.key);
  const reason =
    `Before ending the session, file a final how-is-session reading. Run:\n\n` +
    `  dx his rate --as=claude --note "<honest read on this session — vibe, friction, what felt off, what worked>" \\\n` +
    allAspects.map((k) => `    ${k}=<1..100>`).join(" \\\n") +
    `\n\nAll aspects required. Score 1..100. Note must be substantive (>= 30 chars). After it lands, call Stop again.`;

  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason,
    }) + "\n",
  );
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
