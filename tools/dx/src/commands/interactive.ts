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

import { getFeature, resolveUser, type DxContext } from "../core";
import { writeLocalOverride, writeUserOverride } from "./enable-disable";
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

    // Append source info to the hint for overridden features so the user
    // knows *why* a feature is on/off (and where the override lives).
    let hint = featureDef.description;
    if (info.source === "user-override") {
      hint += " (personal)";
    } else if (info.source === "local-override") {
      hint += " (local)";
    }

    return {
      value: name,
      label: name,
      hint,
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
  return {
    options: options.map((o) => ({
      value: o.value,
      label: `${o.label} — ${o.hint}`,
    })),
    initialValues: options
      .filter((o) => o.initialValue)
      .map((o) => o.value),
  };
}

/**
 * Run the interactive feature toggle picker.
 *
 * Presents a multiselect prompt, diffs against current state,
 * writes overrides for any changes, and auto-syncs to git config.
 *
 * When `save` is true, persists changes as user overrides in config.json
 * (requires a resolved user identity). Falls back to local overrides
 * with a warning if the user cannot be identified.
 */
export async function runInteractive(
  ctx: DxContext,
  save = false,
): Promise<void> {
  const { multiselect, isCancel } = await import("@clack/prompts");
  const options = buildInteractiveOptions(ctx);

  if (options.length === 0) {
    process.stderr.write("No features registered.\n");
    return;
  }

  const config = buildMultiselectConfig(options);
  const selected = await multiselect({
    message: "Feature toggles",
    ...config,
  });

  if (isCancel(selected)) {
    process.stderr.write("dx: cancelled\n");
    return;
  }

  // Determine write target: --save writes to config.json (user override),
  // otherwise writes to config.local.json (local override).
  let useSave = save;
  let user: string | null = null;

  if (useSave) {
    user = resolveUser(ctx);
    if (!user) {
      process.stderr.write(
        "dx: cannot --save: user not identified. Run `dx identify` first.\n",
      );
      process.stderr.write("dx: writing to local config instead.\n");
      useSave = false;
    } else if (!ctx.configPath) {
      process.stderr.write(
        "dx: cannot --save: configPath not set in context.\n",
      );
      process.stderr.write("dx: writing to local config instead.\n");
      useSave = false;
    }
  }

  // Resolve localPath up front so we can fail early if needed.
  const localPath = ctx.localPath;
  if (!useSave && !localPath) {
    process.stderr.write("dx: cannot determine local config path\n");
    return;
  }

  // Compare selected to current state and write overrides for changes
  const selectedSet = new Set(selected as string[]);
  let changed = 0;

  for (const opt of options) {
    const wasEnabled = opt.initialValue;
    const nowEnabled = selectedSet.has(opt.value);
    if (wasEnabled !== nowEnabled) {
      if (useSave) {
        writeUserOverride(ctx.configPath!, user!, opt.value, nowEnabled);
      } else {
        writeLocalOverride(localPath!, opt.value, nowEnabled);
      }
      changed++;
    }
  }

  if (changed > 0) {
    autoSync();
    if (useSave) {
      process.stderr.write(`dx: updated ${changed} feature(s) (saved to config.json)\n`);
    } else {
      process.stderr.write(`dx: updated ${changed} feature(s) (local)\n`);
      process.stderr.write("    To persist: use dx enable/disable <feature> --save\n");
    }
  } else {
    process.stderr.write("dx: no changes\n");
  }
}
