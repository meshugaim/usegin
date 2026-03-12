/**
 * tmux-based session spawning for auto-implement.
 *
 * Spawns each Claude session in a named tmux pane so the operator can
 * `tmux attach -t auto-impl-N` to see the full TUI output.
 *
 * Falls back to the piped approach when tmux is unavailable.
 */

import { join } from "path";
import { mkdir } from "fs/promises";
import { tmpdir } from "os";

const TMUX_SESSION_PREFIX = "auto-impl";

/**
 * Check if tmux is available on the system.
 */
export async function isTmuxAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["tmux", "-V"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get the tmux session name for a given session number.
 */
export function getTmuxSessionName(sessionNumber: number): string {
  return `${TMUX_SESSION_PREFIX}-${sessionNumber}`;
}

interface TmuxSpawnOptions {
  prompt: string;
  sessionId: string;
  sessionNumber: number;
  /** Directory for stdout/signal capture files */
  runDir: string;
}

interface TmuxSpawnResult {
  exitCode: number;
  stdout: string;
}

/**
 * Spawn a Claude session inside a tmux session.
 *
 * Strategy:
 * 1. Write prompt to a temp file
 * 2. Write a wrapper script that:
 *    a. Runs `claude -p` with stdin from the prompt file
 *    b. Captures stdout to a file (for signal detection)
 *    c. Writes the exit code to a sentinel file when done
 * 3. Create a tmux session running the wrapper script
 * 4. Poll the sentinel file to detect completion
 * 5. Read captured stdout and exit code
 */
export async function spawnClaudeInTmux(
  options: TmuxSpawnOptions
): Promise<TmuxSpawnResult> {
  const { prompt, sessionId, sessionNumber, runDir } = options;

  const captureDir = join(runDir, `session-${sessionNumber}`);
  await mkdir(captureDir, { recursive: true });

  const promptFile = join(captureDir, "prompt.txt");
  const stdoutFile = join(captureDir, "stdout.txt");
  const exitCodeFile = join(captureDir, "exit_code");
  const wrapperScript = join(captureDir, "run.sh");

  // Write prompt to file
  await Bun.write(promptFile, prompt);

  // Build the claude command
  const claudeCmd = [
    "bun",
    "run",
    "--bun",
    "claude",
    "-p",
    "--dangerously-skip-permissions",
    "--session-id",
    sessionId,
  ].join(" ");

  // Write wrapper script
  // The script runs Claude, captures stdout, and writes exit code on completion
  const script = `#!/bin/bash
set -euo pipefail

# Remove API key env vars to force OAuth
unset ANTHROPIC_API_KEY 2>/dev/null || true
unset CLAUDE_API_KEY 2>/dev/null || true

cd /workspaces/test-mvp

# Run claude with prompt from file, capture stdout, stream to terminal too
${claudeCmd} < "${promptFile}" 2>&1 | tee "${stdoutFile}"
EXIT_CODE=\${PIPESTATUS[0]}

# Write exit code as sentinel
echo "\$EXIT_CODE" > "${exitCodeFile}"
`;

  await Bun.write(wrapperScript, script);
  // Make executable
  const chmodProc = Bun.spawn(["chmod", "+x", wrapperScript], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await chmodProc.exited;

  const tmuxName = getTmuxSessionName(sessionNumber);

  // Kill any existing tmux session with this name
  const killProc = Bun.spawn(["tmux", "kill-session", "-t", tmuxName], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await killProc.exited; // Ignore errors — may not exist

  // Create new tmux session running the wrapper script
  const createProc = Bun.spawn(
    [
      "tmux",
      "new-session",
      "-d",
      "-s",
      tmuxName,
      "-x",
      "220",
      "-y",
      "50",
      wrapperScript,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      cwd: "/workspaces/test-mvp",
    }
  );
  const createExitCode = await createProc.exited;
  if (createExitCode !== 0) {
    const stderr = await new Response(createProc.stderr).text();
    throw new Error(
      `Failed to create tmux session "${tmuxName}": ${stderr.trim()}`
    );
  }

  // Poll for completion (check for exit_code sentinel file)
  const exitCode = await pollForCompletion(exitCodeFile, tmuxName);

  // Read captured stdout
  let stdout = "";
  try {
    const file = Bun.file(stdoutFile);
    if (await file.exists()) {
      stdout = await file.text();
    }
  } catch {
    // stdout capture failed — not critical
  }

  return { exitCode, stdout };
}

/**
 * Poll for session completion by checking the sentinel file and tmux session status.
 */
async function pollForCompletion(
  exitCodeFile: string,
  tmuxName: string
): Promise<number> {
  const POLL_INTERVAL = 5_000; // 5 seconds

  while (true) {
    // Check if exit code file exists (session completed normally)
    try {
      const file = Bun.file(exitCodeFile);
      if (await file.exists()) {
        const content = await file.text();
        const code = parseInt(content.trim(), 10);
        return isNaN(code) ? 1 : code;
      }
    } catch {
      // Not ready yet
    }

    // Check if tmux session still exists (may have crashed without writing sentinel)
    const hasProc = Bun.spawn(["tmux", "has-session", "-t", tmuxName], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const hasExitCode = await hasProc.exited;
    if (hasExitCode !== 0) {
      // tmux session is gone but no exit code file — crashed
      // Check one more time for the file (race condition)
      try {
        const file = Bun.file(exitCodeFile);
        if (await file.exists()) {
          const content = await file.text();
          const code = parseInt(content.trim(), 10);
          return isNaN(code) ? 1 : code;
        }
      } catch {
        // Truly gone
      }
      return 1; // Assume failure
    }

    await Bun.sleep(POLL_INTERVAL);
  }
}
