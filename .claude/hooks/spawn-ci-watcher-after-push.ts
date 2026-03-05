#!/usr/bin/env bun
/**
 * Claude Code PostToolUse hook: Spawn ci-watcher after successful git push to main.
 *
 * After any successful `git push` targeting main, spawns ci-watcher in a
 * detached tmux session to poll GitHub Actions and auto-investigate failures.
 *
 * Requirements:
 * - tmux (must be in a tmux session)
 * - tools/bin/ci-watcher in the repo
 * - gh CLI authenticated
 *
 * Exits 0 always — never blocks the tool result. CI watching is best-effort.
 */

import { $ } from "bun";

interface PostToolInput {
  tool_name: string;
  tool_input: {
    command?: string;
  };
  tool_response?: {
    stdout?: string;
    stderr?: string;
    interrupted?: boolean;
  };
}

const GIT_PUSH = /\bgit\s+push\b/;

async function pushTargetsMain(command: string): Promise<boolean> {
  if (/\bgit\s+push\b.*\bmain\b/.test(command)) {
    return true;
  }

  // Bare push or push to origin without explicit refspec — targets main if on main
  const branch = await $`git branch --show-current`.quiet().nothrow();
  if (branch.exitCode !== 0) return false;
  return branch.stdout.toString().trim() === "main";
}

async function main() {
  const input = await Bun.stdin.text();

  let toolInput: PostToolInput;
  try {
    toolInput = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  if (toolInput.tool_name !== "Bash") process.exit(0);

  const command = toolInput.tool_input.command;
  if (!command || !GIT_PUSH.test(command)) process.exit(0);

  // PostToolUse only fires for successful tool calls, and tool_response
  // does not include exit_code — it has stdout/stderr/interrupted.
  // If interrupted, skip.
  if (toolInput.tool_response?.interrupted) process.exit(0);

  if (!(await pushTargetsMain(command))) process.exit(0);

  // Need tmux
  if (!process.env.TMUX) {
    console.error("ci-watcher: skipped — not in tmux");
    process.exit(0);
  }

  // Resolve ci-watcher path relative to repo root
  const repoRoot = await $`git rev-parse --show-toplevel`.quiet().nothrow();
  if (repoRoot.exitCode !== 0) process.exit(0);
  const ciWatcher = `${repoRoot.stdout.toString().trim()}/tools/bin/ci-watcher`;
  const exists = await Bun.file(ciWatcher).exists();
  if (!exists) {
    console.error("ci-watcher: skipped — tools/bin/ci-watcher not found");
    process.exit(0);
  }

  // Get HEAD sha (what was just pushed)
  const shaResult = await $`git rev-parse HEAD`.quiet().nothrow();
  if (shaResult.exitCode !== 0) process.exit(0);
  const sha = shaResult.stdout.toString().trim();
  const shortSha = sha.slice(0, 8);

  // Don't double-spawn
  const existing = await $`tmux has-session -t ci-watch-${shortSha}`.quiet().nothrow();
  if (existing.exitCode === 0) {
    console.error(`ci-watcher: already running for ${shortSha}`);
    process.exit(0);
  }

  // Get parent tmux session name
  const sessionResult = await $`tmux display-message -p "#S"`.quiet().nothrow();
  const mainSession = sessionResult.exitCode === 0
    ? sessionResult.stdout.toString().trim()
    : "0";

  // Spawn in detached tmux session
  const result = await $`tmux new-session -d -s ci-watch-${shortSha} -e TMUX_PARENT_SESSION=${mainSession} ${ciWatcher} ${sha}`.quiet().nothrow();
  if (result.exitCode === 0) {
    console.error(`ci-watcher: started for ${shortSha}`);
  }

  process.exit(0);
}

main();
