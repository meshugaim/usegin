/**
 * dx list — show all registered features with gate counts.
 *
 * Exports pure functions for building and formatting the list,
 * plus a Commander command builder.
 *
 * Part of: ENG-3443, ENG-4688
 */

import { Command } from "commander";
import { spawnSync } from "child_process";
import type { DxContext } from "../core";
import { filterByNamespace } from "../namespace";
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
 * Returns entries with warning flags for 0 gates or >2 gates.
 * Unknown features in grepResults are silently ignored.
 */
export function buildListData(
  ctx: DxContext,
  grepResults: Record<string, number>,
  namespace?: string,
): ListEntry[] {
  // Filter features by namespace before building entries
  const filteredFeatures = filterByNamespace(ctx.config.features, namespace);

  const entries: ListEntry[] = [];

  for (const [name, featureDef] of Object.entries(filteredFeatures)) {
    const gateCount = grepResults[name] ?? 0;

    let warning: string | null = null;
    if (gateCount === 0) {
      warning = "registered but not gated anywhere";
    } else if (gateCount > 2) {
      // A feature gated in 2 places (e.g. hook + script) is normal.
      // Only note when there are more than 2 gate points.
      warning = "note: multiple gate points";
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
 * Parse raw grep output and tally occurrences per feature.
 *
 * Pure function: takes the raw stdout from a grep call and a list of
 * feature names, returns a map of feature name -> matching line count.
 * Each line is checked against all features, so a line mentioning
 * multiple features increments both counters.
 */
export function parseGrepOutput(
  output: string,
  features: string[],
): Record<string, number> {
  const results: Record<string, number> = {};

  for (const feature of features) {
    results[feature] = 0;
  }

  if (!output.trim()) {
    return results;
  }

  for (const line of output.trim().split("\n")) {
    if (!line) continue;
    // Skip the dx tool's own code — tests and SDK docs inflate counts
    if (line.startsWith("tools/dx/")) continue;
    for (const feature of features) {
      if (line.includes(feature)) {
        results[feature]++;
      }
    }
  }

  return results;
}

/**
 * Grep the codebase for actual dx gate patterns per feature.
 *
 * For each feature, searches for SDK calls (`isEnabled`, `getFeature`),
 * CLI invocations (`dx resolve`), and git config reads (`git config dx.X`)
 * across .ts, .tsx, and .sh files. Excludes `tools/dx/` itself so the
 * dx tool's own code doesn't inflate counts.
 *
 * Uses a single grep call with alternation to avoid spawning one process
 * per feature, which is significantly faster on large codebases.
 *
 * Returns a map of feature name to matching line count.
 */
export function grepGateCounts(features: string[]): Record<string, number> {
  if (features.length === 0) {
    return {};
  }

  // Build a single combined pattern that matches any feature.
  // Each matching line is then checked against individual features to tally.
  const featureAlt = features.map(escapeRegex).join("|");
  const combinedPattern =
    `(isEnabled|getFeature).*"(${featureAlt})"` +
    `|(dx resolve|dx\\.resolve).*(${featureAlt})` +
    `|git config dx\\.(${featureAlt})`;

  // Single grep call: -rE for extended regex, output matching lines.
  // --exclude-dir to skip the dx tool's own source.
  // Search only directories where gates would realistically live.
  // Exit code 1 means no matches (not an error).
  const searchDirs = [
    ".claude/",
    ".husky/",
    "scripts/",
    "tools/",
    "nextjs-app/",
    "python-services/",
  ];

  const result = spawnSync(
    "grep",
    [
      "-rE",
      "--include=*.ts",
      "--include=*.tsx",
      "--include=*.sh",
      "--exclude-dir=node_modules",
      "--exclude-dir=.venv",
      "--exclude-dir=.next",
      // Best-effort exclusion; authoritative filter is in parseGrepOutput
      "--exclude-dir=dx",
      "--exclude=*.test.ts",
      "--exclude=*.test.tsx",
      combinedPattern,
      ...searchDirs,
    ],
    { encoding: "utf-8", cwd: process.cwd() },
  );

  const stdout = result.status === 0 ? (result.stdout ?? "") : "";
  return parseGrepOutput(stdout, features);
}

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Format the list entries as a human-readable table.
 *
 * Includes gate counts and note markers:
 * - 0 gates: "registered but not gated"
 * - >2 gates: "note: multiple gate points"
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
      const marker = entry.warning.startsWith("note:") ? "\u2139" : "\u26A0";
      line += `\n    ${marker} ${entry.warning}`;
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
    .argument("[namespace]", "Filter to a namespace prefix (e.g. 'tips')")
    .option("--json", "Output as JSON");

  cmd.action((namespace: string | undefined, opts: { json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const ctx = dx.getContext();

    const featureNames = Object.keys(ctx.config.features);
    const grepResults = grepGateCounts(featureNames);
    const data = buildListData(ctx, grepResults, namespace);

    if (useJson) {
      process.stdout.write(formatListJson(data) + "\n");
    } else {
      process.stderr.write(formatList(data) + "\n");
    }
  });

  return cmd;
}
