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
import { applyStandardAliases } from "../../lib/standard-aliases";
import { enablePrefixMatching } from "../../lib/commander-prefix";
import { dxShouldOutputJson } from "./output";
import dx from "../sdk";

const program = new Command()
  .name("dx")
  .description(
    "Developer experience configuration -- per-person automation toggles",
  )
  .version("0.1.0");

// Bare `dx` with no args: if headless -> JSON status, if TTY -> show help
program.action(() => {
  const useJson = dxShouldOutputJson();
  if (useJson) {
    // Headless: output JSON status
    const ctx = dx.getContext();
    const data = buildStatusData(ctx);
    process.stdout.write(formatStatusJson(data) + "\n");
  } else {
    program.help();
  }
});

program.addCommand(buildStatusCommand());
program.addCommand(buildResolveCommand());
program.addCommand(buildSyncCommand());
program.addCommand(buildWhoamiCommand());

applyStandardAliases(program);
enablePrefixMatching(program);
program.parse();
