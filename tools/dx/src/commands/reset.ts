/**
 * dx reset [feature] — clear overrides, returning features to their defaults.
 *
 * Exports pure functions for clearing overrides and formatting output,
 * plus a Commander command builder.
 *
 * Part of: ENG-3465
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { dxShouldOutputJson } from "../output";
import { resolveUser } from "../core";
import { autoSync } from "./sync";
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

  return `dx: reset ${what}${who} ${where}`;
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
    const user = resolveUser(ctx);

    let saved = false;

    if (opts.save) {
      if (user) {
        if (!ctx.configPath) {
          throw new Error("dx: configPath not set in context — cannot --save");
        }
        if (feature) {
          clearUserOverride(ctx.configPath, user, feature);
        } else {
          clearAllUserOverrides(ctx.configPath, user);
        }
        saved = true;
      } else {
        // --save requires a known user; fall back to local with a warning
        process.stderr.write(
          "dx: cannot --save: user not identified. Run `dx identify` first.\n",
        );
        process.stderr.write("dx: clearing local config instead.\n");
      }
    }

    if (!saved) {
      const localPath =
        ctx.localPath ??
        (ctx.configPath
          ? resolve(dirname(ctx.configPath), "config.local.json")
          : null);
      if (!localPath) throw new Error("dx: cannot determine local config path");

      if (feature) {
        clearLocalOverride(localPath, feature);
      } else {
        clearAllLocalOverrides(localPath);
      }
    }

    // Auto-sync to git config so `git config dx.<feature>` stays current
    autoSync();

    if (useJson) {
      process.stdout.write(
        formatResetResultJson(feature ?? null, saved, user) + "\n",
      );
    } else {
      process.stderr.write(
        formatResetResult(feature ?? null, saved, user) + "\n",
      );
    }
  });

  return cmd;
}
