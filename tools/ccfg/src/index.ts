#!/usr/bin/env bun
import { Command } from "commander";
import { createMcpCommand } from "./commands/mcp";
import { createAutocompactCommand } from "./commands/autocompact";

const program = new Command()
  .name("ccfg")
  .description("Claude Code config helper CLI")
  .version("0.1.0");

// Add commands
program.addCommand(createMcpCommand());
program.addCommand(createAutocompactCommand());

// Parse arguments
program.parse();
