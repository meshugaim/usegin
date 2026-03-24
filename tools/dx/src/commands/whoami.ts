/**
 * dx whoami -- show resolved identity.
 *
 * Exports pure formatting functions and a Commander command builder.
 *
 * Part of: ENG-3442
 */

import { Command } from "commander";
import { shouldDefaultToJson } from "../../../lib/output-mode";
import dx from "../../sdk";
import { resolveUser, type DxContext } from "../core";

/** The signal that matched during user resolution. */
export type IdentitySignal =
  | "DX_USER"
  | "GITHUB_USER"
  | "USER"
  | "whoami"
  | "gitUserName"
  | "gitUserEmail";

/** How the signal was matched. */
export type IdentityMatch = "exact" | "alias";

/** Result of identity resolution with provenance. */
export interface IdentityInfo {
  user: string | null;
  signal: IdentitySignal | null;
  match: IdentityMatch | null;
}

/**
 * Format the whoami output for human display.
 *
 * Example: "User: nitsan (via $USER -> alias match)"
 */
export function formatWhoami(info: IdentityInfo): string {
  if (info.user === null) {
    return "User: unknown -- run `dx identify` to personalize";
  }

  if (info.signal !== null && info.match !== null) {
    return `User: ${info.user} (via $${info.signal} -> ${info.match} match)`;
  }

  return `User: ${info.user}`;
}

/**
 * Format the whoami output as JSON.
 *
 * Returns `{"user":"nitsan","signal":"USER","match":"alias"}`
 */
export function formatWhoamiJson(info: IdentityInfo): string {
  return JSON.stringify({
    user: info.user,
    signal: info.signal,
    match: info.match,
  });
}

/**
 * Resolve identity with provenance information.
 *
 * Walks the same signal chain as resolveUser but tracks which signal
 * matched and how (exact vs alias).
 */
function resolveIdentity(ctx: DxContext): IdentityInfo {
  // $DX_USER is the explicit override -- always exact
  if (ctx.env.DX_USER !== undefined) {
    return { user: ctx.env.DX_USER || null, signal: "DX_USER", match: "exact" };
  }

  // Signal chain: GITHUB_USER, USER, whoami, gitUserName
  const signals: Array<{
    value: string | null | undefined;
    signal: IdentitySignal;
  }> = [
    { value: ctx.env.GITHUB_USER, signal: "GITHUB_USER" },
    { value: ctx.env.USER, signal: "USER" },
    { value: ctx.whoami, signal: "whoami" },
    { value: ctx.gitUserName, signal: "gitUserName" },
  ];

  for (const { value, signal } of signals) {
    if (value == null) continue;
    const matchResult = matchSignalToUser(value, ctx);
    if (matchResult !== null) {
      return { user: matchResult.user, signal, match: matchResult.match };
    }
  }

  // gitUserEmail -- extract prefix before @
  if (ctx.gitUserEmail != null) {
    const atIndex = ctx.gitUserEmail.indexOf("@");
    const prefix =
      atIndex === -1
        ? ctx.gitUserEmail
        : ctx.gitUserEmail.substring(0, atIndex);

    if (prefix.length > 0) {
      const matchResult = matchSignalToUser(prefix, ctx);
      if (matchResult !== null) {
        return {
          user: matchResult.user,
          signal: "gitUserEmail",
          match: matchResult.match,
        };
      }
    }
  }

  return { user: null, signal: null, match: null };
}

/**
 * Match a signal string against known users and their aliases.
 * Returns the matched user key and match type, or null.
 */
function matchSignalToUser(
  signal: string,
  ctx: DxContext,
): { user: string; match: IdentityMatch } | null {
  const signalLower = signal.toLowerCase();

  for (const [userKey, userDef] of Object.entries(ctx.config.users)) {
    // Check user key (exact match)
    if (userKey.toLowerCase() === signalLower) {
      return { user: userKey, match: "exact" };
    }
    // Check aliases
    for (const alias of userDef.aliases) {
      if (alias.toLowerCase() === signalLower) {
        return { user: userKey, match: "alias" };
      }
    }
  }

  return null;
}

/**
 * Build the `dx whoami` Commander command.
 */
export function buildWhoamiCommand(): Command {
  const cmd = new Command("whoami")
    .description("Show resolved identity")
    .option("--json", "Output as JSON");

  cmd.action((opts: { json?: boolean }) => {
    const ctx = dx.getContext();
    const info = resolveIdentity(ctx);

    const useJson = shouldDefaultToJson({
      envVarName: "DX_OUTPUT",
      json: opts.json,
      env: process.env as Record<string, string | undefined>,
      isTTY: process.stdout.isTTY ?? false,
    });

    if (useJson) {
      process.stdout.write(formatWhoamiJson(info) + "\n");
    } else {
      process.stderr.write(formatWhoami(info) + "\n");
    }
  });

  return cmd;
}
