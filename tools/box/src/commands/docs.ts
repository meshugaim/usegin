// Thin wrapper over shared docs utilities, bound to box's paths and name.
//
// All core logic lives in tools/docs-registry/src/shared.ts. This module
// re-exports the shared types and pure functions, and provides zero-arg
// wrappers for the functions that need box-specific configuration
// (docs directory, CLI name). Mirrors tools/e2e/src/commands/docs.ts.

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

// ─── Box-specific wiring ────────────────────────────────────────────────────

/** Resolve docs directory relative to this CLI's package root (tools/box/docs). */
function getDocsDir(internal = false): string {
  const base = join(dirname(import.meta.dir), "..", "docs");
  return internal ? join(base, "internal") : base;
}

/** Load user + internal docs from box's docs directory. */
export function loadAllDocs() {
  return loadSharedAllDocs(getDocsDir);
}

/** Compact docs summary for box's `--help` output (no parameters). */
export function getDocsHelpText(): string {
  return getSharedDocsHelpText("box", getDocsDir);
}

/** Create the `docs` command wired to box's name and docs directory. */
export function docsCommand() {
  return createSharedDocsCommand("box", getDocsDir);
}
