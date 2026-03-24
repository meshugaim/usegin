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
import {
  resolveUserWithProvenance,
  type UserProvenance,
  type UserSignal,
  type UserMatch,
} from "../core";

// Re-export core types under the names whoami consumers already use.
// "IdentityInfo" is the public shape for this command's formatters.
export type IdentitySignal = UserSignal;
export type IdentityMatch = UserMatch;
export type IdentityInfo = UserProvenance;

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
 * Format the whoami output as JSON (pretty-printed for stdout consumption).
 *
 * Returns `{ "user": "nitsan", "signal": "USER", "match": "alias" }`
 */
export function formatWhoamiJson(info: IdentityInfo): string {
  return JSON.stringify(
    {
      user: info.user,
      signal: info.signal,
      match: info.match,
    },
    null,
    2,
  );
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
    const info = resolveUserWithProvenance(ctx);

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
