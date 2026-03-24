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
  type DxConfig,
  type DxContext,
} from "../core";
import { shouldDefaultToJson } from "../../../lib/output-mode";
import dx from "../../sdk";

/** Input shape for formatStatus. */
export interface StatusData {
  user: string | null;
  features: Record<string, FeatureInfo & { description: string }>;
  config: DxConfig;
}

/**
 * Format the status output for human display (TTY).
 *
 * Shows a table with override markers:
 * - `*` = user override (differs from default)
 * - `~` = local override (temporary)
 * - Shows "User: <name>" or "User: unknown"
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

    // State label: uppercase when overridden
    let stateLabel = feat.enabled ? "on" : "off";
    if (isOverridden) {
      stateLabel = stateLabel.toUpperCase();
    }

    // Override marker
    let marker = " ";
    if (feat.source === "user-override") {
      marker = "*";
    } else if (feat.source === "local-override") {
      marker = "~";
    }

    // Dot-fill between name and state
    const dotCount = maxNameLen - name.length + 2;
    const dots = ".".repeat(Math.max(dotCount, 2));

    lines.push(
      `  ${name} ${dots} ${stateLabel}${marker}  ${feat.description}`,
    );
  }

  // Legend
  const sources = Object.values(data.features).map((f) => f.source);
  const hasUserOverride = sources.includes("user-override");
  const hasLocalOverride = sources.includes("local-override");
  if (hasUserOverride || hasLocalOverride) {
    lines.push("");
    if (hasUserOverride) lines.push("  * = personal override");
    if (hasLocalOverride) lines.push("  ~ = local override");
  }

  return lines.join("\n");
}

/**
 * Format the status output as JSON (headless/--json).
 *
 * Returns `{ user, features: { [name]: { enabled, source, description } } }`
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
    config: ctx.config,
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
    const useJson = shouldDefaultToJson({
      envVarName: "DX_OUTPUT",
      json: opts.json,
      env: process.env as Record<string, string | undefined>,
      isTTY: process.stdout.isTTY ?? false,
    });

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
