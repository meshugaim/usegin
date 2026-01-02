#!/usr/bin/env bun
import { Command } from "commander";
import { createSpawnCommand } from "./commands/spawn";
import { createListCommand } from "./commands/list";
import { createStatusCommand } from "./commands/status";
import { createTailCommand } from "./commands/tail";
import { createSendCommand } from "./commands/send";
import { createKillCommand } from "./commands/kill";

const program = new Command()
  .name("crun")
  .description("CLI for spawning and managing background Claude processes")
  .version("0.1.0");

program.addCommand(createSpawnCommand());
program.addCommand(createListCommand());
program.addCommand(createStatusCommand());
program.addCommand(createTailCommand());
program.addCommand(createSendCommand());
program.addCommand(createKillCommand());

program.parse();
