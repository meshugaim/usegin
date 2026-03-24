/**
 * dx sync -- write resolved feature values to git config.
 *
 * Exports a pure function to build sync entries and a Commander command builder.
 *
 * Part of: ENG-3442
 */

import { Command } from "commander";
import { spawnSync } from "child_process";
import { allFeatures, type FeatureInfo } from "../core";
import dx from "../../sdk";

/** A single entry to write to git config. */
export interface SyncEntry {
  key: string;
  value: boolean;
}

/**
 * Build the list of git config entries to write.
 *
 * Each entry maps a feature name to its resolved boolean value.
 * Also serves as the dry-run output: callers can display these entries
 * instead of writing them to show what *would* be synced.
 */
export function buildSyncEntries(
  features: Record<string, FeatureInfo>,
): SyncEntry[] {
  return Object.entries(features).map(([name, info]) => ({
    key: name,
    value: info.enabled,
  }));
}

/**
 * Build the `dx sync` Commander command.
 *
 * Options:
 *   --dry-run   Show what would be synced without writing to git config
 */
export function buildSyncCommand(): Command {
  const cmd = new Command("sync")
    .description("Write resolved feature values to git config")
    .option("--dry-run", "Show what would be synced without writing");

  cmd.action((opts: { dryRun?: boolean }) => {
    const ctx = dx.getContext();
    const features = allFeatures(ctx);
    const entries = buildSyncEntries(features);

    if (opts.dryRun) {
      for (const entry of entries) {
        process.stdout.write(
          `would write dx.${entry.key} = ${entry.value}\n`,
        );
      }
      return;
    }

    for (const entry of entries) {
      const result = spawnSync(
        "git",
        ["config", "--local", `dx.${entry.key}`, String(entry.value)],
        { encoding: "utf-8" },
      );
      if (result.status !== 0) {
        process.stderr.write(
          `error: failed to write dx.${entry.key}: ${result.stderr?.trim() ?? "unknown error"}\n`,
        );
        process.exit(1);
      }
    }

    process.stderr.write(`Synced ${entries.length} features to git config\n`);
  });

  return cmd;
}
