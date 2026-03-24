/**
 * dx sync — write resolved feature values to git config.
 *
 * Exports a pure function to build sync entries and a Commander command builder.
 *
 * Part of: ENG-3442
 */

import type { Command } from "commander";
import type { FeatureInfo } from "../core";

/** A single entry to write to git config. */
export interface SyncEntry {
  key: string;
  value: boolean;
}

/**
 * Build the list of git config entries to write.
 *
 * Each entry maps `dx.<feature>` to the resolved boolean value.
 * Also serves as the dry-run output: callers can display these entries
 * instead of writing them to show what *would* be synced.
 */
export function buildSyncEntries(
  _features: Record<string, FeatureInfo>,
): SyncEntry[] {
  throw new Error("Not implemented");
}

/**
 * Build the `dx sync` Commander command.
 *
 * Options:
 *   --dry-run   Show what would be synced without writing to git config
 */
export function buildSyncCommand(): Command {
  throw new Error("Not implemented");
}
