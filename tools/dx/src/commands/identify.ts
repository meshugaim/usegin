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

/** A single identity signal with its source and value. */
export interface CollectedSignal {
  signal: string;
  value: string;
}

/**
 * Collect all current identity signals from the context.
 *
 * Returns a list of signals that are present (non-null),
 * e.g. `[{ signal: "USER", value: "nitsan" }, ...]`.
 */
export function collectIdentitySignals(
  _ctx: DxContext,
): CollectedSignal[] {
  throw new Error("Not implemented");
}

/**
 * Build the `dx identify` Commander command.
 *
 * Optional `--as <name>` argument to explicitly set identity.
 */
export function buildIdentifyCommand(): Command {
  throw new Error("Not implemented");
}
