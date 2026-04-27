#!/usr/bin/env bun
/**
 * PostToolUse hook for Bash — when a command fails in a way that's a real
 * friction signal (test runner failure, push rejected, dev-env tool missing,
 * timeout), file a `dx his note --as=claude --trigger=auto` row so the
 * machine's own friction signal is captured alongside the human/Claude's
 * subjective reads.
 *
 * Best-effort. Telemetry must never block normal flow.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

type HookInput = {
  session_id?: string;
  tool_name?: string;
  tool_input?: { command?: string };
  tool_response?: {
    output?: string;
    interrupted?: boolean;
    isError?: boolean;
  };
};

type Signal = { aspect: string; score: number; reason: string };

const TEST_RUNNER_RE = /\b(bun test|jest|vitest|pytest|playwright|uv run pytest|cargo test|go test)\b/;
const DEV_ENV_TOOL_RE = /^(?:command not found|.*: command not found|env: '[^']+': No such file or directory)/im;
const PUSH_REJECTED_RE = /(rejected|non-fast-forward|failed to push)/i;
const TIMEOUT_RE = /\b(timed? ?out|deadline exceeded|operation timed out)\b/i;
const SLOW_TEST_RE = /(?:Slowest test took|tests took \d{2,}m|Ran \d+ tests across \d+ files\.\s*\[\s*(\d{4,})ms)/i;

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

function detectSignals(command: string, output: string, isError: boolean): Signal[] {
  const signals: Signal[] = [];
  if (!isError && !TIMEOUT_RE.test(output)) {
    // Successful runs: only emit a slow-test signal if applicable.
    const slow = output.match(SLOW_TEST_RE);
    if (slow && slow[1] && parseInt(slow[1], 10) > 30_000) {
      signals.push({
        aspect: "friction_running_tests",
        score: 60,
        reason: `slow tests (>${Math.round(parseInt(slow[1], 10) / 1000)}s)`,
      });
    }
    return signals;
  }

  // Failure / interrupted path.
  if (TEST_RUNNER_RE.test(command)) {
    signals.push({
      aspect: "friction_running_tests",
      score: 75,
      reason: `test command failed: ${shortCmd(command)}`,
    });
  }
  if (/\bgit push\b/.test(command) && PUSH_REJECTED_RE.test(output)) {
    signals.push({
      aspect: "friction_claude_devenv",
      score: 65,
      reason: "push rejected (likely diverged or autosync race)",
    });
  }
  if (DEV_ENV_TOOL_RE.test(output)) {
    signals.push({
      aspect: "friction_claude_devenv",
      score: 70,
      reason: `missing tool: ${output.match(DEV_ENV_TOOL_RE)?.[0]?.slice(0, 80) ?? "n/a"}`,
    });
  }
  if (TIMEOUT_RE.test(output)) {
    signals.push({
      aspect: "friction_claude_infra",
      score: 60,
      reason: "command timed out",
    });
  }
  return signals;
}

function shortCmd(cmd: string): string {
  const single = cmd.replace(/\s+/g, " ").trim();
  return single.length > 60 ? `${single.slice(0, 59)}…` : single;
}

async function main() {
  const payload = await readStdinJson<HookInput>();
  if (!payload || payload.tool_name !== "Bash") return process.exit(0);
  const sessionId = payload.session_id ?? process.env.CLAUDE_SESSION_ID;
  if (!sessionId) return process.exit(0);

  const command = payload.tool_input?.command ?? "";
  const output = payload.tool_response?.output ?? "";
  const isError =
    payload.tool_response?.isError === true || payload.tool_response?.interrupted === true;

  const signals = detectSignals(command, output, isError);
  if (signals.length === 0) return process.exit(0);

  // Aggregate signals into a single submission.
  const dxBin = join(process.cwd(), "tools", "bin", "dx");
  const args = [
    "his",
    "rate",
    "--as=claude",
    "--trigger=auto",
    "--session-id",
    sessionId,
    "--note",
    `auto-detected friction: ${signals.map((s) => s.reason).join(" | ")}`,
    ...signals.map((s) => `${s.aspect}=${s.score}`),
  ];
  spawnSync(dxBin, args, {
    stdio: "ignore",
    env: { ...process.env, DX_OUTPUT: "json", DX_HIS_QUIET: "1" },
  });
  process.exit(0);
}

main().catch(() => process.exit(0));
