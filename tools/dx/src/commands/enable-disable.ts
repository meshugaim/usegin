/**
 * dx enable <feature> / dx disable <feature> — toggle features on or off.
 *
 * Exports pure functions for writing overrides and formatting output,
 * plus Commander command builders.
 *
 * Part of: ENG-3443
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { spawnSync } from "child_process";
import { dxShouldOutputJson } from "../output";
import { resolveUser, allFeatures } from "../core";
import { buildSyncEntries } from "./sync";
import dx from "../../sdk";

/**
 * Synchronously reads/writes a local override to `.dx/config.local.json`.
 *
 * Reads the file (creates if missing), sets `overrides[feature] = enabled`,
 * and writes back to disk. Uses `readFileSync`/`writeFileSync`/`mkdirSync`.
 */
export function writeLocalOverride(
  localPath: string,
  feature: string,
  enabled: boolean,
): void {
  let data: { overrides: Record<string, boolean> };

  if (existsSync(localPath)) {
    // File exists — read and parse (throws on corrupted JSON)
    const raw = readFileSync(localPath, "utf-8");
    data = JSON.parse(raw);
    if (!data.overrides) {
      data.overrides = {};
    }
  } else {
    // File doesn't exist — create with empty overrides
    data = { overrides: {} };
  }

  data.overrides[feature] = enabled;

  // Ensure parent directory exists
  mkdirSync(dirname(localPath), { recursive: true });

  writeFileSync(localPath, JSON.stringify(data, null, 2) + "\n");
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
  configPath: string,
  user: string,
  feature: string,
  enabled: boolean,
): void {
  // config.json must exist — it's committed to the repo
  const raw = readFileSync(configPath, "utf-8");
  const data = JSON.parse(raw);

  if (!data.users) {
    data.users = {};
  }

  if (!data.users[user]) {
    data.users[user] = { aliases: [], overrides: {} };
  }

  if (!data.users[user].overrides) {
    data.users[user].overrides = {};
  }

  data.users[user].overrides[feature] = enabled;

  writeFileSync(configPath, JSON.stringify(data, null, 2) + "\n");
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
  feature: string,
  enabled: boolean,
  saved: boolean,
  user: string | null,
): string {
  const state = enabled ? "enabled" : "disabled";
  const action = enabled ? "enable" : "disable";

  if (saved) {
    return `dx: ${feature} ${state} for ${user} (saved to config.json)`;
  }

  return (
    `dx: ${feature} ${state} (local)\n` +
    `    To persist across environments: dx ${action} ${feature} --save`
  );
}

/**
 * Format the result of an enable/disable operation as JSON.
 *
 * Returns a JSON string like:
 * `{"feature":"ci-watcher","enabled":false,"target":"local"}`
 */
export function formatEnableDisableResultJson(
  feature: string,
  enabled: boolean,
  saved: boolean,
  _user: string | null,
): string {
  return JSON.stringify(
    {
      feature,
      enabled,
      target: saved ? "config" : "local",
    },
    null,
    2,
  );
}

/**
 * Re-resolve all features and sync their values to git config.
 *
 * Called automatically after enable/disable writes so that
 * `git config dx.<feature>` stays in sync without a manual `dx sync`.
 */
function autoSync(): void {
  dx.reload();
  const ctx = dx.getContext();
  const features = allFeatures(ctx);
  const entries = buildSyncEntries(features);

  for (const entry of entries) {
    spawnSync(
      "git",
      ["config", "--local", `dx.${entry.key}`, String(entry.value)],
      { encoding: "utf-8" },
    );
  }
}

/**
 * Build the `dx enable` Commander command.
 */
export function buildEnableCommand(): Command {
  const cmd = new Command("enable")
    .description("Enable a feature")
    .argument("<feature>", "Feature name to enable")
    .option("--save", "Persist to config.json (user override)")
    .option("--json", "Output as JSON");

  cmd.action((feature: string, opts: { save?: boolean; json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const ctx = dx.getContext();
    const user = resolveUser(ctx);

    let saved = false;

    if (opts.save) {
      if (user) {
        if (!ctx.configPath) {
          throw new Error("dx: configPath not set in context — cannot --save");
        }
        writeUserOverride(ctx.configPath, user, feature, true);
        saved = true;
      } else {
        // --save requires a known user; fall back to local with a warning
        process.stderr.write(
          "dx: cannot --save: user not identified. Run `dx identify` first.\n",
        );
        process.stderr.write("dx: writing to local config instead.\n");
      }
    }

    if (!saved) {
      const localPath = ctx.localPath ?? ".dx/config.local.json";
      writeLocalOverride(localPath, feature, true);
    }

    // Auto-sync to git config so `git config dx.<feature>` stays current
    autoSync();

    if (useJson) {
      process.stdout.write(
        formatEnableDisableResultJson(feature, true, saved, user) + "\n",
      );
    } else {
      process.stderr.write(
        formatEnableDisableResult(feature, true, saved, user) + "\n",
      );
    }
  });

  return cmd;
}

/**
 * Build the `dx disable` Commander command.
 */
export function buildDisableCommand(): Command {
  const cmd = new Command("disable")
    .description("Disable a feature")
    .argument("<feature>", "Feature name to disable")
    .option("--save", "Persist to config.json (user override)")
    .option("--json", "Output as JSON");

  cmd.action((feature: string, opts: { save?: boolean; json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const ctx = dx.getContext();
    const user = resolveUser(ctx);

    let saved = false;

    if (opts.save) {
      if (user) {
        if (!ctx.configPath) {
          throw new Error("dx: configPath not set in context — cannot --save");
        }
        writeUserOverride(ctx.configPath, user, feature, false);
        saved = true;
      } else {
        // --save requires a known user; fall back to local with a warning
        process.stderr.write(
          "dx: cannot --save: user not identified. Run `dx identify` first.\n",
        );
        process.stderr.write("dx: writing to local config instead.\n");
      }
    }

    if (!saved) {
      const localPath = ctx.localPath ?? ".dx/config.local.json";
      writeLocalOverride(localPath, feature, false);
    }

    // Auto-sync to git config so `git config dx.<feature>` stays current
    autoSync();

    if (useJson) {
      process.stdout.write(
        formatEnableDisableResultJson(feature, false, saved, user) + "\n",
      );
    } else {
      process.stderr.write(
        formatEnableDisableResult(feature, false, saved, user) + "\n",
      );
    }
  });

  return cmd;
}
