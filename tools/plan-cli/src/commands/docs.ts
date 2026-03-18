// Thin wrapper over shared docs utilities, bound to plan-cli's paths and name.
//
// All core logic lives in tools/docs-registry/src/shared.ts. This module
// re-exports the shared types and pure functions, and provides zero-arg
// wrappers for the functions that need plan-cli-specific configuration
// (docs directory, CLI name).

import { join, dirname } from "path";
import {
  createDocsCommand as createSharedDocsCommand,
  getDocsHelpText as getSharedDocsHelpText,
  loadAllDocs as loadSharedAllDocs,
} from "../../../docs-registry/src/shared";

// ─── Re-exports (types + pure functions) ────────────────────────────────────

export {
  type DocMeta,
  type Doc,
  parseFrontmatter,
  loadDocsFromDir,
  findDoc,
  formatDocsList,
} from "../../../docs-registry/src/shared";

// ─── Plan-cli-specific wiring ───────────────────────────────────────────────

/** Resolve docs directory relative to this CLI's package root. */
function getDocsDir(internal = false): string {
  const base = join(dirname(import.meta.dir), "..", "docs");
  return internal ? join(base, "internal") : base;
}

/** Load user + internal docs from plan-cli's docs directory. */
export function loadAllDocs() {
  return loadSharedAllDocs(getDocsDir);
}

/** Compact docs summary for plan-cli's `--help` output (no parameters). */
export function getDocsHelpText(): string {
  return getSharedDocsHelpText("plan", getDocsDir);
}

/** Create the `docs` command wired to plan-cli's name and docs directory. */
export function createDocsCommand() {
  return createSharedDocsCommand("plan", getDocsDir);
}
