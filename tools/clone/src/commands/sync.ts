import { Command } from "commander";
import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { CLONES_DIR } from "./list";

export interface SyncResult {
  name: string;
  success: boolean;
  error?: string;
}

export interface SyncOptions {
  name?: string;
  json?: boolean;
}

export interface SyncDeps {
  listCloneDirectories: () => Promise<string[]>;
  syncClone: (name: string) => Promise<void>;
  output: (message: string) => void;
}

export function getDefaultDeps(): SyncDeps {
  return {
    listCloneDirectories: async () => {
      if (!existsSync(CLONES_DIR)) {
        return [];
      }
      const entries = await readdir(CLONES_DIR, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    },
    syncClone: async (name: string) => {
      const clonePath = `${CLONES_DIR}/${name}`;
      await $`git -C ${clonePath} pull --rebase origin main`.quiet();
    },
    output: console.log,
  };
}

function formatResults(results: SyncResult[]): string {
  return results
    .map((r) => {
      if (r.success) {
        return `${r.name}: synced`;
      }
      return `${r.name}: failed - ${r.error}`;
    })
    .join("\n");
}

export async function runSync(
  opts: SyncOptions,
  deps: SyncDeps = getDefaultDeps()
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

  const results: SyncResult[] = [];

  for (const name of cloneNames) {
    try {
      await deps.syncClone(name);
      results.push({ name, success: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ name, success: false, error });
    }
  }

  if (opts.json) {
    deps.output(JSON.stringify(results, null, 2));
  } else {
    deps.output(formatResults(results));
  }
}

export function createSyncCommand(): Command {
  return new Command("sync")
    .description("Pull latest main in all or one clone")
    .argument("[name]", "Clone name to sync")
    .option("--json", "Output as JSON")
    .action(async (name: string | undefined, opts: { json?: boolean }) => {
      await runSync({ name, json: opts.json });
    });
}
