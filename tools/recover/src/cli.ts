#!/usr/bin/env bun
import { Command } from "commander";
import { createFileCommand } from "./commands/file";
import { createProjectCommand } from "./commands/project";

const program = new Command()
  .name("recover")
  .description(
    "Un-stick sync items that terminated in a failure state. Calls the reset_stuck_sync_item RPC via the Supabase Management API."
  )
  .version("0.1.0");

program.addCommand(createFileCommand());
program.addCommand(createProjectCommand());

program.addHelpText(
  "after",
  `
Examples:
  recover file drive f52c2f20-...-e3747f586d6f -e staging
  recover project f0c450db-...-b3d9787c9ef7 -e staging --entity drive
  recover project f0c450db-...-b3d9787c9ef7 -e production --execute --yes-i-am-sure

Safety defaults:
  - Dry-run by default. Pass --execute to mutate.
  - --env is required (no default — prevents accidental prod writes).
  - --env production + --execute also requires --yes-i-am-sure.

Requires SUPABASE_ACCESS_TOKEN in the environment.
Get a token from https://supabase.com/dashboard/account/tokens.
`
);

// Wrap parse in a try/catch so argument-parsing errors and env-guard errors
// print cleanly without a stack trace.
try {
  await program.parseAsync();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\x1b[31mError:\x1b[0m ${message}`);
  process.exit(1);
}
