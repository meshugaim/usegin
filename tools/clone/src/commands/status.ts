import { Command } from "commander";
import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { CLONES_DIR } from "./list";

export interface StatusInfo {
  name: string;
  path: string;
  branch: string;
  isDirty: boolean;
  ahead: number;
  behind: number;
}

export interface StatusOptions {
  name?: string;
  json?: boolean;
}

export interface StatusDeps {
  listCloneDirectories: () => Promise<string[]>;
  getCloneStatus: (
    name: string
  ) => Promise<{ branch: string; isDirty: boolean; ahead: number; behind: number }>;
  output: (message: string) => void;
}

export function getDefaultDeps(): StatusDeps {
  return {
    listCloneDirectories: async () => {
      if (!existsSync(CLONES_DIR)) {
        return [];
      }
      const entries = await readdir(CLONES_DIR, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    },
    getCloneStatus: async (name: string) => {
      const clonePath = `${CLONES_DIR}/${name}`;

      const branch = await $`git -C ${clonePath} rev-parse --abbrev-ref HEAD`
        .text()
        .then((s) => s.trim());

      const statusOutput = await $`git -C ${clonePath} status --porcelain`.text();
      const isDirty = statusOutput.trim().length > 0;

      // Fetch to ensure we have latest remote info
      await $`git -C ${clonePath} fetch origin main 2>/dev/null`.quiet();

      // Get ahead/behind counts
      let ahead = 0;
      let behind = 0;
      try {
        const aheadBehind = await $`git -C ${clonePath} rev-list --left-right --count HEAD...origin/main 2>/dev/null`
          .text()
          .then((s) => s.trim());
        const [aheadStr, behindStr] = aheadBehind.split(/\s+/);
        ahead = parseInt(aheadStr, 10) || 0;
        behind = parseInt(behindStr, 10) || 0;
      } catch {
        // If origin/main doesn't exist, ahead/behind stay 0
      }

      return { branch, isDirty, ahead, behind };
    },
    output: console.log,
  };
}

export function formatStatusRow(status: StatusInfo): string {
  const state = status.isDirty ? "dirty" : "clean";
  let aheadBehind = "";
  if (status.ahead > 0 || status.behind > 0) {
    const parts: string[] = [];
    if (status.ahead > 0) parts.push(`+${status.ahead}`);
    if (status.behind > 0) parts.push(`-${status.behind}`);
    aheadBehind = parts.join(" ");
  }

  return (
    status.name.padEnd(15) +
    status.branch.padEnd(20) +
    state.padEnd(10) +
    aheadBehind
  );
}

export function formatStatusTable(statuses: StatusInfo[]): string {
  const header =
    "Name".padEnd(15) +
    "Branch".padEnd(20) +
    "Status".padEnd(10) +
    "Ahead/Behind";
  const separator = "-".repeat(60);
  const rows = statuses.map(formatStatusRow);
  return [header, separator, ...rows].join("\n");
}

async function parseStatuses(
  cloneNames: string[],
  getCloneStatus: StatusDeps["getCloneStatus"]
): Promise<StatusInfo[]> {
  const statuses: StatusInfo[] = [];

  for (const name of cloneNames) {
    let branch = "(unknown)";
    let isDirty = false;
    let ahead = 0;
    let behind = 0;

    try {
      const info = await getCloneStatus(name);
      branch = info.branch;
      isDirty = info.isDirty;
      ahead = info.ahead;
      behind = info.behind;
    } catch {
      // Clone might not be a valid git repo
    }

    statuses.push({
      name,
      path: `${CLONES_DIR}/${name}`,
      branch,
      isDirty,
      ahead,
      behind,
    });
  }

  return statuses;
}

export async function runStatus(
  opts: StatusOptions,
  deps: StatusDeps = getDefaultDeps()
): Promise<void> {
  let cloneNames = await deps.listCloneDirectories();

  if (cloneNames.length === 0) {
    deps.output("No clones found");
    return;
  }

  if (opts.name) {
    if (!cloneNames.includes(opts.name)) {
      deps.output(`Clone '${opts.name}' not found`);
      return;
    }
    cloneNames = [opts.name];
  }

  const statuses = await parseStatuses(cloneNames, deps.getCloneStatus);

  if (opts.json) {
    deps.output(JSON.stringify(statuses, null, 2));
  } else {
    deps.output(formatStatusTable(statuses));
  }
}

export function createStatusCommand(): Command {
  return new Command("status")
    .description("Show git status of all or one clone")
    .argument("[name]", "Clone name to check status for")
    .option("--json", "Output as JSON")
    .action(async (name: string | undefined, opts: { json?: boolean }) => {
      await runStatus({ name, json: opts.json });
    });
}
