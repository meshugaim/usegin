import { Command } from "commander";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { readCheckoutMeta, hashDescription } from "../lib/checkout-meta";

const DEFAULT_CHECKOUT_DIR = "/tmp/linear/";

interface CheckoutStatus {
  identifier: string;
  path: string;
  modified: boolean;
  fetchedAt: string;
}

export function createStatusCommand(): Command {
  const cmd = new Command("status")
    .description("Show status of checked-out issue descriptions")
    .option("--json", "Output as JSON")
    .option("--quiet", "No output on success")
    .action(async (opts) => {
      await runStatus(opts);
    });

  return cmd;
}

async function runStatus(opts: {
  json?: boolean;
  quiet?: boolean;
}): Promise<void> {
  const baseDir = process.env.PLAN_CHECKOUT_DIR ?? DEFAULT_CHECKOUT_DIR;

  const checkouts: CheckoutStatus[] = [];

  if (existsSync(baseDir)) {
    const entries = readdirSync(baseDir);

    for (const entry of entries) {
      const issueDir = join(baseDir, entry);

      // Skip non-directories
      try {
        if (!statSync(issueDir).isDirectory()) continue;
      } catch {
        continue;
      }

      // Read meta — null means missing or corrupted, skip
      const meta = readCheckoutMeta(issueDir);
      if (!meta) continue;

      // Read description.md and compute hash
      const descPath = join(issueDir, "description.md");
      let modified = false;
      try {
        const description = readFileSync(descPath, "utf-8");
        const currentHash = hashDescription(description);
        modified = currentHash !== meta.descriptionHash;
      } catch {
        // If description.md is missing, treat as modified
        modified = true;
      }

      checkouts.push({
        identifier: meta.identifier,
        path: issueDir,
        modified,
        fetchedAt: meta.fetchedAt,
      });
    }
  }

  if (opts.quiet) {
    return;
  }

  // Status is a local-only informational command — default to human output.
  // Only use JSON when explicitly requested via --json or PLAN_OUTPUT=json.
  const outputVar = process.env.PLAN_OUTPUT?.toLowerCase();
  const useJson = opts.json === true || outputVar === "json";

  if (useJson) {
    console.log(JSON.stringify({ checkouts }, null, 2));
    return;
  }

  // Human output
  if (checkouts.length === 0) {
    console.log("No issues checked out");
    return;
  }

  for (const checkout of checkouts) {
    const state = checkout.modified ? "modified" : "clean";
    console.log(`${checkout.identifier}  ${state}  ${checkout.path}`);
  }
}
