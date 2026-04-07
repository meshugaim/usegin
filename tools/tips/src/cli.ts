#!/usr/bin/env bun
import { Command } from "commander";
import { join, dirname } from "path";
import { loadTips, pickRandom, formatTipForTerminal } from "./core";

// Resolve the tips directory: from src/ go up to tools/tips/, then into tips/
const tipsDir = join(dirname(import.meta.dir), "tips");

const program = new Command()
  .name("tip")
  .description("DX tip system — surfaces useful 'did you know?' knowledge")
  .version("0.1.0");

// Default action (no subcommand): show a random tip
program.action(() => {
  const tips = loadTips(tipsDir);

  if (tips.length === 0) {
    console.log("No tips found. Add tip files to tools/tips/tips/");
    return;
  }

  const tip = pickRandom(tips);
  if (tip) {
    console.log(formatTipForTerminal(tip));
  }
});

program.parse();
