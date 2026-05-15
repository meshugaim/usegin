import { Command } from "commander";
import {
  formatHumanTable,
  formatJson,
  joinFleet,
  readJobsRegistry,
  readSessionsRegistry,
  type FleetRow,
} from "./core";
import { buildFleetSnapshotCommand } from "./commands/snapshot";
import { dxShouldOutputJson } from "../output";

export interface FleetOptions {
  json?: boolean;
  onlyBlocked?: boolean;
  includeCwd?: string;
}

export function runFleet(opts: FleetOptions): {
  rows: FleetRow[];
  now: Date;
} {
  const home = process.env.HOME ?? "";
  if (!home) throw new Error("dx fleet: $HOME is unset");
  const now = new Date();
  const jobs = readJobsRegistry(home);
  const sessions = readSessionsRegistry(home);
  let rows = joinFleet(jobs, sessions, now);
  if (opts.onlyBlocked) rows = rows.filter((r) => r.state === "blocked");
  if (opts.includeCwd) {
    const prefix = opts.includeCwd;
    rows = rows.filter((r) => r.cwd.startsWith(prefix));
  }
  return { rows, now };
}

export function buildFleetCommand(): Command {
  const cmd = new Command("fleet")
    .description(
      "Live view of running Claude/Gin agent jobs from the local jobs/ and sessions/ registries.",
    )
    .option("--json", "Force JSON output to stdout")
    .option("--only-blocked", "Only show rows with state=blocked")
    .option(
      "--include-cwd <prefix>",
      "Only show rows whose cwd starts with this prefix",
    )
    .action((opts: FleetOptions) => {
      const useJson = dxShouldOutputJson({ json: opts.json });
      const { rows, now } = runFleet(opts);
      if (useJson) {
        process.stdout.write(formatJson(rows, now) + "\n");
      } else {
        process.stderr.write(formatHumanTable(rows) + "\n");
      }
    });
  cmd.addCommand(buildFleetSnapshotCommand());
  return cmd;
}
