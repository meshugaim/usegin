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
import type { FeatureValue } from "../core";
import { dxShouldOutputJson } from "../output";
import { autoSync } from "./sync";
import { resolveWriteTarget, warnUnregisteredFeature } from "./write-target";
import dx from "../../sdk";

/**
 * Synchronously reads/writes a local override to `.dx/config.local.json`.
 *
 * Reads the file (creates if missing), sets `overrides[feature] = value`,
 * and writes back to disk. Uses `readFileSync`/`writeFileSync`/`mkdirSync`.
 *
 * Accepts any `FeatureValue` (boolean, string, or number) so that both
 * `dx enable/disable` (boolean) and `dx set` (typed) share a single path.
 */
export function writeLocalOverride(
  localPath: string,
  feature: string,
  value: FeatureValue,
): void {
  let data: { overrides: Record<string, FeatureValue> };

  if (existsSync(localPath)) {
    // File exists — read and parse (throws on corrupted JSON)
    const raw = readFileSync(localPath, "utf-8");
    data = JSON.parse(raw);
    if (typeof data.overrides !== "object" || data.overrides === null) {
      data.overrides = {};
    }
  } else {
    // File doesn't exist — create with empty overrides
    data = { overrides: {} };
    // Ensure parent directory exists (only needed when creating the file)
    mkdirSync(dirname(localPath), { recursive: true });
  }

  data.overrides[feature] = value;

  writeFileSync(localPath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Synchronously reads/writes a user override to `.dx/config.json`.
 *
 * Reads the file, sets `users[user].overrides[feature] = value`,
 * creates the user entry if it doesn't exist, and writes back to disk.
 * Uses `readFileSync`/`writeFileSync`. Throws if the file does not exist
 * (config.json should always be committed to the repo).
 *
 * Accepts any `FeatureValue` (boolean, string, or number) so that both
 * `dx enable/disable` (boolean) and `dx set` (typed) share a single path.
 */
export function writeUserOverride(
  configPath: string,
  user: string,
  feature: string,
  value: FeatureValue,
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

  data.users[user].overrides[feature] = value;

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
    if (user) {
      return `dx: ${feature} ${state} for ${user} (saved to config.json)`;
    }
    return `dx: ${feature} ${state} (saved to config.json)`;
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
 *
 * When target is "config" and a user is known, includes the `user` field.
 */
export function formatEnableDisableResultJson(
  feature: string,
  enabled: boolean,
  saved: boolean,
  user: string | null,
): string {
  return JSON.stringify(
    {
      feature,
      enabled,
      target: saved ? "config" : "local",
      ...(saved && user ? { user } : {}),
    },
    null,
    2,
  );
}

/**
 * Factory for building `dx enable` and `dx disable` Commander commands.
 *
 * Both commands share identical structure — the only differences are
 * the command name, description, and the boolean value written.
 */
function buildToggleCommand(name: "enable" | "disable", enabled: boolean): Command {
  const cmd = new Command(name)
    .description(`${name === "enable" ? "Enable" : "Disable"} a feature`)
    .argument("<feature>", `Feature name to ${name}`)
    .option("--save", "Persist to config.json (user override)")
    .option("--json", "Output as JSON");

  cmd.action((feature: string, opts: { save?: boolean; json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const ctx = dx.getContext();

    warnUnregisteredFeature(feature, ctx);

    const { saved, user, localPath } = resolveWriteTarget(ctx, !!opts.save);

    if (saved) {
      writeUserOverride(ctx.configPath!, user!, feature, enabled);
    } else {
      writeLocalOverride(localPath, feature, enabled);
    }

    autoSync();

    if (useJson) {
      process.stdout.write(
        formatEnableDisableResultJson(feature, enabled, saved, user) + "\n",
      );
    } else {
      process.stderr.write(
        formatEnableDisableResult(feature, enabled, saved, user) + "\n",
      );
    }
  });

  return cmd;
}

/**
 * Build the `dx enable` Commander command.
 */
export function buildEnableCommand(): Command {
  return buildToggleCommand("enable", true);
}

/**
 * Build the `dx disable` Commander command.
 */
export function buildDisableCommand(): Command {
  return buildToggleCommand("disable", false);
}
