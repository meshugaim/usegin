import { Command } from "commander";
import {
  SentryClient,
  type TraceMeta,
  type TraceSpan,
  type SpanSearchResult,
} from "../../../lib/sentry-api";

const DEFAULT_ORG = "askeffi";

export function createTraceCommand(): Command {
  const trace = new Command("trace").description("Inspect Sentry traces");

  trace
    .command("show")
    .description("Show trace details")
    .argument("<trace-id>", "Trace ID (32-character hex string)")
    .option("-o, --org <org>", "Organization slug", DEFAULT_ORG)
    .option("--json", "Output as JSON")
    .option("--spans", "Show span tree")
    .action(async (traceId: string, opts) => {
      await runTraceShow(traceId, opts);
    });

  trace
    .command("search")
    .description("Search for spans/traces")
    .argument("<query>", "Sentry query (e.g., 'span.description:*addProjectMember*')")
    .option("-o, --org <org>", "Organization slug", DEFAULT_ORG)
    .option("-p, --project <project>", "Project slug")
    .option("-n, --limit <n>", "Number of results", "20")
    .option("--period <period>", "Time period (e.g., 14d, 7d, 24h)", "14d")
    .option("--json", "Output as JSON")
    .action(async (query: string, opts) => {
      await runTraceSearch(query, opts);
    });

  return trace;
}

interface TraceShowOptions {
  org: string;
  json?: boolean;
  spans?: boolean;
}

interface EventUser {
  email?: string;
  id?: string;
  username?: string;
  ip_address?: string;
}

interface EventDetails {
  eventID: string;
  user?: EventUser;
  tags?: Array<{ key: string; value: string }>;
  context?: Record<string, unknown>;  // Custom context (server action results, etc.)
  contexts?: Record<string, unknown>; // System contexts (device, browser, etc.)
}

async function runTraceShow(
  traceId: string,
  opts: TraceShowOptions
): Promise<void> {
  // Validate trace ID format
  if (!/^[0-9a-fA-F]{32}$/.test(traceId)) {
    console.error("Error: Trace ID must be a 32-character hexadecimal string");
    process.exit(1);
  }

  try {
    const client = new SentryClient({ org: opts.org });

    // Fetch trace meta and spans in parallel
    const [meta, spans] = await Promise.all([
      client.getTraceMeta(traceId),
      client.getTrace(traceId),
    ]);

    // Get user info from root transactions
    const rootSpans = spans.filter(
      (s) => s.parent_span_id === null && "duration" in s
    );

    // Fetch event details for root transactions to get user info
    // Use transaction_id (32-char) not event_id (16-char span ID)
    const eventDetails: Map<string, EventDetails> = new Map();
    for (const span of rootSpans.slice(0, 3)) {
      // Limit to first 3 to avoid too many requests
      const eventId = span.transaction_id || span.event_id;
      try {
        const event = (await client.getEvent(
          span.project_slug,
          eventId
        )) as EventDetails;
        eventDetails.set(span.event_id, event); // Key by span.event_id for lookup
      } catch {
        // Event might not exist or be accessible
      }
    }

    // Also fetch events for server action spans (they have context with invitee info)
    // Deduplicate by transaction_id since multiple spans can share the same transaction
    const serverActionSpans = findServerActionSpans(spans);
    const uniqueTransactionIds = new Map<string, TraceSpan>();
    for (const span of serverActionSpans) {
      const txId = span.transaction_id;
      if (txId && !uniqueTransactionIds.has(txId)) {
        uniqueTransactionIds.set(txId, span);
      }
    }

    for (const [txId, span] of Array.from(uniqueTransactionIds.entries()).slice(0, 10)) {
      if (!eventDetails.has(txId)) {
        try {
          const event = (await client.getEvent(
            span.project_slug,
            txId
          )) as EventDetails;
          eventDetails.set(txId, event);
        } catch {
          // Event might not exist or be accessible
        }
      }
    }

    if (opts.json) {
      console.log(
        JSON.stringify({ meta, spans, eventDetails: Object.fromEntries(eventDetails) }, null, 2)
      );
      return;
    }

    // Format and display
    console.log(formatTraceSummary(traceId, opts.org, meta, spans, eventDetails));

    if (opts.spans) {
      console.log("\n" + formatSpanTree(spans));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

function formatTraceSummary(
  traceId: string,
  org: string,
  meta: TraceMeta,
  spans: TraceSpan[],
  eventDetails: Map<string, EventDetails>
): string {
  const lines: string[] = [];

  lines.push(`Trace ${traceId.substring(0, 8)}...`);
  lines.push("=".repeat(50));
  lines.push("");

  // Summary stats
  lines.push("Summary:");
  lines.push(`  Total Spans: ${meta.span_count}`);
  lines.push(`  Errors: ${meta.errors}`);
  lines.push(`  Performance Issues: ${meta.performance_issues}`);
  lines.push(`  Logs: ${meta.logs}`);

  // Operation breakdown
  if (Object.keys(meta.span_count_map).length > 0) {
    lines.push("");
    lines.push("Operation Breakdown:");
    const sortedOps = Object.entries(meta.span_count_map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    for (const [op, count] of sortedOps) {
      lines.push(`  ${op}: ${count}`);
    }
  }

  // Root transactions/spans
  const rootSpans = spans.filter(
    (s) => s.parent_span_id === null && "duration" in s
  );
  if (rootSpans.length > 0) {
    lines.push("");
    lines.push("Root Transactions:");
    for (const span of rootSpans) {
      const duration = span.duration ? `${Math.round(span.duration)}ms` : "?";
      const name = span.name || span.description || span.transaction || "unknown";
      lines.push(`  [${span.op}] ${name} (${duration})`);
      lines.push(`    Project: ${span.project_slug}`);
      lines.push(`    Event ID: ${span.event_id}`);

      // Get user info from fetched event details
      const event = eventDetails.get(span.event_id);
      if (event?.user) {
        const user = event.user;
        const userDisplay =
          user.email || user.username || user.id || user.ip_address;
        if (userDisplay) {
          lines.push(`    User: ${userDisplay}`);
        }
      }

      // Show custom context (e.g., server action results with invitee email)
      if (event?.context) {
        const ctx = event.context as Record<string, unknown>;
        // Look for server_action_result with member/email info
        const result = ctx.server_action_result as Record<string, unknown> | undefined;
        if (result?.member) {
          const member = result.member as Record<string, unknown>;
          if (member.email) {
            lines.push(`    Invitee: ${member.email}`);
          }
        }
        // Show any other interesting context
        if (ctx.server_action_args) {
          const args = ctx.server_action_args as Record<string, unknown>;
          if (args.email) {
            lines.push(`    Target Email: ${args.email}`);
          }
        }
      }
    }
  }

  // Server Actions with context (invites, etc.)
  // Group by transaction_id to avoid duplicates
  const serverActions = findServerActionSpans(spans);
  const uniqueActions = new Map<string, TraceSpan>();
  for (const span of serverActions) {
    if (span.transaction_id && !uniqueActions.has(span.transaction_id)) {
      uniqueActions.set(span.transaction_id, span);
    }
  }

  const actionsWithContext = Array.from(uniqueActions.entries())
    .filter(([txId]) => eventDetails.has(txId));

  if (actionsWithContext.length > 0) {
    lines.push("");
    lines.push("Server Actions:");
    for (const [txId, span] of actionsWithContext) {
      const event = eventDetails.get(txId);
      const actionName = span.transaction?.replace("serverAction/", "") || span.description || "unknown";
      const duration = span.duration ? `${Math.round(span.duration)}ms` : "?";
      lines.push(`  ${actionName} (${duration})`);

      // Show context data (like invitee email)
      if (event?.context) {
        const ctx = event.context as Record<string, unknown>;
        const result = ctx.server_action_result as Record<string, unknown> | undefined;
        if (result) {
          if (result.member) {
            const member = result.member as Record<string, unknown>;
            if (member.email) lines.push(`    Invitee: ${member.email}`);
            if (member.role) lines.push(`    Role: ${member.role}`);
          }
          if (result.success !== undefined) {
            lines.push(`    Success: ${result.success}`);
          }
        }
      }
    }
  }

  // Sentry URL
  lines.push("");
  lines.push(`View in Sentry:`);
  lines.push(`  https://${org}.sentry.io/explore/traces/?query=trace:${traceId}`);

  return lines.join("\n");
}

// Find all server action spans recursively
function findServerActionSpans(spans: TraceSpan[]): TraceSpan[] {
  const results: TraceSpan[] = [];

  function search(spanList: TraceSpan[]) {
    for (const span of spanList) {
      if (span.op === "function.server_action" ||
          span.transaction?.startsWith("serverAction/")) {
        results.push(span);
      }
      if (span.children && span.children.length > 0) {
        search(span.children);
      }
    }
  }

  search(spans);
  return results;
}

function formatSpanTree(spans: TraceSpan[], prefix = "", isLast = true): string {
  const lines: string[] = [];

  // Filter to actual spans (exclude issue objects that might be in the trace)
  const actualSpans = spans.filter(
    (s) => "children" in s && "duration" in s
  );

  for (let i = 0; i < actualSpans.length; i++) {
    const span = actualSpans[i];
    const isLastSpan = i === actualSpans.length - 1;
    const connector = prefix === "" ? "" : isLastSpan ? "└─ " : "├─ ";

    const duration = span.duration ? `${Math.round(span.duration)}ms` : "?";
    const name = span.name || span.description || "unnamed";
    const opDisplay = span.op === "default" ? "" : `[${span.op}] `;

    lines.push(`${prefix}${connector}${opDisplay}${name} (${duration})`);

    // Recurse into children
    if (span.children && span.children.length > 0) {
      const childPrefix = prefix + (isLastSpan ? "   " : "│  ");
      lines.push(formatSpanTree(span.children, childPrefix, isLastSpan));
    }
  }

  return lines.join("\n");
}

interface TraceSearchOptions {
  org: string;
  project?: string;
  limit: string;
  period: string;
  json?: boolean;
}

async function runTraceSearch(
  query: string,
  opts: TraceSearchOptions
): Promise<void> {
  try {
    const client = new SentryClient({ org: opts.org });
    const limit = parseInt(opts.limit, 10);

    const results = await client.searchSpans({
      query,
      projectSlug: opts.project,
      limit,
      statsPeriod: opts.period,
    });

    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (results.length === 0) {
      console.log("No spans found matching query");
      return;
    }

    console.log(`Found ${results.length} spans:\n`);

    for (const span of results) {
      const timestamp = new Date(span.timestamp).toLocaleString();
      const duration = span["span.duration"]
        ? `${Math.round(span["span.duration"])}ms`
        : "?";
      const op = span["span.op"] || "unknown";
      const desc = span["span.description"] || span.transaction || "unnamed";
      const user = span["user.email"] || "";

      console.log(`[${op}] ${desc} (${duration})`);
      console.log(`  Time: ${timestamp}`);
      console.log(`  Project: ${span.project}`);
      console.log(`  Trace: ${span.trace}`);
      if (user) {
        console.log(`  User: ${user}`);
      }
      console.log("");
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
