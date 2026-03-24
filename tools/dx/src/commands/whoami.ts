/**
 * dx whoami — show resolved identity.
 *
 * Exports pure formatting functions and a Commander command builder.
 *
 * Part of: ENG-3442
 */

import type { Command } from "commander";

/** The signal that matched during user resolution. */
export type IdentitySignal =
  | "DX_USER"
  | "GITHUB_USER"
  | "USER"
  | "whoami"
  | "gitUserName"
  | "gitUserEmail";

/** How the signal was matched. */
export type IdentityMatch = "exact" | "alias";

/** Result of identity resolution with provenance. */
export interface IdentityInfo {
  user: string | null;
  signal: IdentitySignal | null;
  match: IdentityMatch | null;
}

/**
 * Format the whoami output for human display.
 *
 * Example: "User: nitsan (via $USER -> alias match)"
 */
export function formatWhoami(_info: IdentityInfo): string {
  throw new Error("Not implemented");
}

/**
 * Format the whoami output as JSON.
 *
 * Returns `{"user":"nitsan","signal":"USER","match":"alias"}`
 */
export function formatWhoamiJson(_info: IdentityInfo): string {
  throw new Error("Not implemented");
}

/**
 * Build the `dx whoami` Commander command.
 */
export function buildWhoamiCommand(): Command {
  throw new Error("Not implemented");
}
