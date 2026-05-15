import { Command } from "commander";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  applyFleetFilters,
  defaultSnapshotPath,
  findRepoRoot,
  formatSnapshotMarkdown,
  joinFleet,
  readJobsRegistry,
  readSessionsRegistry,
} from "../core";

export interface SnapshotOptions {
  output?: string;
  onlyBlocked?: boolean;
  includeCwd?: string;
}

export function runSnapshot(opts: SnapshotOptions): string {
  const home = process.env.HOME ?? "";
  if (!home) throw new Error("dx fleet snapshot: $HOME is unset");
  const now = new Date();
  const jobs = readJobsRegistry(home);
  const sessions = readSessionsRegistry(home);
  const rows = applyFleetFilters(joinFleet(jobs, sessions, now), opts);
  const md = formatSnapshotMarkdown(rows, now.toISOString());
  let outPath = opts.output;
  if (!outPath) {
    const repoRoot = findRepoRoot();
    outPath = defaultSnapshotPath(repoRoot, now);
  }
  const absOut = isAbsolute(outPath) ? outPath : resolve(process.cwd(), outPath);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, md);
  // Refresh the stable-name "latest.md" pointer next to the timestamped file,
  // so `cat .../fleet-snapshots/latest.md` always works without typing an ISO.
  // .gitignored — local convenience only; the timestamped file is the committed record.
  writeFileSync(join(dirname(absOut), "latest.md"), md);
  return absOut;
}

export function buildFleetSnapshotCommand(): Command {
  return new Command("snapshot")
    .description(
      "Write a markdown snapshot of the current fleet; prints the path to stdout.",
    )
    .option(
      "--output <path>",
      "Output path (default: usegin/memento/scopes/fleet-snapshots/<iso>.md)",
    )
    .option("--only-blocked", "Only include rows with state=blocked")
    .option(
      "--include-cwd <prefix>",
      "Only include rows whose cwd starts with this prefix",
    )
    .action((opts: SnapshotOptions) => {
      const path = runSnapshot(opts);
      process.stdout.write(path + "\n");
    });
}
