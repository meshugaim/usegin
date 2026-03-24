#!/usr/bin/env bun
/**
 * dx CLI -- developer experience configuration.
 *
 * Per-person automation toggles with three-layer merge:
 * default -> user-override -> local-override.
 *
 * Part of: ENG-3442
 */

import { Command } from "commander";
import { buildStatusCommand, buildStatusData, formatStatusJson } from "./commands/status";
import { buildResolveCommand } from "./commands/resolve";
import { buildSyncCommand, autoSync } from "./commands/sync";
import { buildWhoamiCommand } from "./commands/whoami";
import { buildEnableCommand, buildDisableCommand, writeLocalOverride } from "./commands/enable-disable";
import { buildIdentifyCommand } from "./commands/identify";
import { buildListCommand } from "./commands/list";
import { buildDocsCommand } from "./commands/docs";
import { applyStandardAliases } from "../../lib/standard-aliases";
import { enablePrefixMatching } from "../../lib/commander-prefix";
import { isHeadless } from "../../lib/headless";
import { dxShouldOutputJson } from "./output";
import dx from "../sdk";

const program = new Command()
  .name("dx")
  .description(
    "Developer experience configuration -- per-person automation toggles",
  )
  .version("0.1.0");

// Bare `dx` with no args: if headless -> JSON status, if TTY -> interactive picker or help
program.action(async () => {
  const useJson = dxShouldOutputJson();
  if (useJson) {
    // Headless: output JSON status
    const ctx = dx.getContext();
    const data = buildStatusData(ctx);
    process.stdout.write(formatStatusJson(data) + "\n");
  } else if (!isHeadless() && process.stdout.isTTY) {
    // TTY and not headless: show interactive picker
    const { buildInteractiveOptions } = await import("./commands/interactive");
    const { multiselect, isCancel } = await import("@clack/prompts");
    const ctx = dx.getContext();
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
  } else {
    program.help();
  }
});

program.addCommand(buildStatusCommand());
program.addCommand(buildResolveCommand());
program.addCommand(buildSyncCommand());
program.addCommand(buildWhoamiCommand());
program.addCommand(buildEnableCommand());
program.addCommand(buildDisableCommand());
program.addCommand(buildIdentifyCommand());
program.addCommand(buildListCommand());
program.addCommand(buildDocsCommand());

applyStandardAliases(program);
enablePrefixMatching(program);
program.parse();
