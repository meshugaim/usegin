/**
 * dx status — show all features with resolved on/off state.
 *
 * Exports pure formatting functions and a Commander command builder.
 *
 * Part of: ENG-3442
 */

import type { Command } from "commander";
import type { FeatureInfo, DxConfig } from "../core";

/** Input shape for formatStatus. */
export interface StatusData {
  user: string | null;
  features: Record<string, FeatureInfo & { description: string }>;
  config: DxConfig;
}

/**
 * Format the status output for human display (TTY).
 *
 * Shows a table with override markers:
 * - `*` = user override (differs from default)
 * - `~` = local override (temporary)
 * - Shows "User: <name>" or "User: unknown"
 */
export function formatStatus(_data: StatusData): string {
  throw new Error("Not implemented");
}

/**
 * Format the status output as JSON (headless/--json).
 *
 * Returns `{ user, features: { [name]: { enabled, source, description } } }`
 */
export function formatStatusJson(_data: StatusData): string {
  throw new Error("Not implemented");
}

/**
 * Build the `dx status` Commander command.
 */
export function buildStatusCommand(): Command {
  throw new Error("Not implemented");
}
