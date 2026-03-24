/**
 * dx list — show all registered features with gate counts.
 *
 * Exports pure functions for building and formatting the list,
 * plus a Commander command builder.
 *
 * Part of: ENG-3443
 */

import { Command } from "commander";
import { spawnSync } from "child_process";
import type { DxContext } from "../core";
import { dxShouldOutputJson, dotFill } from "../output";
import dx from "../../sdk";

/** A single entry in the feature list. */
export interface ListEntry {
  feature: string;
  description: string;
  gateCount: number;
  warning: string | null;
}

/**
 * Build list data from feature config and grep results.
 *
 * Takes the DxContext (for feature definitions) and a map of
 * feature name -> gate count (from grepping the codebase).
 * Returns entries with warning flags for 0 gates or >1 gates.
 * Unknown features in grepResults are silently ignored.
 */
export function buildListData(
  ctx: DxContext,
  grepResults: Record<string, number>,
): ListEntry[] {
  const entries: ListEntry[] = [];

  for (const [name, featureDef] of Object.entries(ctx.config.features)) {
    const gateCount = grepResults[name] ?? 0;

    let warning: string | null = null;
    if (gateCount === 0) {
      warning = "registered but not gated anywhere";
    } else if (gateCount > 1) {
      warning = "multiple gate points";
    }

    entries.push({
      feature: name,
      description: featureDef.description,
      gateCount,
      warning,
    });
  }

  return entries;
}

/**
 * Build a regex pattern that matches actual dx gate usage for a feature.
 *
 * Matches:
 * - `isEnabled.*"feature"` or `getFeature.*"feature"` (TS SDK usage)
 * - `dx resolve feature` or `dx.resolve.*feature` (CLI/bash usage)
 * - `git config dx.feature` (git config cache usage)
 */
export function buildGatePattern(feature: string): string {
  return `(isEnabled|getFeature).*"${feature}"|(dx resolve|dx\\.resolve).*${feature}|git config dx\\.${feature}`;
}

/**
 * Grep the codebase for actual dx gate patterns per feature.
 *
 * For each feature, searches for SDK calls (`isEnabled`, `getFeature`),
 * CLI invocations (`dx resolve`), and git config reads (`git config dx.X`)
 * across .ts, .tsx, and .sh files. Excludes `tools/dx/` itself so the
 * dx tool's own code doesn't inflate counts.
 *
 * Returns a map of feature name to matching line count.
 */
export function grepGateCounts(features: string[]): Record<string, number> {
  const results: Record<string, number> = {};

  for (const feature of features) {
    const pattern = buildGatePattern(feature);

    // grep -rE for extended regex, -c for counts per file.
    // --exclude-dir to skip the dx tool's own source.
    // Exit code 1 means no matches (not an error).
    const result = spawnSync(
      "grep",
      [
        "-rE",
        "--include=*.ts",
        "--include=*.tsx",
        "--include=*.sh",
        "--exclude-dir=tools/dx",
        "-c",
        pattern,
        ".",
      ],
      { encoding: "utf-8", cwd: process.cwd() },
    );

    if (result.status === 0 && result.stdout) {
      let total = 0;
      for (const line of result.stdout.trim().split("\n")) {
        const match = line.match(/:(\d+)$/);
        if (match) {
          total += parseInt(match[1], 10);
        }
      }
      results[feature] = total;
    } else {
      results[feature] = 0;
    }
  }

  return results;
}

/**
 * Format the list entries as a human-readable table.
 *
 * Includes gate counts and warning markers:
 * - 0 gates: "registered but not gated"
 * - >1 gates: "multiple gate points"
 */
export function formatList(entries: ListEntry[]): string {
  if (entries.length === 0) {
    return "No features registered";
  }

  const lines: string[] = [];
  const maxNameLen = Math.max(...entries.map((e) => e.feature.length));

  for (const entry of entries) {
    const dots = dotFill(entry.feature, maxNameLen);
    const gateLabel = entry.gateCount === 1 ? "gate" : "gates";

    let line = `  ${entry.feature} ${dots} ${entry.gateCount} ${gateLabel}   ${entry.description}`;

    if (entry.warning) {
      line += `\n    \u26A0 ${entry.warning}`;
    }

    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * Format the list entries as a JSON array.
 *
 * Returns a JSON string of the entries array.
 */
export function formatListJson(entries: ListEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

/**
 * Build the `dx list` Commander command.
 */
export function buildListCommand(): Command {
  const cmd = new Command("list")
    .description("Show all registered features with gate counts")
    .option("--json", "Output as JSON");

  cmd.action((opts: { json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const ctx = dx.getContext();

    const featureNames = Object.keys(ctx.config.features);
    const grepResults = grepGateCounts(featureNames);
    const data = buildListData(ctx, grepResults);

    if (useJson) {
      process.stdout.write(formatListJson(data) + "\n");
    } else {
      process.stderr.write(formatList(data) + "\n");
    }
  });

  return cmd;
}
