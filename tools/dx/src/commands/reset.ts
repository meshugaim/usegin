/**
 * dx reset [feature] — clear overrides, returning features to their defaults.
 *
 * Exports pure functions for clearing overrides and formatting output,
 * plus a Commander command builder.
 *
 * Part of: ENG-3465, ENG-4687
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dxShouldOutputJson } from "../output";
import { autoSync } from "./sync";
import { resolveWriteTarget, warnUnregisteredFeature } from "./write-target";
import dx from "../../sdk";

// ---------------------------------------------------------------------------
// Pure functions (layer 1)
// ---------------------------------------------------------------------------

/**
 * Clear a single local override from `.dx/config.local.json`.
 *
 * Reads the file, deletes `overrides[feature]`, and writes back.
 * The file must exist (callers invoke this when local overrides are known).
 * If the key doesn't exist, this is a no-op (file is still rewritten).
 */
export function clearLocalOverride(localPath: string, feature: string): void {
  if (!existsSync(localPath)) {
    return; // Nothing to clear
  }

  const raw = readFileSync(localPath, "utf-8");
  const data = JSON.parse(raw);

  if (typeof data.overrides === "object" && data.overrides !== null) {
    delete data.overrides[feature];
  }

  writeFileSync(localPath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Clear all local overrides from `.dx/config.local.json`.
 *
 * If the file exists, sets `overrides` to `{}` and writes back.
 * If the file doesn't exist, this is a no-op (doesn't throw).
 */
export function clearAllLocalOverrides(localPath: string): void {
  if (!existsSync(localPath)) {
    return;
  }

  const raw = readFileSync(localPath, "utf-8");
  const data = JSON.parse(raw);
  data.overrides = {};

  writeFileSync(localPath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Clear a single user override from `.dx/config.json`.
 *
 * Reads config.json, deletes `users[user].overrides[feature]`, writes back.
 * Throws if the user doesn't exist in config.
 * No-op if the key doesn't exist (doesn't throw).
 */
export function clearUserOverride(
  configPath: string,
  user: string,
  feature: string,
): void {
  const raw = readFileSync(configPath, "utf-8");
  const data = JSON.parse(raw);

  if (!data.users || !data.users[user]) {
    throw new Error(`dx: user "${user}" not found in config`);
  }

  if (data.users[user].overrides) {
    delete data.users[user].overrides[feature];
  }

  writeFileSync(configPath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Clear all overrides for a user in `.dx/config.json`.
 *
 * Reads config.json, sets `users[user].overrides` to `{}`, writes back.
 * Throws if the user doesn't exist in config.
 * Preserves other user fields (aliases, etc.).
 */
export function clearAllUserOverrides(
  configPath: string,
  user: string,
): void {
  const raw = readFileSync(configPath, "utf-8");
  const data = JSON.parse(raw);

  if (!data.users || !data.users[user]) {
    throw new Error(`dx: user "${user}" not found in config`);
  }

  data.users[user].overrides = {};

  writeFileSync(configPath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Format the result of a reset operation for human display.
 *
 * Examples:
 * - `"dx: reset to defaults (local)"`
 * - `"dx: reset ci-watcher to default (local)"`
 * - `"dx: reset to defaults for nitsan (saved)"`
 * - `"dx: reset ci-watcher to default for nitsan (saved)"`
 */
export function formatResetResult(
  feature: string | null,
  saved: boolean,
  user: string | null,
): string {
  const what = feature ? `${feature} to default` : "to defaults";
  const who = saved && user ? ` for ${user}` : "";
  const where = saved ? "(saved)" : "(local)";

  const line = `dx: reset ${what}${who} ${where}`;

  if (!saved) {
    const resetArg = feature ? `${feature} ` : "";
    return (
      line + "\n" +
      `    To persist across environments: dx reset ${resetArg}--save`
    );
  }

  return line;
}

/**
 * Format the result of a reset operation as JSON.
 *
 * Returns a JSON string with `{feature, target, user?}`.
 * - `feature` is the feature name, or `"*"` when all features are reset.
 * - `target` is `"local"` or `"config"` based on `saved`.
 * - `user` is included only when saved AND user is non-null.
 */
export function formatResetResultJson(
  feature: string | null,
  saved: boolean,
  user: string | null,
): string {
  return JSON.stringify(
    {
      feature: feature ?? "*",
      target: saved ? "config" : "local",
      ...(saved && user ? { user } : {}),
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Commander builder (layer 2)
// ---------------------------------------------------------------------------

/**
 * Build the `dx reset` Commander command.
 *
 * Clears feature overrides, returning them to their configured defaults.
 * Without `--save`, clears local overrides. With `--save`, clears user
 * overrides in config.json.
 *
 * Options:
 *   --save   Clear overrides from config.json (user override) instead of local
 *   --json   Output as JSON
 */
export function buildResetCommand(): Command {
  const cmd = new Command("reset")
    .description("Reset features to defaults by clearing overrides")
    .argument("[feature]", "Feature name to reset (omit to reset all)")
    .option("--save", "Clear overrides from config.json (user override)")
    .option("--json", "Output as JSON");

  cmd.action((feature: string | undefined, opts: { save?: boolean; json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const ctx = dx.getContext();

    if (feature) {
      warnUnregisteredFeature(feature, ctx);
    }

    const target = resolveWriteTarget(ctx, !!opts.save, {
      fallbackMessage: "dx: resetting local overrides instead.",
    });

    if (target.saved) {
      if (feature) {
        clearUserOverride(target.configPath, target.user, feature);
      } else {
        clearAllUserOverrides(target.configPath, target.user);
      }
    } else {
      if (feature) {
        clearLocalOverride(target.localPath, feature);
      } else {
        clearAllLocalOverrides(target.localPath);
      }
    }

    autoSync();

    if (useJson) {
      process.stdout.write(
        formatResetResultJson(feature ?? null, target.saved, target.user) + "\n",
      );
    } else {
      process.stderr.write(
        formatResetResult(feature ?? null, target.saved, target.user) + "\n",
      );
    }
  });

  return cmd;
}
