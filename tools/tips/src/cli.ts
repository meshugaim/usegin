#!/usr/bin/env bun
import { Command } from "commander";
import { join, dirname } from "path";
import { readFileSync, writeFileSync } from "fs";
import {
  loadTips,
  pickRandom,
  formatTipForTerminal,
  filterByTag,
  searchTips,
  findByRef,
  formatTipList,
  allTags,
  parseDuration,
  resolveStatusline,
} from "./core";
import type { StatuslineState } from "./core";

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

// ── statusline ─────────────────────────────────────────────────────────────

const STATE_FILE = "/tmp/tip-statusline-state.json";

/** Shell out to `dx resolve <param>` and return the parsed JSON value, or null on failure. */
function dxResolve(param: string): unknown {
  try {
    const result = Bun.spawnSync({
      cmd: ["dx", "resolve", param],
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) return null;
    const raw = result.stdout.toString().trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Read the statusline state file, returning null if missing or corrupt. */
function readStateFile(): StatuslineState | null {
  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw) as StatuslineState;
  } catch {
    return null;
  }
}

/** Atomically write the statusline state file. */
function writeStateFile(state: StatuslineState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state) + "\n");
}

program
  .command("statusline")
  .description("Return a one-liner tip for the status line (or empty)")
  .action(() => {
    // 1. Check if tips are enabled via dx
    const enabledRaw = dxResolve("tips.enabled");
    const enabled = enabledRaw === null ? true : Boolean(enabledRaw);

    // 2. Read persisted state
    const state = readStateFile();

    // 3. Resolve show/rest durations from dx (defaults: 10m, 2h)
    const showRaw = dxResolve("tips.show-duration");
    const restRaw = dxResolve("tips.rest-duration");
    const showDuration =
      (typeof showRaw === "string" ? parseDuration(showRaw) : null) ?? 600_000;
    const restDuration =
      (typeof restRaw === "string" ? parseDuration(restRaw) : null) ??
      7_200_000;

    // 4. Load tips
    const tips = loadTips(tipsDir);

    // 5. Resolve the state machine
    const result = resolveStatusline({
      now: Date.now(),
      state,
      tips,
      showDuration,
      restDuration,
      enabled,
    });

    // 6. Write new state
    writeStateFile(result.newState);

    // 7. Print output (may be empty)
    if (result.output) {
      console.log(result.output);
    }
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
