/**
 * dx identify — resolve or set the current user identity.
 *
 * Exports pure functions for identity signal collection
 * and a Commander command builder.
 *
 * Part of: ENG-3443
 */

import { Command } from "commander";
import type { DxContext } from "../core";
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
  const envSignals: Array<{ key: string; signal: string }> = [
    { key: "DX_USER", signal: "DX_USER" },
    { key: "GITHUB_USER", signal: "GITHUB_USER" },
    { key: "USER", signal: "USER" },
  ];

  for (const { key, signal } of envSignals) {
    const value = ctx.env[key];
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

    if (useJson) {
      process.stdout.write(JSON.stringify(signals, null, 2) + "\n");
    } else {
      for (const s of signals) {
        process.stderr.write(`${s.signal}: ${s.value}\n`);
      }
    }
  });

  return cmd;
}
