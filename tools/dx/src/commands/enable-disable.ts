/**
 * dx enable <feature> / dx disable <feature> — toggle features on or off.
 *
 * Exports pure functions for writing overrides and formatting output,
 * plus Commander command builders.
 *
 * Part of: ENG-3443
 */

import { Command } from "commander";

/**
 * Synchronously reads/writes a local override to `.dx/config.local.json`.
 *
 * Reads the file (creates if missing), sets `overrides[feature] = enabled`,
 * and writes back to disk. Uses `readFileSync`/`writeFileSync`/`mkdirSync`.
 */
export function writeLocalOverride(
  _localPath: string,
  _feature: string,
  _enabled: boolean,
): void {
  throw new Error("Not implemented");
}

/**
 * Synchronously reads/writes a user override to `.dx/config.json`.
 *
 * Reads the file, sets `users[user].overrides[feature] = enabled`,
 * creates the user entry if it doesn't exist, and writes back to disk.
 * Uses `readFileSync`/`writeFileSync`. Throws if the file does not exist
 * (config.json should always be committed to the repo).
 */
export function writeUserOverride(
  _configPath: string,
  _user: string,
  _feature: string,
  _enabled: boolean,
): void {
  throw new Error("Not implemented");
}

/**
 * Format the result of an enable/disable operation for human display.
 *
 * Examples:
 * - "dx: ci-watcher disabled (local)"
 * - "dx: ci-watcher disabled for nitsan (saved to config.json)"
 * - Includes hint: "To persist across environments: dx disable ci-watcher --save"
 */
export function formatEnableDisableResult(
  _feature: string,
  _enabled: boolean,
  _saved: boolean,
  _user: string | null,
): string {
  throw new Error("Not implemented");
}

/**
 * Format the result of an enable/disable operation as JSON.
 *
 * Returns a JSON string like:
 * `{"feature":"ci-watcher","enabled":false,"target":"local"}`
 */
export function formatEnableDisableResultJson(
  _feature: string,
  _enabled: boolean,
  _saved: boolean,
  _user: string | null,
): string {
  throw new Error("Not implemented");
}

/**
 * Build the `dx enable` Commander command.
 */
export function buildEnableCommand(): Command {
  throw new Error("Not implemented");
}

/**
 * Build the `dx disable` Commander command.
 */
export function buildDisableCommand(): Command {
  throw new Error("Not implemented");
}
