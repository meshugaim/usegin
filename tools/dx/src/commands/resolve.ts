/**
 * dx resolve <feature> -- resolve a single feature flag.
 *
 * Exports pure formatting functions and a Commander command builder.
 *
 * Part of: ENG-3442, ENG-4687
 */

import { Command } from "commander";
import { getFeature, type FeatureInfo } from "../core";
import { dxShouldOutputJson } from "../output";
import dx from "../../sdk";

/**
 * Format the resolve output for human display.
 *
 * Outputs the resolved value as a string: `String(info.value)`.
 * For booleans this is "true"/"false"; for strings and numbers it's the
 * actual value (e.g., "10m", "42").
 *
 * Output goes to stdout (not stderr). This is intentional:
 * `dx resolve` is designed for scripting (`if dx resolve feature; then ...`),
 * so its output goes to stdout to be capturable, unlike other human-facing
 * commands that write to stderr.
 *
 * @param _feature Feature name (unused in human output, kept for API symmetry with formatResolveJson)
 * @param info Resolved feature info
 */
export function formatResolve(_feature: string, info: FeatureInfo): string {
  return String(info.value);
}

/**
 * Format the resolve output as JSON.
 *
 * Returns `{"feature":"<name>","enabled":<bool>,"source":"<source>"}`
 */
export function formatResolveJson(feature: string, info: FeatureInfo): string {
  return JSON.stringify(
    {
      feature,
      value: info.value,
      enabled: info.enabled,
      source: info.source,
    },
    null,
    2,
  );
}

/**
 * Return a process exit code for a resolved feature.
 *
 * Returns 0 if the feature is enabled, 1 if disabled.
 * Used by `dx resolve --exit-code` to signal feature state to scripts.
 */
export function resolveExitCode(info: FeatureInfo): number {
  return info.enabled ? 0 : 1;
}

/**
 * Build the `dx resolve` Commander command.
 */
export function buildResolveCommand(): Command {
  const cmd = new Command("resolve")
    .description("Resolve a single feature flag")
    .argument("<feature>", "Feature name to resolve")
    .option("--json", "Output as JSON")
    .option("--exit-code", "Exit with 0 if enabled, 1 if disabled");

  cmd.action(
    (feature: string, opts: { json?: boolean; exitCode?: boolean }) => {
      const ctx = dx.getContext();
      const info = getFeature(feature, ctx);

      const useJson = dxShouldOutputJson(opts);

      if (useJson) {
        process.stdout.write(formatResolveJson(feature, info) + "\n");
      } else {
        process.stdout.write(formatResolve(feature, info) + "\n");
      }

      if (opts.exitCode) {
        process.exit(resolveExitCode(info));
      }
    },
  );

  return cmd;
}
