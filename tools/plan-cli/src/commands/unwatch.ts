import { Command } from "commander";
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { normalizeIssueId } from "../lib/identifier";
import { shouldDefaultToJson } from "../lib/output-mode";
import { readCheckoutMeta, writeCheckoutMeta } from "../lib/checkout-meta";

const DEFAULT_CHECKOUT_DIR = "/tmp/linear/";

export function createUnwatchCommand(): Command {
  const cmd = new Command("unwatch")
    .description("Stop watching a checked-out issue description")
    .argument("[id]", "Issue identifier (e.g., ENG-123 or just 123)")
    .option("--all", "Stop watching all issues")
    .option("--json", "Output as JSON")
    .action(async (id: string | undefined, opts) => {
      if (opts.all) {
        await runUnwatchAll(opts);
      } else if (id) {
        await runUnwatch(normalizeIssueId(id), opts);
      } else {
        console.error("Error: provide an issue identifier or use --all");
        process.exit(1);
      }
    });

  return cmd;
}

async function runUnwatch(
  identifier: string,
  opts: { json?: boolean }
): Promise<void> {
  const baseDir = process.env.PLAN_CHECKOUT_DIR ?? DEFAULT_CHECKOUT_DIR;
  const issueDir = join(baseDir, identifier);

  const meta = readCheckoutMeta(issueDir);
  if (!meta) {
    console.error(`Error: No checkout found for ${identifier}`);
    process.exit(1);
  }

  if (!meta.watcherPid) {
    console.log(`${identifier} is not being watched`);
    return;
  }

  // Try to kill the watcher process
  tryKill(meta.watcherPid);

  // Clear watcherPid from meta
  const { watcherPid: _, ...rest } = meta;
  writeCheckoutMeta(issueDir, rest);

  // Output
  const useJson = shouldDefaultToJson({
    json: opts.json,
    env: process.env,
    isTTY: process.stdout.isTTY,
  });

  if (useJson) {
    console.log(
      JSON.stringify(
        {
          identifier,
          stopped: true,
        },
        null,
        2
      )
    );
  } else {
    console.log(`Stopped watching ${identifier}`);
  }
}

async function runUnwatchAll(opts: { json?: boolean }): Promise<void> {
  const baseDir = process.env.PLAN_CHECKOUT_DIR ?? DEFAULT_CHECKOUT_DIR;
  const stopped: string[] = [];

  if (existsSync(baseDir)) {
    const entries = readdirSync(baseDir);

    for (const entry of entries) {
      const issueDir = join(baseDir, entry);

      try {
        if (!statSync(issueDir).isDirectory()) continue;
      } catch {
        continue;
      }

      const meta = readCheckoutMeta(issueDir);
      if (!meta) continue;

      if (meta.watcherPid) {
        tryKill(meta.watcherPid);
        const { watcherPid: _, ...rest } = meta;
        writeCheckoutMeta(issueDir, rest);
        stopped.push(meta.identifier);
      }
    }
  }

  // Output
  const useJson = shouldDefaultToJson({
    json: opts.json,
    env: process.env,
    isTTY: process.stdout.isTTY,
  });

  if (useJson) {
    console.log(
      JSON.stringify(
        {
          stopped: stopped.map((id) => ({ identifier: id, stopped: true })),
        },
        null,
        2
      )
    );
  } else {
    if (stopped.length === 0) {
      console.log("No issues were being watched");
    } else {
      for (const id of stopped) {
        console.log(`Stopped watching ${id}`);
      }
    }
  }
}

/**
 * Attempt to kill a process by PID. Silently ignores errors
 * (process may already be dead).
 */
function tryKill(pid: number): void {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Process already dead — that's fine
  }
}
