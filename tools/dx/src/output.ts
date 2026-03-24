/**
 * dx output helpers — shared output-mode detection and formatting
 * utilities for all dx commands.
 *
 * Wraps the generic `shouldDefaultToJson` with dx-specific defaults
 * (env var name, process.env cast, TTY detection) so each command
 * doesn't repeat the same boilerplate.
 */

import { shouldDefaultToJson } from "../../lib/output-mode";

/**
 * Determine whether this dx command should output JSON.
 *
 * Centralizes the DX_OUTPUT env var name and process.env/TTY wiring
 * that every command needs identically.
 */
export function dxShouldOutputJson(opts?: { json?: boolean }): boolean {
  return shouldDefaultToJson({
    envVarName: "DX_OUTPUT",
    json: opts?.json,
    env: process.env as Record<string, string | undefined>,
    isTTY: process.stdout.isTTY ?? false,
  });
}

/**
 * Build a dot-fill string for aligning a name in a table column.
 *
 * Used by `status` and `list` commands to produce output like:
 *   ci-watcher .. on   Monitor CI
 *   autosync .... off  Auto push
 *
 * @param name       The item name (left column)
 * @param maxNameLen The longest name length in the table
 * @param minDots    Minimum number of dots (default 2)
 */
export function dotFill(name: string, maxNameLen: number, minDots = 2): string {
  const dotCount = maxNameLen - name.length + 2;
  return ".".repeat(Math.max(dotCount, minDots));
}
