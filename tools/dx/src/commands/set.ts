/**
 * dx set <feature> <value> -- set a feature to a typed value.
 *
 * Exports pure functions for parsing CLI values, writing typed overrides,
 * formatting output, and a Commander command builder.
 *
 * Part of: ENG-4687
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import type { FeatureValue } from "../core";
import { resolveUser } from "../core";
import { dxShouldOutputJson } from "../output";
import { autoSync } from "./sync";
import dx from "../../sdk";

/**
 * Auto-detect the type of a CLI value string.
 *
 * Rules (applied in order):
 * 1. "true"/"false" (case-insensitive) -> boolean
 * 2. Finite numbers (Number() is finite and input is non-empty) -> number
 * 3. Everything else -> string
 */
export function parseCliValue(raw: string): FeatureValue {
  // Boolean detection (case-insensitive)
  if (raw.toLowerCase() === "true") return true;
  if (raw.toLowerCase() === "false") return false;

  // Number detection: non-empty string that parses to a finite number
  if (raw !== "") {
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }

  // Everything else is a string
  return raw;
}

/**
 * Synchronously reads/writes a typed local override to `.dx/config.local.json`.
 *
 * Reads the file (creates if missing), sets `overrides[feature] = value`,
 * and writes back to disk. Follows the same pattern as `writeLocalOverride`
 * in enable-disable.ts but accepts any FeatureValue, not just boolean.
 */
export function writeTypedLocalOverride(
  localPath: string,
  feature: string,
  value: FeatureValue,
): void {
  let data: { overrides: Record<string, FeatureValue> };

  if (existsSync(localPath)) {
    // File exists -- read and parse (throws on corrupted JSON)
    const raw = readFileSync(localPath, "utf-8");
    data = JSON.parse(raw);
    if (typeof data.overrides !== "object" || data.overrides === null) {
      data.overrides = {};
    }
  } else {
    // File doesn't exist -- create with empty overrides
    data = { overrides: {} };
    // Ensure parent directory exists (only needed when creating the file)
    mkdirSync(dirname(localPath), { recursive: true });
  }

  data.overrides[feature] = value;

  writeFileSync(localPath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Synchronously reads/writes a typed user override to `.dx/config.json`.
 *
 * Reads the file, sets `users[user].overrides[feature] = value`,
 * creates the user entry if it doesn't exist, and writes back to disk.
 * Follows the same pattern as `writeUserOverride` in enable-disable.ts
 * but accepts any FeatureValue, not just boolean.
 */
export function writeTypedUserOverride(
  configPath: string,
  user: string,
  feature: string,
  value: FeatureValue,
): void {
  // config.json must exist -- it's committed to the repo
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
 * Format a value for human display in the set command output.
 *
 * Strings are quoted, booleans and numbers are shown as-is.
 */
function formatValue(value: FeatureValue): string {
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

/**
 * Format the result of a set operation for human display.
 *
 * Examples:
 * - 'dx: tips.show-duration = "5m" (local)'
 * - 'dx: tips.show-duration = "5m" for nitsan (saved to config.json)'
 * - Includes hint: "To persist across environments: dx set tips.show-duration 5m --save"
 */
export function formatSetResult(
  feature: string,
  value: FeatureValue,
  saved: boolean,
  user: string | null,
): string {
  const displayValue = formatValue(value);

  if (saved) {
    if (user) {
      return `dx: ${feature} = ${displayValue} for ${user} (saved to config.json)`;
    }
    return `dx: ${feature} = ${displayValue} (saved to config.json)`;
  }

  return (
    `dx: ${feature} = ${displayValue} (local)\n` +
    `    To persist across environments: dx set ${feature} ${value} --save`
  );
}

/**
 * Format the result of a set operation as JSON.
 *
 * Returns a JSON string like:
 * `{"feature":"tips.show-duration","value":"10m","target":"local"}`
 *
 * When target is "config" and a user is known, includes the `user` field.
 */
export function formatSetResultJson(
  feature: string,
  value: FeatureValue,
  saved: boolean,
  user: string | null,
): string {
  return JSON.stringify(
    {
      feature,
      value,
      target: saved ? "config" : "local",
      ...(saved && user ? { user } : {}),
    },
    null,
    2,
  );
}

/**
 * Build the `dx set` Commander command.
 */
export function buildSetCommand(): Command {
  const cmd = new Command("set")
    .description("Set a feature to a typed value")
    .argument("<feature>", "Feature name to set")
    .argument("<value>", "Value to set (auto-detected type)")
    .option("--save", "Persist to config.json (user override)")
    .option("--json", "Output as JSON");

  cmd.action((feature: string, rawValue: string, opts: { save?: boolean; json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const ctx = dx.getContext();
    const user = resolveUser(ctx);
    const value = parseCliValue(rawValue);

    // Warn if the feature is not registered (but still proceed)
    if (ctx.config.features && !(feature in ctx.config.features)) {
      process.stderr.write(
        `dx: warning: "${feature}" is not a registered feature\n`,
      );
    }

    let saved = false;

    if (opts.save) {
      if (user) {
        if (!ctx.configPath) {
          throw new Error("dx: configPath not set in context -- cannot --save");
        }
        writeTypedUserOverride(ctx.configPath, user, feature, value);
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
      const localPath =
        ctx.localPath ??
        (ctx.configPath
          ? resolve(dirname(ctx.configPath), "config.local.json")
          : null);
      if (!localPath) throw new Error("dx: cannot determine local config path");
      writeTypedLocalOverride(localPath, feature, value);
    }

    // Auto-sync to git config so `git config dx.<feature>` stays current
    autoSync();

    if (useJson) {
      process.stdout.write(
        formatSetResultJson(feature, value, saved, user) + "\n",
      );
    } else {
      process.stderr.write(
        formatSetResult(feature, value, saved, user) + "\n",
      );
    }
  });

  return cmd;
}
