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
import { dxShouldOutputJson } from "../output";
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
 * Write sync entries to git config.
 *
 * Returns a list of errors for any entries that failed to write.
 * Continues through all entries rather than aborting on first failure.
 */
export function writeSyncEntries(
  entries: SyncEntry[],
): Array<{ key: string; error: string }> {
  const errors: Array<{ key: string; error: string }> = [];

  for (const entry of entries) {
    const result = spawnSync(
      "git",
      ["config", "--local", `dx.${entry.key}`, String(entry.value)],
      { encoding: "utf-8" },
    );
    if (result.status !== 0) {
      errors.push({
        key: entry.key,
        error: result.stderr?.trim() ?? "unknown error",
      });
    }
  }

  return errors;
}

/**
 * Re-resolve all features and sync their values to git config.
 *
 * Called automatically after enable/disable writes and the interactive
 * picker so that `git config dx.<feature>` stays in sync without a
 * manual `dx sync`.
 *
 * Reports sync errors to stderr rather than throwing, matching the
 * error handling pattern in the sync command itself.
 */
export function autoSync(): void {
  dx.reload();
  const ctx = dx.getContext();
  const features = allFeatures(ctx);
  const entries = buildSyncEntries(features);
  const errors = writeSyncEntries(entries);

  for (const err of errors) {
    process.stderr.write(
      `dx: warning: failed to sync dx.${err.key}: ${err.error}\n`,
    );
  }
}

/**
 * Build the `dx sync` Commander command.
 *
 * Options:
 *   --dry-run   Show what would be synced without writing to git config
 *   --json      Output as JSON
 */
export function buildSyncCommand(): Command {
  const cmd = new Command("sync")
    .description("Write resolved feature values to git config")
    .option("--dry-run", "Show what would be synced without writing")
    .option("--json", "Output as JSON");

  cmd.action((opts: { dryRun?: boolean; json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const ctx = dx.getContext();
    const features = allFeatures(ctx);
    const entries = buildSyncEntries(features);

    if (opts.dryRun) {
      if (useJson) {
        process.stdout.write(JSON.stringify(entries, null, 2) + "\n");
      } else {
        for (const entry of entries) {
          process.stdout.write(
            `would write dx.${entry.key} = ${entry.value}\n`,
          );
        }
      }
      return;
    }

    // Write all features, collecting errors instead of aborting on first failure
    const errors = writeSyncEntries(entries);

    // Clean up legacy git config keys (migrated to dx)
    const legacyKeys = ["autosync.enabled", "autopull.enabled"];
    for (const key of legacyKeys) {
      spawnSync("git", ["config", "--local", "--unset", key], { encoding: "utf-8" });
      // Ignore errors — key may not exist
    }

    const syncedCount = entries.length - errors.length;

    if (useJson) {
      process.stdout.write(
        JSON.stringify(
          {
            synced: syncedCount,
            entries,
            ...(errors.length > 0 ? { errors } : {}),
          },
          null,
          2,
        ) + "\n",
      );
    } else {
      process.stderr.write(`Synced ${syncedCount} features to git config\n`);
    }

    if (errors.length > 0) {
      for (const err of errors) {
        process.stderr.write(
          `error: failed to write dx.${err.key}: ${err.error}\n`,
        );
      }
      process.exit(1);
    }
  });

  return cmd;
}
