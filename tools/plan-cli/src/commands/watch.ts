import { Command } from "commander";
import { existsSync, openSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { normalizeIssueId } from "../lib/identifier";
import { shouldDefaultToJson } from "../lib/output-mode";
import { parseDuration } from "../lib/duration";
import {
  readCheckoutMeta,
  writeCheckoutMeta,
  hashDescription,
  type CheckoutMeta,
} from "../lib/checkout-meta";
import { LinearClient } from "../lib/linear-client";

const DEFAULT_CHECKOUT_DIR = "/tmp/linear/";
const DEFAULT_TIMEOUT = "30m";

export function createWatchCommand(): Command {
  const cmd = new Command("watch")
    .description("Watch a checked-out issue description for changes and auto-push to Linear")
    .argument("<id>", "Issue identifier (e.g., ENG-123 or just 123)")
    .option("--timeout <duration>", "Idle timeout before auto-stopping (e.g., 10m, 1h, none)", DEFAULT_TIMEOUT)
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      await runWatch(normalizeIssueId(id), opts);
    });

  return cmd;
}

async function runWatch(
  identifier: string,
  opts: {
    timeout?: string;
    json?: boolean;
  }
): Promise<void> {
  // Check API key FIRST — before any other work
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    console.error("Get your API key from: https://linear.app/settings/api");
    process.exit(2);
  }

  const baseDir = process.env.PLAN_CHECKOUT_DIR ?? DEFAULT_CHECKOUT_DIR;
  const issueDir = join(baseDir, identifier);

  // Parse timeout
  const timeoutStr = opts.timeout ?? DEFAULT_TIMEOUT;
  const timeoutMs = parseDuration(timeoutStr);

  // If not checked out yet, run checkout first
  if (!existsSync(join(issueDir, ".meta.json"))) {
    await runImplicitCheckout(identifier, issueDir, apiKey);
  }

  // Read existing meta to verify it's valid
  const meta = readCheckoutMeta(issueDir);
  if (!meta) {
    console.error(`Error: No valid checkout found for ${identifier}`);
    process.exit(1);
  }

  // Spawn the background watcher process
  const watcherPath = new URL("../lib/watcher.ts", import.meta.url).pathname;
  const logPath = join(issueDir, ".watch.log");
  const logFd = openSync(logPath, "a");

  const child = Bun.spawn(
    [
      "bun",
      watcherPath,
      issueDir,
      identifier,
      String(timeoutMs ?? 0),
      apiKey,
    ],
    {
      detached: true,
      stdio: ["ignore", logFd, logFd],
    }
  );

  const pid = child.pid;

  // Unref so parent can exit immediately
  child.unref();

  // Write PID to meta
  writeCheckoutMeta(issueDir, {
    ...meta,
    watcherPid: pid,
  });

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
          pid,
          timeout: timeoutStr,
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `Watching ${identifier} — will auto-stop after ${timeoutStr} idle`
    );
  }
}

/**
 * Run an implicit checkout when `plan watch` is called on an issue
 * that hasn't been checked out yet.
 */
async function runImplicitCheckout(
  identifier: string,
  issueDir: string,
  apiKey: string
): Promise<void> {
  try {
    const client = new LinearClient({ apiKey });
    const issue = await client.getIssueByIdentifier(identifier);

    if (!issue) {
      console.error(`Error: Issue "${identifier}" not found`);
      process.exit(3);
    }

    const description = issue.description ?? "";
    const fetchedAt = new Date().toISOString();

    mkdirSync(issueDir, { recursive: true });
    writeFileSync(join(issueDir, "description.md"), description);

    const meta: CheckoutMeta = {
      identifier,
      id: issue.id,
      fetchedAt,
      descriptionHash: hashDescription(description),
    };
    writeCheckoutMeta(issueDir, meta);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      console.error(`Error: Issue "${identifier}" not found`);
    } else if (error instanceof Error) {
      console.error(`Error during checkout: ${error.message}`);
    } else {
      console.error("An unknown error occurred during checkout");
    }
    process.exit(1);
  }
}
