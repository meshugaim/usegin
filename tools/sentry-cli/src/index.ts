#!/usr/bin/env bun
import { Command } from "commander";
import { $ } from "bun";
import { createEventsCommand } from "./commands/events";
import { createReplayCommand } from "./commands/replay";

const DEFAULT_ORG = "askeffi";

const program = new Command()
  .name("sentry")
  .description("Sentry CLI for issue and event inspection")
  .version("0.1.0");

// Add our custom commands
program.addCommand(createEventsCommand());
program.addCommand(createReplayCommand());

// Passthrough command for anything else - delegates to @sentry/cli
program
  .command("passthrough", { hidden: true, isDefault: true })
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async () => {
    const args = process.argv.slice(2);

    // Commands that benefit from org default
    const orgCommands = ["issues", "releases", "projects"];
    const needsOrg = orgCommands.some((cmd) => args.includes(cmd));

    // Inject org if not provided
    if (needsOrg && !args.includes("-o") && !args.includes("--org")) {
      args.splice(1, 0, "-o", DEFAULT_ORG);
    }

    // Pass through to sentry-cli
    await $`bunx @sentry/cli ${args}`.nothrow();
  });

// Parse arguments
program.parse();
