/**
 * dx identify — resolve or set the current user identity.
 *
 * Exports pure functions for identity signal collection
 * and a Commander command builder.
 *
 * Part of: ENG-3443
 */

import { Command } from "commander";
import { readFileSync, writeFileSync } from "fs";
import {
  extractEmailPrefix,
  matchSignalToUser,
  type DxContext,
  type UserDefinition,
} from "../core";
import { dxShouldOutputJson } from "../output";
import dx from "../../sdk";

/** A single identity signal with its source and value. */
export interface CollectedSignal {
  signal: string;
  value: string;
}

/**
 * Collect all current identity signals from the context.
 *
 * Returns a list of signals that are present (non-null/undefined),
 * e.g. `[{ signal: "USER", value: "nitsan" }, ...]`.
 *
 * Empty string "" IS included — it's a set signal.
 * Only null/undefined are omitted.
 */
export function collectIdentitySignals(
  ctx: DxContext,
): CollectedSignal[] {
  const signals: CollectedSignal[] = [];

  // Environment variable signals
  const envSignalNames = ["DX_USER", "GITHUB_USER", "USER"] as const;

  for (const signal of envSignalNames) {
    const value = ctx.env[signal];
    if (value !== undefined && value !== null) {
      signals.push({ signal, value });
    }
  }

  // Context signals
  const ctxSignals: Array<{ value: string | null; signal: string }> = [
    { value: ctx.whoami, signal: "whoami" },
    { value: ctx.gitUserName, signal: "gitUserName" },
    { value: ctx.gitUserEmail, signal: "gitUserEmail" },
  ];

  for (const { value, signal } of ctxSignals) {
    if (value !== undefined && value !== null) {
      signals.push({ signal, value });
    }
  }

  return signals;
}

/**
 * Try to auto-detect which user the current signals match.
 *
 * Iterates through collected signals and checks if any match
 * a user key or alias in the config. For `gitUserEmail` signals,
 * extracts the prefix before `@` before matching — mirroring the
 * email prefix extraction in `core.ts`'s `resolveUserWithProvenance`.
 *
 * Returns the matched user key if found, or null.
 */
export function autoDetectUser(
  signals: CollectedSignal[],
  users: Record<string, UserDefinition>,
): string | null {
  for (const s of signals) {
    let matchValue = s.value;

    // For email signals, extract the prefix before @ to match how
    // core.ts resolves identity from gitUserEmail.
    if (s.signal === "gitUserEmail" && matchValue) {
      const prefix = extractEmailPrefix(matchValue);
      if (prefix === null) continue;
      matchValue = prefix;
    }

    const result = matchSignalToUser(matchValue, users);
    if (result !== null) {
      return result.user;
    }
  }
  return null;
}

/**
 * Add new identity signals as aliases for a user in config.
 *
 * Reads config.json, adds any signal values not already present
 * as aliases for the given user, and writes back. Creates the
 * user entry if it doesn't exist.
 *
 * Returns the list of newly added aliases.
 */
export function addSignalsAsAliases(
  configPath: string,
  userName: string,
  signals: CollectedSignal[],
): string[] {
  const raw = readFileSync(configPath, "utf-8");
  const data = JSON.parse(raw);

  if (!data.users) {
    data.users = {};
  }

  if (!data.users[userName]) {
    data.users[userName] = { aliases: [], overrides: {} };
  }

  const user = data.users[userName];
  const existingAliases = new Set(
    user.aliases.map((a: string) => a.toLowerCase()),
  );
  // Also consider the user key itself as "already known"
  existingAliases.add(userName.toLowerCase());

  const added: string[] = [];

  for (const s of signals) {
    if (!s.value) continue; // skip empty signals
    if (existingAliases.has(s.value.toLowerCase())) continue;
    user.aliases.push(s.value);
    existingAliases.add(s.value.toLowerCase());
    added.push(s.value);
  }

  if (added.length > 0) {
    writeFileSync(configPath, JSON.stringify(data, null, 2) + "\n");
  }

  return added;
}

/**
 * Build the `dx identify` Commander command.
 *
 * Optional `--as <name>` argument to explicitly set identity.
 */
export function buildIdentifyCommand(): Command {
  const cmd = new Command("identify")
    .description("Show or set current user identity")
    .option("--as <name>", "Explicitly set identity")
    .option("--json", "Output as JSON");

  cmd.action((opts: { as?: string; json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const ctx = dx.getContext();
    const signals = collectIdentitySignals(ctx);

    if (opts.as) {
      // --as <name>: add current signals as aliases for the named user
      if (!ctx.configPath) {
        throw new Error("dx: configPath not set in context — cannot --as");
      }
      const added = addSignalsAsAliases(ctx.configPath, opts.as, signals);

      if (useJson) {
        process.stdout.write(
          JSON.stringify(
            { user: opts.as, added, signals },
            null,
            2,
          ) + "\n",
        );
      } else {
        if (added.length > 0) {
          process.stderr.write(
            `dx: added aliases for ${opts.as}: ${added.join(", ")}\n`,
          );
        } else {
          process.stderr.write(
            `dx: all signals already known for ${opts.as}\n`,
          );
        }
      }
      return;
    }

    // No --as: auto-detect or show signals
    const matchedUser = autoDetectUser(signals, ctx.config.users);

    if (useJson) {
      process.stdout.write(
        JSON.stringify({ user: matchedUser, signals }, null, 2) + "\n",
      );
    } else {
      if (matchedUser) {
        process.stderr.write(`dx: identified as ${matchedUser}\n`);
      } else {
        process.stderr.write("dx: could not identify user\n");
        const userKeys = Object.keys(ctx.config.users);
        if (userKeys.length > 0) {
          process.stderr.write(
            `    Known users: ${userKeys.join(", ")}\n`,
          );
          process.stderr.write(
            `    Run: dx identify --as <name>\n`,
          );
        }
      }
      for (const s of signals) {
        process.stderr.write(`  ${s.signal}: ${s.value}\n`);
      }
    }
  });

  return cmd;
}
