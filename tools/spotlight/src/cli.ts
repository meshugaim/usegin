#!/usr/bin/env bun
import { Command } from "commander";
import { fetchEvents, type BufferInfo } from "./client";
import { formatTraces } from "./format/traces";
import { formatErrors } from "./format/errors";
import { formatLogs } from "./format/logs";
import { formatTraceDetail } from "./format/trace-detail";

const program = new Command()
  .name("spotlight-dev")
  .description("Query local Spotlight (Sentry dev) traces, errors, and logs")
  .version("0.1.0");

// --- traces ---

program
  .command("traces")
  .description("List recent traces")
  .option("-n, --limit <n>", "Number of traces to show", "20")
  .option("--op <op>", "Filter by span operation (e.g., http.server)")
  .option("--transaction <name>", "Filter by transaction name (substring match)")
  .option("--slow <ms>", "Only show traces slower than N ms")
  .option("--errors", "Only show traces with error status")
  .option("--json", "Output as JSON")
  .option("--no-cache", "Bypass cache and fetch fresh data from sidecar")
  .action(async (opts) => {
    const { events, buffer } = await fetchEvents("traces", { noCache: opts.cache === false });
    if (!events.length) return noData("traces");
    if (!opts.json) printBufferStatus(buffer);
    console.log(formatTraces(events, opts));
    if (!opts.json) printHints(opts, "traces");
  });

// --- trace <id> ---

program
  .command("trace <id>")
  .description("Show span tree for a trace ID")
  .option("--json", "Output as JSON")
  .option("--no-cache", "Bypass cache and fetch fresh data from sidecar")
  .action(async (id: string, opts) => {
    const { events } = await fetchEvents("traces", { noCache: opts.cache === false });
    if (!events.length) return noData("traces");
    console.log(formatTraceDetail(events, id, opts));
  });

// --- errors ---

program
  .command("errors")
  .description("List recent errors")
  .option("-n, --limit <n>", "Number of errors to show", "20")
  .option("--json", "Output as JSON")
  .option("--no-cache", "Bypass cache and fetch fresh data from sidecar")
  .action(async (opts) => {
    const { events, buffer } = await fetchEvents("errors", { noCache: opts.cache === false });
    if (!events.length) return noData("errors");
    if (!opts.json) printBufferStatus(buffer);
    console.log(formatErrors(events, opts));
  });

// --- logs ---

program
  .command("logs")
  .description("List recent logs")
  .option("-n, --limit <n>", "Number of logs to show", "20")
  .option("--json", "Output as JSON")
  .option("--no-cache", "Bypass cache and fetch fresh data from sidecar")
  .action(async (opts) => {
    const { events, buffer } = await fetchEvents("logs", { noCache: opts.cache === false });
    if (!events.length) return noData("logs");
    if (!opts.json) printBufferStatus(buffer);
    console.log(formatLogs(events, opts));
  });

// --- status ---

program
  .command("status")
  .description("Check Spotlight sidecar connection and buffer summary")
  .action(async () => {
    const { buffer } = await fetchEvents("all", { noCache: true });
    const age = buffer.oldest ? formatAge(buffer.oldest) : null;
    const newest = buffer.newest ? formatAge(buffer.newest) : null;

    console.log(`Sidecar:  \x1b[32mconnected\x1b[0m  (localhost:8969)`);
    console.log(`Buffer:   ${buffer.total} events (${buffer.traces} traces, ${buffer.errors} errors, ${buffer.logs} logs)`);
    if (age) console.log(`Oldest:   ${age} ago`);
    if (newest) console.log(`Newest:   ${newest} ago`);
    if (buffer.total === 0) {
      console.log(`\n\x1b[2mNo events yet. Interact with the app to generate traces.\x1b[0m`);
    }
  });

// --- help ---

program.addHelpText(
  "afterAll",
  `
Examples:
  spotlight-dev traces                       # Recent traces (default 20)
  spotlight-dev traces --slow 1000           # Traces slower than 1s
  spotlight-dev traces --transaction chat     # Filter by route/transaction name
  spotlight-dev trace abc123                 # Span tree for a trace
  spotlight-dev errors                       # Recent errors
  spotlight-dev logs                         # Recent logs
  spotlight-dev traces --json | jq .         # JSON for scripting
  spotlight-dev traces --no-cache            # Force fresh fetch

Requires Spotlight sidecar running on localhost:8969 (started by dev server).
`
);

program.parse();

/** Print buffer status line — shows what Spotlight has captured */
function printBufferStatus(buffer: BufferInfo): void {
  const dim = "\x1b[2m";
  const reset = "\x1b[0m";

  if (buffer.total === 0) return;

  const age = buffer.oldest ? formatAge(buffer.oldest) : "?";
  const parts = [
    `${buffer.traces} traces`,
    `${buffer.errors} errors`,
    `${buffer.logs} logs`,
  ].filter((p) => !p.startsWith("0 "));

  console.log(`${dim}Buffer: ${parts.join(", ")}  oldest: ${age} ago  sidecar: connected${reset}\n`);
}

function formatAge(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

/** Print contextual hints — only suggest flags the user isn't already using */
function printHints(opts: Record<string, unknown>, command: string): void {
  const dim = "\x1b[2m";
  const reset = "\x1b[0m";
  const hints: string[] = [];

  if (command === "traces") {
    hints.push("Drill in:  spotlight-dev trace <id>");
    if (!opts.slow) hints.push("Slow only: spotlight-dev traces --slow 1000");
    if (!opts.transaction) hints.push("By route:  spotlight-dev traces --transaction <name>");
  }

  if (hints.length) {
    console.error(hints.map((h) => `${dim}${h}${reset}`).join("\n"));
  }
}

function noData(type: string): void {
  const dim = "\x1b[2m";
  const reset = "\x1b[0m";
  console.log(`No ${type} in Spotlight buffer.\n`);
  console.log(`${dim}Spotlight captures events while dev servers are running.`);
  console.log(`Start with: just dev`);
  console.log(`Then interact with the app to generate ${type}.${reset}`);
}
