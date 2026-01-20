#!/usr/bin/env bun
/**
 * cctx - Claude context utilization checker
 *
 * A CLI for checking context window utilization of Claude sessions.
 * Designed to be easily used by agents to monitor their own context
 * and the context of their subagents.
 *
 * Usage:
 *   cctx                    # Check current/most recent session
 *   cctx <session-id>       # Check specific session
 *   cctx --subagents        # Include subagent context
 *   cctx --json             # Output as JSON (default for agents)
 *   cctx --compact          # Single-line output
 */

import { Command } from "commander";
import { parseSessionContext } from "./lib/context";
import { resolveSession, findSubagents } from "./lib/session";
import {
  formatJson,
  formatHuman,
  formatCompact,
  formatPercent,
  formatKeyValue,
} from "./lib/output";
import type { SessionContextReport } from "./lib/types";

type OutputFormat = "json" | "human" | "compact" | "percent" | "kv";

function getExamplesText(): string {
  return `
Examples:

  Check your own context (as an agent):
    $ cctx                     # Human-readable output
    $ cctx --json              # JSON for programmatic use
    $ cctx --percent           # Just "61.2%"
    $ cctx --compact           # "61.2% (122,377/200,000) - 77,623 remaining"

  Check subagents you spawned:
    $ cctx --subagents         # List all subagents with their context
    $ cctx agent-abc1234       # Check a specific subagent by ID

  Check a specific session:
    $ cctx b28d6d94            # By ID prefix (at least 4 chars)
    $ cctx <full-session-id>   # By full UUID

  Programmatic usage:
    $ if [ $(cctx --percent | sed 's/%//') -gt 80 ]; then
        echo "Context running low"
      fi

Exit codes:
  0 - Success, context utilization normal
  1 - Error (session not found, parse error)
  2 - Success, but context is critical (>90%)
`;
}

const program = new Command()
  .name("cctx")
  .description("Claude context utilization checker")
  .version("0.1.0")
  .argument("[session]", "Session ID, prefix, or path (default: most recent)")
  .option("--json", "Output as JSON (recommended for agents)")
  .option("--compact", "Single-line output")
  .option("--percent", "Output just the percentage")
  .option("--kv", "Key-value output (easy to parse)")
  .option("-s, --subagents", "Include subagent context info")
  .option("-q, --quiet", "Suppress errors, exit with code only")
  .addHelpText("after", getExamplesText)
  .action(run);

program.parse();

async function run(
  sessionArg: string | undefined,
  options: {
    json?: boolean;
    compact?: boolean;
    percent?: boolean;
    kv?: boolean;
    subagents?: boolean;
    quiet?: boolean;
  }
): Promise<void> {
  // Determine output format
  let format: OutputFormat = "human";
  if (options.json) format = "json";
  else if (options.compact) format = "compact";
  else if (options.percent) format = "percent";
  else if (options.kv) format = "kv";

  try {
    // Resolve session path
    const sessionPath = await resolveSession(sessionArg);

    if (!sessionPath) {
      if (options.quiet) {
        process.exit(1);
      }
      console.error("Error: No session found");
      console.error("");
      console.error("Make sure you're in a directory with Claude sessions, or provide a session ID.");
      process.exit(1);
    }

    // Parse context
    const context = await parseSessionContext(sessionPath);

    if (!context) {
      if (options.quiet) {
        process.exit(1);
      }
      console.error(`Error: Could not parse context from ${sessionPath}`);
      console.error("");
      console.error("The session file may be empty or have no usage data yet.");
      process.exit(1);
    }

    // Build report
    const report: SessionContextReport = { session: context };

    // Include subagents if requested
    if (options.subagents) {
      report.subagents = await findSubagents(sessionPath);
    }

    // Output in requested format
    switch (format) {
      case "json":
        console.log(formatJson(report));
        break;
      case "compact":
        console.log(formatCompact(context));
        break;
      case "percent":
        console.log(formatPercent(context));
        break;
      case "kv":
        console.log(formatKeyValue(report));
        break;
      case "human":
      default:
        console.log(formatHuman(report));
        break;
    }

    // Exit with non-zero if utilization is critical (>90%)
    if (context.utilization > 0.9) {
      process.exit(2);
    }
  } catch (error) {
    if (options.quiet) {
      process.exit(1);
    }
    console.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}
