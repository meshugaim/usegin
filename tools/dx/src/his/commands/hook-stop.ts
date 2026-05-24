import { Command } from "commander";
import { readState, updateState } from "../state";
import { listAspects } from "../aspects";
import dx from "../../../sdk";

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

/**
 * The hard Stop-block is opt-out per user. It's ON by default for the team; an
 * individual disables it via `users.<me>.overrides` in .dx/config.json or
 * `dx disable his.force_stop`. `DX_HIS_FORCE_STOP` is an explicit escape that
 * wins over config (1/true forces on, 0/false forces off) — the self-test sets
 * it so its block assertion is deterministic regardless of who runs it.
 */
function forceStopEnabled(): boolean {
  const override = process.env.DX_HIS_FORCE_STOP;
  if (override === "1" || override === "true") return true;
  if (override === "0" || override === "false") return false;
  return dx.isEnabled("his.force_stop");
}

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
    // No force pending. Soft-nudge Claude to file a self-rating if it's been
    // quiet on telemetry for a while — keeps the autonomous-rating loop honest
    // without blocking. Gated on the `his.nudge` dx toggle (off by default).
    if (dx.isEnabled("his.nudge")) {
      const NUDGE_INTERVAL = parseInt(process.env.DX_HIS_NUDGE_INTERVAL ?? "10", 10);
      const turnsSinceClaude = state.last_claude_rating_turn === null
        ? state.turn_count
        : state.turn_count - state.last_claude_rating_turn;
      const shouldNudge =
        NUDGE_INTERVAL > 0 &&
        turnsSinceClaude >= NUDGE_INTERVAL &&
        turnsSinceClaude % NUDGE_INTERVAL === 0;
      if (shouldNudge) {
        // Stop hooks don't allow `hookSpecificOutput.additionalContext` —
        // surface the nudge via top-level `systemMessage` instead.
        process.stdout.write(
          JSON.stringify({
            continue: true,
            systemMessage:
              `[his nudge] You haven't filed a self-rating in ${turnsSinceClaude} turn${turnsSinceClaude === 1 ? "" : "s"}. ` +
              `If you noticed friction, gaps, or vibe shifts since your last reading, drop a quick row: ` +
              `\`dx his rate --as=claude vibe=<n> [aspect=n] --note "..."\` or just \`dx his note --as=claude "..."\`. ` +
              `Skip if nothing notable happened.`,
          }) + "\n",
        );
        return;
      }
    }
    process.stdout.write(JSON.stringify({ continue: true }) + "\n");
    return;
  }

  // force_rate is armed, but the hard block is opt-out per user.
  if (!forceStopEnabled()) {
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
