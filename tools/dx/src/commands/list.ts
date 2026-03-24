/**
 * dx list — show all registered features with gate counts.
 *
 * Exports pure functions for building and formatting the list,
 * plus a Commander command builder.
 *
 * Part of: ENG-3443
 */

import { Command } from "commander";
import type { DxContext } from "../core";
import { dxShouldOutputJson } from "../output";
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
    const dotCount = maxNameLen - entry.feature.length + 2;
    const dots = ".".repeat(Math.max(dotCount, 2));
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

    // In a real implementation, grepResults would come from scanning the codebase
    const grepResults: Record<string, number> = {};
    const data = buildListData(ctx, grepResults);

    if (useJson) {
      process.stdout.write(formatListJson(data) + "\n");
    } else {
      process.stderr.write(formatList(data) + "\n");
    }
  });

  return cmd;
}
