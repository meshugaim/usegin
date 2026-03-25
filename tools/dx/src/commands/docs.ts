/**
 * dx docs — browse embedded documentation.
 *
 * Thin wrapper over the shared docs-registry factory. All core logic lives
 * in tools/docs-registry/src/shared.ts.
 *
 * Part of: ENG-3473
 */

import { join, dirname } from "path";
import { createDocsCommand } from "../../../docs-registry/src/shared";

const CLI_NAME = "dx";

/** Resolve docs directory relative to this CLI's package root. */
function getDocsDir(internal = false): string {
  const base = join(dirname(import.meta.dir), "..", "docs");
  return internal ? join(base, "internal") : base;
}

/**
 * Build the `dx docs` Commander command using the shared docs-registry.
 *
 * Provides `dx docs` (list), `dx docs show <handle>`, and `dx docs list`.
 */
export function buildDocsCommand() {
  return createDocsCommand(CLI_NAME, getDocsDir);
}
