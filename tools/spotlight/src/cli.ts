#!/usr/bin/env bun
import { Command } from "commander";
import { fetchEvents, type SpotlightEvent, type BufferInfo } from "./client";
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
  .action(async (opts) => {
    const { events, buffer } = await fetchEvents("traces");
    if (!events.length) return noData("traces");
    if (!opts.json) printBufferStatus(buffer);
    console.log(formatTraces(events, opts));
    jsonHint(opts, "spotlight-dev traces --json | jq '.[] | {transaction, duration_ms}'");
  });

// --- trace <id> ---

program
  .command("trace <id>")
  .description("Show span tree for a trace ID")
  .option("--json", "Output as JSON")
  .action(async (id: string, opts) => {
    const { events } = await fetchEvents("traces");
    if (!events.length) return noData("traces");
    console.log(formatTraceDetail(events, id, opts));
    jsonHint(opts, "spotlight-dev trace " + id + " --json | jq 'sort_by(.timestamp) | .[] | {transaction, duration_ms}'");
  });

// --- errors ---

program
  .command("errors")
  .description("List recent errors")
  .option("-n, --limit <n>", "Number of errors to show", "20")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const { events, buffer } = await fetchEvents("errors");
    if (!events.length) return noData("errors");
    if (!opts.json) printBufferStatus(buffer);
    console.log(formatErrors(events, opts));
    jsonHint(opts, "spotlight-dev errors --json | jq '.[] | {event_id, transaction}'");
  });

// --- logs ---

program
  .command("logs")
  .description("List recent logs")
  .option("-n, --limit <n>", "Number of logs to show", "20")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const { events, buffer } = await fetchEvents("logs");
    if (!events.length) return noData("logs");
    if (!opts.json) printBufferStatus(buffer);
    console.log(formatLogs(events, opts));
    jsonHint(opts, "spotlight-dev logs --json | jq '.'");
  });

// --- help hints ---

program.addHelpText(
  "afterAll",
  `
Examples:
  spotlight-dev traces                       # Recent traces (default 20)
  spotlight-dev traces --slow 1000           # Traces slower than 1s
  spotlight-dev traces --op http.server      # Only server request traces
  spotlight-dev traces --transaction chat     # Filter by route/transaction name
  spotlight-dev trace abc123                 # Span tree for trace ID (prefix match)
  spotlight-dev errors                       # Recent errors
  spotlight-dev logs                         # Recent logs
  spotlight-dev traces --json | jq .         # JSON for scripting

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

/** Print a jq hint to stderr — only when --json is NOT active */
function jsonHint(opts: { json?: boolean }, example: string): void {
  if (!opts.json) {
    console.error(`\x1b[2mTip: ${example}\x1b[0m`);
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
