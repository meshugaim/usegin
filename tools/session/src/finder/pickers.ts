/**
 * Session picker UI - tmux popup and VS Code terminal integration.
 *
 * This module handles launching interactive session pickers via tmux popup
 * or VS Code terminal, and polling for results.
 */

import { homedir } from "os";
import {
  TmuxNotAvailableError,
  NoPickerMethodError,
} from "../errors";
import type {
  SessionInfo,
  TmuxPopupOptions,
  VscCommandOptions,
  SessionPickerOptions,
  SessionPickerResult,
  OutputFileData,
  PollOptions,
  PickerMethod,
} from "./types";

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Check if we're running inside tmux.
 */
export async function isTmuxAvailable(): Promise<boolean> {
  // Check TMUX env var - set when running inside tmux
  return !!process.env.TMUX;
}

/**
 * Check if vsc-bridge extension is available and responding.
 */
export async function isVscBridgeAvailable(
  portFilePath?: string
): Promise<boolean> {
  const portFile = portFilePath ?? `${homedir()}/.vsc-bridge.port`;

  try {
    const file = Bun.file(portFile);
    if (!(await file.exists())) {
      return false;
    }

    const port = (await file.text()).trim();
    const res = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Detect which picker method is available.
 * Priority: tmux > vsc > null
 */
export async function detectPickerMethod(
  vscPortFilePath?: string
): Promise<"tmux" | "vsc" | null> {
  // 1. Check tmux first (preferred)
  if (process.env.TMUX) {
    return "tmux";
  }

  // 2. Check vsc-bridge
  if (await isVscBridgeAvailable(vscPortFilePath)) {
    return "vsc";
  }

  return null;
}

// =============================================================================
// OUTPUT FILE UTILITIES
// =============================================================================

/**
 * Generate a unique temp file path for session reference output.
 */
export function generateOutputFilePath(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `/tmp/claude-session-ref-${timestamp}-${random}.json`;
}

/**
 * Write session info to a JSON file for external consumption (e.g., from Claude via tmux).
 */
export async function writeOutputFile(
  session: SessionInfo,
  outputPath: string,
  summary?: string | null
): Promise<void> {
  const data: OutputFileData = {
    path: session.path,
    id: session.id,
    date: session.mtime.toISOString(),
    project: session.project,
    summary: summary ?? null,
  };

  await Bun.write(outputPath, JSON.stringify(data, null, 2));
}

/**
 * Poll for a file to exist and return its parsed JSON contents.
 * Returns null if timeout reached.
 */
export async function pollForFile<T = unknown>(
  filePath: string,
  options: PollOptions = {}
): Promise<T | null> {
  const { intervalMs = 100, timeoutMs = 60000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const content = await file.text();
        return JSON.parse(content) as T;
      }
    } catch {
      // File doesn't exist or couldn't be read, keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

// =============================================================================
// PICKER COMMAND BUILDING
// =============================================================================

/**
 * Build a tmux popup command to launch session finder.
 * The popup will write selection to outputFile for external consumption.
 */
export function buildTmuxPopupCommand(
  outputFile: string,
  options: TmuxPopupOptions = {}
): string {
  const { width = "80%", height = "80%", allProjects, since } = options;

  // Build the session-finder command
  const cliPath = new URL("../cli.ts", import.meta.url).pathname;
  const findArgs = ["find", "--output-file", outputFile];

  if (allProjects) {
    findArgs.push("--all-projects");
  }
  if (since) {
    findArgs.push("--since", since);
  }

  const findCmd = `bun ${cliPath} ${findArgs.join(" ")}`;

  // Build tmux popup command
  // -E: close popup when command exits
  // -w/-h: width/height
  return `tmux popup -E -w ${width} -h ${height} "${findCmd}"`;
}

/**
 * Build a vsc terminal create command to launch session finder.
 * The terminal will write selection to outputFile for external consumption.
 */
export function buildVscCommand(
  outputFile: string,
  options: VscCommandOptions = {}
): string {
  const { allProjects, since } = options;

  // Build the session-finder command
  const cliPath = new URL("../cli.ts", import.meta.url).pathname;
  const findArgs = ["find", "--output-file", outputFile];

  if (allProjects) {
    findArgs.push("--all-projects");
  }
  if (since) {
    findArgs.push("--since", since);
  }

  const findCmd = `bun ${cliPath} ${findArgs.join(" ")}`;

  // Build vsc terminal create command with --shellCmd for auto-close
  // Use full path to vsc since it may not be on PATH
  // Add timestamp to name to avoid reusing existing terminal
  const vscPath = new URL("../../../vsc-bridge/bin/vsc", import.meta.url).pathname;
  const timestamp = Date.now();
  return `${vscPath} terminal create --shellCmd --name "Session Picker ${timestamp}" "${findCmd}"`;
}

// =============================================================================
// SESSION PICKER
// =============================================================================

/**
 * Open session picker and return selected session.
 *
 * This is the main entry point for Claude to use when referencing previous sessions.
 * It:
 * 1. Detects available picker method (tmux or vsc)
 * 2. Opens picker UI (tmux popup or VS Code terminal)
 * 3. Polls for user selection
 * 4. Returns the selected session info
 *
 * @throws Error if no picker method available
 */
export async function openSessionPicker(
  options: SessionPickerOptions = {}
): Promise<SessionPickerResult | null> {
  const { allProjects, since, timeoutMs = 120000, method = "auto" } = options;

  // Determine which method to use
  let resolvedMethod: "tmux" | "vsc";

  if (method === "auto") {
    const detected = await detectPickerMethod();
    if (!detected) {
      throw new NoPickerMethodError();
    }
    resolvedMethod = detected;
  } else if (method === "tmux") {
    if (!(await isTmuxAvailable())) {
      throw new TmuxNotAvailableError();
    }
    resolvedMethod = "tmux";
  } else if (method === "vsc") {
    if (!(await isVscBridgeAvailable())) {
      throw new Error("vsc-bridge not available. Check: vsc status");
    }
    resolvedMethod = "vsc";
  } else {
    throw new Error(`Unknown picker method: ${method}`);
  }

  // Generate unique output file
  const outputFile = generateOutputFilePath();

  // Build and run command based on method
  if (resolvedMethod === "tmux") {
    const popupCmd = buildTmuxPopupCommand(outputFile, { allProjects, since });

    // Run the popup (this returns immediately, popup runs in background)
    const proc = Bun.spawn(["sh", "-c", popupCmd], {
      stdout: "inherit",
      stderr: "inherit",
    });

    await proc.exited;
  } else {
    // vsc method - create terminal with session finder
    const vscCmd = buildVscCommand(outputFile, { allProjects, since });

    // Run vsc command to create terminal
    const proc = Bun.spawn(["sh", "-c", vscCmd], {
      stdout: "inherit",
      stderr: "inherit",
    });

    await proc.exited;
  }

  // Poll for result file
  const result = await pollForFile<SessionPickerResult>(outputFile, {
    intervalMs: 100,
    timeoutMs,
  });

  // Clean up temp file
  try {
    const fs = await import("node:fs/promises");
    await fs.unlink(outputFile);
  } catch {
    // Ignore cleanup errors
  }

  return result;
}
