/**
 * dx docs — browse embedded documentation.
 *
 * Thin wrapper over the shared docs-registry. All core logic lives in
 * tools/docs-registry/src/shared.ts. This module provides dx-specific
 * configuration (docs directory, CLI name) and builds the Commander command
 * using the local Commander version (v14) for compatibility with the parent
 * program — the same approach effi-cli uses.
 *
 * Part of: ENG-3473
 */

import { Command } from "commander";
import { join, dirname } from "path";
import {
  loadAllDocs as loadSharedAllDocs,
  findDoc,
} from "../../../docs-registry/src/shared";
import type { Doc } from "../../../docs-registry/src/shared";

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

// ─── dx-specific wiring ─────────────────────────────────────────────────────

const CLI_NAME = "dx";

/** Resolve docs directory relative to this CLI's package root. */
function getDocsDir(internal = false): string {
  const base = join(dirname(import.meta.dir), "..", "docs");
  return internal ? join(base, "internal") : base;
}

/** Load user + internal docs from dx's docs directory. */
export function loadAllDocs() {
  return loadSharedAllDocs(getDocsDir);
}

// ─── Commander integration (local Command for version compat) ────────────────

/** Format and print a list of docs with ANSI colors. Returns next number. */
function formatAndPrint(docs: Doc[], startNum = 1): number {
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const num = (startNum + i).toString().padStart(2);
    const typeTag = `[${doc.meta.type}]`;

    console.log(`${cyan(num)}  ${doc.meta.name.padEnd(58)} ${dim(typeTag)}`);
    console.log(dim(`    ${doc.meta.context}`));

    if (i < docs.length - 1) {
      console.log();
    }
  }
  return startNum + docs.length;
}

/**
 * Build the `dx docs` Commander command using the shared docs-registry
 * for data loading and the local Commander for command construction.
 *
 * Provides `dx docs` (list), `dx docs show <handle>`, and `dx docs list`.
 */
export function buildDocsCommand(): Command {
  function runList(): void {
    const { user, internal } = loadAllDocs();

    if (user.length === 0 && internal.length === 0) {
      console.log(dim("No docs found."));
      console.log(dim(`Add docs to: ${getDocsDir()}`));
      return;
    }

    let nextNum = 1;

    if (user.length > 0) {
      nextNum = formatAndPrint(user, nextNum);
    }

    if (internal.length > 0) {
      if (user.length > 0) {
        console.log();
      }
      console.log(dim("─── internal ───"));
      console.log();
      nextNum = formatAndPrint(internal, nextNum);
    }

    console.log();
    console.log(dim(`Use: ${CLI_NAME} docs show <handle|number>`));
  }

  const listCmd = new Command("list")
    .alias("ls")
    .description("List available docs")
    .action(() => {
      runList();
    });

  const showCmd = new Command("show")
    .alias("get")
    .description("Show a doc by handle or number")
    .argument("<ref>", "Doc handle or number from list")
    .action((ref: string) => {
      const { user, internal } = loadAllDocs();
      const allDocs = [...user, ...internal];
      const doc = findDoc(ref, allDocs);

      if (!doc) {
        console.error(`Doc not found: ${ref}\n`);
        if (allDocs.length > 0) {
          console.error("Available docs:");
          for (let i = 0; i < allDocs.length; i++) {
            console.error(dim(`  ${i + 1}  ${allDocs[i].meta.handle}`));
          }
        } else {
          console.error(dim("No docs available."));
        }
        process.exit(1);
      }

      console.log(doc.content);
    });

  const cmd = new Command("docs")
    .description("Browse embedded documentation")
    .addCommand(listCmd)
    .addCommand(showCmd);

  cmd.action(() => {
    runList();
  });

  return cmd;
}
