/**
 * dx (bare, TTY) — interactive feature picker.
 *
 * Exports pure data transformation functions for building the
 * interactive multiselect options. The actual UI uses @clack/prompts
 * and is tested at the integration level, not here.
 *
 * Part of: ENG-3443
 */

import type { DxContext } from "../core";

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
  _ctx: DxContext,
): InteractiveOption[] {
  throw new Error("Not implemented");
}
