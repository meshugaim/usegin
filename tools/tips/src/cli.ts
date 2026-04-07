#!/usr/bin/env bun
import { Command } from "commander";
import { join, dirname } from "path";
import {
  loadTips,
  pickRandom,
  formatTipForTerminal,
  filterByTag,
  searchTips,
  findByRef,
  formatTipList,
  allTags,
} from "./core";

// Resolve the tips directory: from src/ go up to tools/tips/, then into tips/
const tipsDir = join(dirname(import.meta.dir), "tips");

/** Load tips or exit cleanly when none exist. Shared across all subcommands. */
function loadTipsOrExit(): import("./core").Tip[] {
  const tips = loadTips(tipsDir);
  if (tips.length === 0) {
    console.log("No tips found. Add tip files to tools/tips/tips/");
    process.exit(0);
  }
  return tips;
}

const program = new Command()
  .name("tip")
  .description("DX tip system — surfaces useful 'did you know?' knowledge")
  .version("0.1.0");

// ── list ────────────────────────────────────────────────────────────────────

program
  .command("list")
  .description("Show all tips as a numbered list")
  .action(() => {
    const tips = loadTipsOrExit();
    console.log(formatTipList(tips));
  });

// ── show ────────────────────────────────────────────────────────────────────

program
  .command("show <ref>")
  .description("Show a specific tip by handle or list number")
  .action((ref: string) => {
    const tips = loadTipsOrExit();
    const tip = findByRef(tips, ref);

    if (!tip) {
      console.error(`Tip not found: ${ref}`);
      process.exit(1);
    }

    console.log(formatTipForTerminal(tip));
  });

// ── search ──────────────────────────────────────────────────────────────────

program
  .command("search <term>")
  .description("Search tips across title, handle, tags, context, and body")
  .action((term: string) => {
    const tips = loadTipsOrExit();
    const matches = searchTips(tips, term);

    if (matches.length === 0) {
      console.log(`No tips found matching "${term}".`);
      return;
    }

    console.log(formatTipList(matches));
  });

// ── default action (no subcommand) ─────────────────────────────────────────

// When a positional argument is given that isn't a known subcommand,
// treat it as a topic (tag filter).
program
  .argument("[topic]", "Filter tips by tag")
  .action((topic?: string) => {
    const tips = loadTipsOrExit();

    if (!topic) {
      // No argument: show a random tip
      const tip = pickRandom(tips);
      if (tip) {
        console.log(formatTipForTerminal(tip));
      }
      return;
    }

    // Topic given: filter by tag
    const matches = filterByTag(tips, topic);

    if (matches.length === 0) {
      const tags = allTags(tips);
      console.log(
        `No tips found for "${topic}". Try: tip list\n\nAvailable tags: ${tags.join(", ")}`,
      );
      return;
    }

    const tip = pickRandom(matches);
    if (tip) {
      console.log(formatTipForTerminal(tip));
    }
  });

program.parse();
