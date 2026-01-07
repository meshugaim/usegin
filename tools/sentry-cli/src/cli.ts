#!/usr/bin/env bun
import { $ } from "bun";

const DEFAULT_ORG = "askeffi";

const args = process.argv.slice(2);

// Commands that benefit from org default
const orgCommands = ["issues", "events", "releases", "projects"];
const needsOrg = orgCommands.some((cmd) => args.includes(cmd));

// Inject org if not provided
if (needsOrg && !args.includes("-o") && !args.includes("--org")) {
  args.splice(1, 0, "-o", DEFAULT_ORG);
}

// Pass through to sentry-cli
await $`bunx @sentry/cli ${args}`.nothrow();
