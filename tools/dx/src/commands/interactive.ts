/**
 * dx (bare, TTY) — interactive feature picker.
 *
 * Exports pure data transformation functions for building the
 * interactive multiselect options, plus a `runInteractive` function
 * that drives the full interactive flow (prompt, diff, write).
 *
 * The actual UI uses @clack/prompts and is tested at the integration
 * level, not here.
 *
 * Part of: ENG-3443
 */

import { getFeature, type DxContext } from "../core";
import { writeLocalOverride } from "./enable-disable";
import { autoSync } from "./sync";

/** A single option for the interactive multiselect picker. */
export interface InteractiveOption {
  value: string;
  label: string;
  hint: string;
  initialValue: boolean;
}

/**
 * Build the list of interactive options from a DxContext.
 *
 * Each option includes the feature name, description, and current
 * enabled state for the multiselect picker's initial values.
 *
 * Uses `getFeature` from core to resolve the current state per the
 * three-layer merge chain. The `initialValue` reflects the resolved
 * enabled state for the current user.
 */
export function buildInteractiveOptions(
  ctx: DxContext,
): InteractiveOption[] {
  const featureNames = Object.keys(ctx.config.features);

  return featureNames.map((name) => {
    const featureDef = ctx.config.features[name];
    const info = getFeature(name, ctx);

    return {
      value: name,
      label: name,
      hint: featureDef.description,
      initialValue: info.enabled,
    };
  });
}

/**
 * Build the exact config object that `@clack/prompts` multiselect expects.
 *
 * Transforms the per-option `initialValue` booleans into a top-level
 * `initialValues` array of enabled feature names, and ensures
 * descriptions are visible in each option's label.
 */
export function buildMultiselectConfig(options: InteractiveOption[]): {
  options: Array<{ value: string; label: string }>;
  initialValues: string[];
} {
  throw new Error("Not implemented");
}

/**
 * Run the interactive feature toggle picker.
 *
 * Presents a multiselect prompt, diffs against current state,
 * writes local overrides for any changes, and auto-syncs to git config.
 */
export async function runInteractive(ctx: DxContext): Promise<void> {
  const { multiselect, isCancel } = await import("@clack/prompts");
  const options = buildInteractiveOptions(ctx);

  if (options.length === 0) {
    process.stderr.write("No features registered.\n");
    return;
  }

  const selected = await multiselect({
    message: "Feature toggles",
    options: options.map((o) => ({
      value: o.value,
      label: o.label,
      hint: o.hint,
      initialValue: o.initialValue,
    })),
  });

  if (isCancel(selected)) {
    process.stderr.write("dx: cancelled\n");
    return;
  }

  // Compare selected to current state and write local overrides for changes
  const selectedSet = new Set(selected as string[]);
  const localPath = ctx.localPath;
  if (!localPath) {
    process.stderr.write("dx: cannot determine local config path\n");
    return;
  }

  let changed = 0;
  for (const opt of options) {
    const wasEnabled = opt.initialValue;
    const nowEnabled = selectedSet.has(opt.value);
    if (wasEnabled !== nowEnabled) {
      writeLocalOverride(localPath, opt.value, nowEnabled);
      changed++;
    }
  }

  if (changed > 0) {
    // Auto-sync to git config
    autoSync();
    process.stderr.write(`dx: updated ${changed} feature(s)\n`);
  } else {
    process.stderr.write("dx: no changes\n");
  }
}
