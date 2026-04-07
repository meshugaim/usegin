/**
 * dx status -- show all features with resolved on/off state.
 *
 * Exports pure formatting functions and a Commander command builder.
 *
 * Part of: ENG-3442
 */

import { Command } from "commander";
import {
  allFeatures,
  resolveUser,
  type FeatureInfo,
  type DxContext,
} from "../core";
import { dxShouldOutputJson, dotFill } from "../output";
import dx from "../../sdk";

/** Input shape for formatStatus. */
export interface StatusData {
  user: string | null;
  features: Record<string, FeatureInfo & { description: string }>;
}

/**
 * Format the status output for human display (TTY).
 *
 * Shows a table with inline source labels for overridden features:
 * - `(personal)` = user override (persisted in config.json)
 * - `(local)` = local override (temporary, gitignored)
 * - No label for features at their default value
 *
 * Shows "User: <name>" or "User: unknown".
 */
export function formatStatus(data: StatusData): string {
  const lines: string[] = [];

  // User line
  lines.push(`User: ${data.user ?? "unknown"}`);
  lines.push("");

  const featureNames = Object.keys(data.features);
  if (featureNames.length === 0) {
    return lines.join("\n");
  }

  // Calculate column width for alignment
  const maxNameLen = Math.max(...featureNames.map((n) => n.length));

  for (const name of featureNames) {
    const feat = data.features[name];
    const isOverridden =
      feat.source === "user-override" || feat.source === "local-override";

    // State label: typed values for non-booleans, on/off for booleans
    let stateLabel: string;
    if (typeof feat.value === "boolean") {
      // Boolean features: on/off, uppercase when overridden
      stateLabel = feat.enabled ? "on" : "off";
      if (isOverridden) {
        stateLabel = stateLabel.toUpperCase();
      }
    } else {
      // Non-boolean features: show the actual value
      stateLabel = String(feat.value);
      if (isOverridden) {
        // Uppercase the string representation (no-op for numbers)
        stateLabel = stateLabel.toUpperCase();
      }
    }

    // Override marker (for quick visual scanning)
    let marker = " ";
    if (feat.source === "user-override") {
      marker = "*";
    } else if (feat.source === "local-override") {
      marker = "~";
    }

    // Inline source label (self-documenting, supplements the marker)
    let sourceLabel = "";
    if (feat.source === "user-override") {
      sourceLabel = " (personal)";
    } else if (feat.source === "local-override") {
      sourceLabel = " (local)";
    }

    // Dot-fill between name and state
    const dots = dotFill(name, maxNameLen);

    lines.push(
      `  ${name} ${dots} ${stateLabel}${marker}${sourceLabel}  ${feat.description}`,
    );
  }

  return lines.join("\n");
}

/**
 * Format the status output as JSON (headless/--json).
 *
 * Returns `{ user, features: { [name]: { value, enabled, source, description } } }`
 */
export function formatStatusJson(data: StatusData): string {
  return JSON.stringify(
    {
      user: data.user,
      features: data.features,
    },
    null,
    2,
  );
}

/**
 * Build a StatusData object from a DxContext.
 *
 * Resolves the user, evaluates all features, and enriches each
 * feature with its description from the config.
 */
export function buildStatusData(ctx: DxContext): StatusData {
  const user = resolveUser(ctx);
  const rawFeatures = allFeatures(ctx);

  // Enrich each feature with its description from config
  const features: Record<string, FeatureInfo & { description: string }> = {};
  for (const [name, info] of Object.entries(rawFeatures)) {
    features[name] = {
      ...info,
      description: ctx.config.features[name]?.description ?? "",
    };
  }

  return {
    user,
    features,
  };
}

/**
 * Build the `dx status` Commander command.
 */
export function buildStatusCommand(): Command {
  const cmd = new Command("status")
    .description("Show all features with resolved on/off state")
    .option("--json", "Output as JSON");

  cmd.action((opts: { json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);

    const ctx = dx.getContext();
    const data = buildStatusData(ctx);

    if (useJson) {
      process.stdout.write(formatStatusJson(data) + "\n");
    } else {
      process.stderr.write(formatStatus(data) + "\n");
    }
  });

  return cmd;
}
