/**
 * dx resolve <feature> — resolve a single feature flag.
 *
 * Exports pure formatting functions and a Commander command builder.
 *
 * Part of: ENG-3442
 */

import type { Command } from "commander";
import type { FeatureInfo } from "../core";

/**
 * Format the resolve output for human display.
 *
 * Outputs "true" or "false".
 */
export function formatResolve(_feature: string, _info: FeatureInfo): string {
  throw new Error("Not implemented");
}

/**
 * Format the resolve output as JSON.
 *
 * Returns `{"feature":"<name>","enabled":<bool>,"source":"<source>"}`
 */
export function formatResolveJson(_feature: string, _info: FeatureInfo): string {
  throw new Error("Not implemented");
}

/**
 * Return a process exit code for a resolved feature.
 *
 * Returns 0 if the feature is enabled, 1 if disabled.
 * Used by `dx resolve --exit-code` to signal feature state to scripts.
 */
export function resolveExitCode(_info: FeatureInfo): number {
  throw new Error("Not implemented");
}

/**
 * Build the `dx resolve` Commander command.
 */
export function buildResolveCommand(): Command {
  throw new Error("Not implemented");
}
