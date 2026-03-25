import { Command } from "commander";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";
import { normalizeIssueId } from "../lib/identifier";
import { shouldDefaultToJson } from "../lib/output-mode";
import {
  writeCheckoutMeta,
  readCheckoutMeta,
  hashDescription,
  type CheckoutMeta,
} from "../lib/checkout-meta";

// Re-export so tests can import { writeCheckoutMeta } from "../src/commands/checkout"
export { writeCheckoutMeta } from "../lib/checkout-meta";

const DEFAULT_CHECKOUT_DIR = "/tmp/linear/";

export function createCheckoutCommand(): Command {
  const cmd = new Command("checkout")
    .description("Check out an issue description to a local file")
    .argument("<id>", "Issue identifier (e.g., ENG-123 or just 123)")
    .option("--force", "Overwrite existing checkout")
    .option("--json", "Output as JSON")
    .option("--stats", "Show API call statistics")
    .showHelpAfterError()
    .action(async (id: string, opts) => {
      await runCheckout(normalizeIssueId(id), opts);
    });

  return cmd;
}

async function runCheckout(
  identifier: string,
  opts: {
    force?: boolean;
    json?: boolean;
    stats?: boolean;
  }
): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    process.exit(2);
  }

  const baseDir = process.env.PLAN_CHECKOUT_DIR ?? DEFAULT_CHECKOUT_DIR;
  const issueDir = join(baseDir, identifier);
  const descPath = join(issueDir, "description.md");

  // Check if already checked out (meta.json exists)
  if (!opts.force && readCheckoutMeta(issueDir) !== null) {
    console.error(`Error: ${identifier} is already checked out at ${issueDir}`);
    process.exit(1);
  }

  try {
    const client = new LinearClient({ apiKey });
    const issue = await client.getIssueByIdentifier(identifier);

    if (!issue) {
      console.error(`Error: Issue "${identifier}" not found`);
      process.exit(3);
    }

    const description = issue.description ?? "";
    const fetchedAt = new Date().toISOString();

    // Create directory and write files
    mkdirSync(issueDir, { recursive: true });
    writeFileSync(descPath, description);

    const meta: CheckoutMeta = {
      identifier,
      id: issue.id,
      fetchedAt,
      descriptionHash: hashDescription(description),
    };
    writeCheckoutMeta(issueDir, meta);

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
            path: descPath,
            fetchedAt,
          },
          null,
          2
        )
      );
    } else {
      console.log(`Checked out ${identifier} description → ${descPath}`);
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
