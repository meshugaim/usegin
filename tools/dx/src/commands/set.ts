/**
 * dx set <feature> <value> -- set a feature to a typed value.
 *
 * Exports pure functions for parsing CLI values, formatting output,
 * and a Commander command builder. Persistence uses the shared
 * `writeLocalOverride`/`writeUserOverride` from `enable-disable.ts`.
 *
 * Part of: ENG-4687
 */

import { Command } from "commander";
import { dirname, resolve } from "path";
import type { FeatureValue } from "../core";
import { resolveUser } from "../core";
import { dxShouldOutputJson } from "../output";
import { writeLocalOverride, writeUserOverride } from "./enable-disable";
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

  // Quote string values in the hint so the command is copy-pasteable
  // (e.g., `dx set feature "" --save` instead of `dx set feature  --save`)
  const hintValue = typeof value === "string" ? JSON.stringify(value) : String(value);

  return (
    `dx: ${feature} = ${displayValue} (local)\n` +
    `    To persist across environments: dx set ${feature} ${hintValue} --save`
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
        writeUserOverride(ctx.configPath, user, feature, value);
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
      writeLocalOverride(localPath, feature, value);
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
