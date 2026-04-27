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

  // Keep the block reason short and high-signal. Listing every aspect (~25)
  // turns the message into wallpaper. Pick the load-bearing ones; point to
  // `dx his aspects` for the rest.
  const headlineAspects = [
    "vibe",
    "friction_human_claude",
    "friction_running_tests",
    "gap_intent_vs_outcome",
    "tool_thrashing",
    "understood_human",
    "talked_too_much",
    "accuracy",
  ];
  const reason =
    `Before stopping, file your final how-is-session reading. Honest, short, concrete:\n\n` +
    `  dx his rate --as=claude --trigger=stop-hook \\\n` +
    `    --note "<one or two sentences: what worked, what felt off, the most useful thing for next-Gin to know>" \\\n` +
    headlineAspects.map((k) => `    ${k}=<1..100>`).join(" \\\n") +
    `\n\nAdd any other aspects that felt salient (run \`dx his aspects\` for the full list — anger, frustration, friction_claude_devenv, gap_app_vs_code, gap_code_vs_spec, self_doubt, etc.). Skip the ones that don't fit. Score 1..100. The note matters more than the scores.`;

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
