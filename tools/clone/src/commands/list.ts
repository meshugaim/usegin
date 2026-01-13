import { Command } from "commander";
import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

export const CLONES_DIR = ".clones";

export interface CloneInfo {
  name: string;
  path: string;
  branch: string;
  commit: string;
}

export interface ListOptions {
  json?: boolean;
}

export interface ListDeps {
  listCloneDirectories: () => Promise<string[]>;
  getCloneGitInfo: (name: string) => Promise<{ branch: string; commit: string }>;
  output: (message: string) => void;
}

export function getDefaultDeps(): ListDeps {
  return {
    listCloneDirectories: async () => {
      if (!existsSync(CLONES_DIR)) {
        return [];
      }
      const entries = await readdir(CLONES_DIR, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    },
    getCloneGitInfo: async (name: string) => {
      const clonePath = `${CLONES_DIR}/${name}`;
      const branch = await $`git -C ${clonePath} rev-parse --abbrev-ref HEAD`
        .text()
        .then((s) => s.trim());
      const commit = await $`git -C ${clonePath} rev-parse HEAD`
        .text()
        .then((s) => s.trim());
      return { branch, commit };
    },
    output: console.log,
  };
}

export function createListCommand(): Command {
  return new Command("list")
    .alias("ls")
    .description("List all clones")
    .option("--json", "Output as JSON")
    .action(async (opts: ListOptions) => {
      await runList(opts);
    });
}

export async function parseClones(
  listCloneDirectories: () => Promise<string[]>,
  getCloneGitInfo: (
    name: string
  ) => Promise<{ branch: string; commit: string }> = async () => ({
    branch: "(unknown)",
    commit: "(unknown)",
  })
): Promise<CloneInfo[]> {
  const directories = await listCloneDirectories();
  const clones: CloneInfo[] = [];

  for (const name of directories) {
    let branch = "(unknown)";
    let commit = "(unknown)";

    try {
      const info = await getCloneGitInfo(name);
      branch = info.branch;
      commit = info.commit;
    } catch {
      // Clone might not be a valid git repo
    }

    clones.push({
      name,
      path: `${CLONES_DIR}/${name}`,
      branch,
      commit,
    });
  }

  return clones;
}

export function formatTableRow(clone: CloneInfo): string {
  return (
    clone.name.padEnd(15) +
    clone.branch.padEnd(20) +
    clone.commit.substring(0, 7)
  );
}

export function formatTable(clones: CloneInfo[]): string {
  const header = "Name".padEnd(15) + "Branch".padEnd(20) + "Commit";
  const separator = "-".repeat(50);
  const rows = clones.map(formatTableRow);
  return [header, separator, ...rows].join("\n");
}

export async function runList(
  opts: ListOptions,
  deps: ListDeps = getDefaultDeps()
): Promise<void> {
  const clones = await parseClones(
    deps.listCloneDirectories,
    deps.getCloneGitInfo
  );

  if (clones.length === 0) {
    deps.output("No clones found");
    return;
  }

  if (opts.json) {
    deps.output(JSON.stringify(clones, null, 2));
  } else {
    deps.output(formatTable(clones));
  }
}
