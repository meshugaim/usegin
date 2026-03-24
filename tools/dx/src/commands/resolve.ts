/**
 * dx resolve <feature> -- resolve a single feature flag.
 *
 * Exports pure formatting functions and a Commander command builder.
 *
 * Part of: ENG-3442
 */

import { Command } from "commander";
import { getFeature, type FeatureInfo } from "../core";
import { shouldDefaultToJson } from "../../../lib/output-mode";
import dx from "../../sdk";

/**
 * Format the resolve output for human display.
 *
 * Outputs "true" or "false".
 */
export function formatResolve(_feature: string, info: FeatureInfo): string {
  return info.enabled ? "true" : "false";
}

/**
 * Format the resolve output as JSON.
 *
 * Returns `{"feature":"<name>","enabled":<bool>,"source":"<source>"}`
 */
export function formatResolveJson(feature: string, info: FeatureInfo): string {
  return JSON.stringify({
    feature,
    enabled: info.enabled,
    source: info.source,
  });
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

      const useJson = shouldDefaultToJson({
        envVarName: "DX_OUTPUT",
        json: opts.json,
        env: process.env as Record<string, string | undefined>,
        isTTY: process.stdout.isTTY ?? false,
      });

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
