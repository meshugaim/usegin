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
import { buildSyncCommand } from "./commands/sync";
import { buildWhoamiCommand } from "./commands/whoami";
import { buildEnableCommand, buildDisableCommand } from "./commands/enable-disable";
import { buildSetCommand } from "./commands/set";
import { buildResetCommand } from "./commands/reset";
import { buildIdentifyCommand } from "./commands/identify";
import { buildListCommand } from "./commands/list";
import { buildDocsCommand } from "./commands/docs";
import { buildHisCommand } from "./his";
import { applyStandardAliases } from "../../lib/standard-aliases";
import { enablePrefixMatching } from "../../lib/commander-prefix";
import { dxShouldOutputJson } from "./output";
import dx from "../sdk";

const program = new Command()
  .name("dx")
  .description(
    "Developer experience configuration -- per-person automation toggles",
  )
  .version("0.1.0")
  .enablePositionalOptions()
  .option("--save", "Persist changes to config.json (personal override)");

// Bare `dx` with no args: if headless -> JSON status, if TTY -> interactive picker or help
program.action(async () => {
  const useJson = dxShouldOutputJson();
  if (useJson) {
    // Headless: output JSON status
    const ctx = dx.getContext();
    const data = buildStatusData(ctx);
    process.stdout.write(formatStatusJson(data) + "\n");
  } else if (process.stdout.isTTY) {
    // TTY: show interactive picker
    // (isTTY being true implies not headless — isHeadless() requires !isTTY)
    const { runInteractive } = await import("./commands/interactive");
    const ctx = dx.getContext();
    await runInteractive(ctx, program.opts().save);
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
program.addCommand(buildSetCommand());
program.addCommand(buildResetCommand());
program.addCommand(buildIdentifyCommand());
program.addCommand(buildListCommand());
program.addCommand(buildDocsCommand());
program.addCommand(buildHisCommand());

applyStandardAliases(program);
enablePrefixMatching(program);
program.parse();
