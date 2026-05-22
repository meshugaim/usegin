#!/usr/bin/env bun
import { Command } from "commander";
import { applyStandardAliases } from "../../lib/standard-aliases";
import { enablePrefixMatching } from "../../lib/commander-prefix";
import { statusCommand } from "./commands/status";
import { upCommand } from "./commands/up";
import { downCommand } from "./commands/down";
import { parkCommand } from "./commands/park";
import { pruneCommand } from "./commands/prune";
import { sshCommand } from "./commands/ssh";
import { workCommand } from "./commands/work";
import { baseCommand } from "./commands/base";

const program = new Command()
  .name("box")
  .description("Devbox fleet lifecycle — start/stop/connect cloud dev boxes by name|id.")
  .version("0.1.0")
  .addHelpText("afterAll", `
Config (env; BOX_* preferred, legacy HETZNER_* honoured):
  BOX_NAME       default box name        (default: effi-devbox)
  BOX_TYPE       hcloud server type      (default: cpx42)
  BOX_LOCATION   hcloud location         (default: nbg1)
  BOX_SSH_KEY    registered ssh-key name (required for 'up')
  BOX_YES=1      skip 'down'/'prune' confirmation

Auth comes from your existing 'hcloud context' (or HCLOUD_TOKEN).`);

program.addCommand(upCommand());
program.addCommand(downCommand());
program.addCommand(parkCommand());
program.addCommand(pruneCommand());
program.addCommand(workCommand());
program.addCommand(sshCommand());
program.addCommand(statusCommand());
program.addCommand(baseCommand());

applyStandardAliases(program);
enablePrefixMatching(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
