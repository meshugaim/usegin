import { Command } from "commander";
import { readFileSync } from "fs";
import { join } from "path";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";
import { normalizeIssueId } from "../lib/identifier";
import { shouldDefaultToJson } from "../lib/output-mode";
import {
  writeCheckoutMeta,
  readCheckoutMeta,
  hashDescription,
} from "../lib/checkout-meta";
import { parseMeta, buildMetaDescription, type PlanMeta } from "../lib/plan-meta";

const DEFAULT_CHECKOUT_DIR = "/tmp/linear/";

export function createPushCommand(): Command {
  const cmd = new Command("push")
    .description("Push local description changes back to Linear")
    .argument("<id>", "Issue identifier (e.g., ENG-123 or just 123)")
    .option("--json", "Output as JSON")
    .option("--quiet", "No output on success")
    .option("--stats", "Show API call statistics")
    .action(async (id: string, opts) => {
      await runPush(normalizeIssueId(id), opts);
    });

  return cmd;
}

async function runPush(
  identifier: string,
  opts: {
    json?: boolean;
    quiet?: boolean;
    stats?: boolean;
  }
): Promise<void> {
  const baseDir = process.env.PLAN_CHECKOUT_DIR ?? DEFAULT_CHECKOUT_DIR;
  const issueDir = join(baseDir, identifier);

  // Check if checkout exists
  const meta = readCheckoutMeta(issueDir);
  if (!meta) {
    console.error(`Error: No checkout found for ${identifier}`);
    process.exit(1);
  }

  try {
    // Read the local description file
    const descPath = join(issueDir, "description.md");
    const description = readFileSync(descPath, "utf-8");

    // Check if there are changes to push
    const currentHash = hashDescription(description);
    if (currentHash === meta.descriptionHash) {
      if (!opts.quiet) {
        console.error(`No changes to push for ${identifier}`);
      }
      process.exit(0);
    }

    // Need API key for pushing
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      console.error("Error: LINEAR_API_KEY environment variable is required");
      console.error("Get your API key from: https://linear.app/settings/api");
      process.exit(2);
    }

    const client = new LinearClient({ apiKey });

    // Check staleness: fetch the issue and compare updatedAt to fetchedAt
    let stale = false;
    let existingMeta: PlanMeta | null = null;
    try {
      const issue = await client.getIssueByIdentifier(identifier);
      if (issue && issue.updatedAt) {
        const remoteUpdatedAt = new Date(issue.updatedAt).getTime();
        const localFetchedAt = new Date(meta.fetchedAt).getTime();
        if (remoteUpdatedAt > localFetchedAt) {
          stale = true;
          console.error(
            `Warning: ${identifier} has been updated on Linear since your checkout. Pushing anyway.`
          );
        }
      }
      if (issue) {
        existingMeta = parseMeta(issue.description ?? "").meta;
      }
    } catch {
      // If we can't fetch the issue for staleness check, proceed anyway
    }

    // Build the final description with meta if applicable
    let finalDescription = buildMetaDescription(description, existingMeta);

    // Push the description to Linear
    await client.updateIssue(identifier, { description: finalDescription });

    // Update meta with new hash and pushedAt
    const pushedAt = new Date().toISOString();
    writeCheckoutMeta(issueDir, {
      ...meta,
      descriptionHash: currentHash,
      fetchedAt: pushedAt, // Reset fetchedAt to avoid false staleness on next push
      pushedAt,
    });

    const bytes = Buffer.byteLength(description, "utf-8");

    // Output
    if (opts.quiet) {
      // No output
    } else {
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
              bytes,
              stale,
              pushedAt,
            },
            null,
            2
          )
        );
      } else {
        console.log(
          `Pushed ${identifier} description (${bytes} bytes)`
        );
      }
    }

    printApiStats(client.apiCallCount, opts.stats ?? false);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
