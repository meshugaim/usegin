/**
 * dx list — show all registered features with gate counts.
 *
 * Exports pure functions for building and formatting the list,
 * plus a Commander command builder.
 *
 * Part of: ENG-3443
 */

import { Command } from "commander";
import type { DxContext } from "../core";

/** A single entry in the feature list. */
export interface ListEntry {
  feature: string;
  description: string;
  gateCount: number;
  warning: string | null;
}

/**
 * Build list data from feature config and grep results.
 *
 * Takes the DxContext (for feature definitions) and a map of
 * feature name → gate count (from grepping the codebase).
 * Returns entries with warning flags for 0 gates or >1 gates.
 */
export function buildListData(
  _ctx: DxContext,
  _grepResults: Record<string, number>,
): ListEntry[] {
  throw new Error("Not implemented");
}

/**
 * Format the list entries as a human-readable table.
 *
 * Includes gate counts and warning markers:
 * - 0 gates: "registered but not gated"
 * - >1 gates: "multiple gate points"
 */
export function formatList(_entries: ListEntry[]): string {
  throw new Error("Not implemented");
}

/**
 * Format the list entries as a JSON array.
 *
 * Returns a JSON string of the entries array.
 */
export function formatListJson(_entries: ListEntry[]): string {
  throw new Error("Not implemented");
}

/**
 * Build the `dx list` Commander command.
 */
export function buildListCommand(): Command {
  throw new Error("Not implemented");
}
