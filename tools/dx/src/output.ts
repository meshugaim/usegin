/**
 * dx output helpers — shared output-mode detection for all dx commands.
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
