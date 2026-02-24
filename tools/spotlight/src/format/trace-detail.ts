import type { SpotlightEvent } from "../client";
import { c, dim, bold } from "./colors";

interface TraceDetailOptions {
  json?: boolean;
}

export function formatTraceDetail(
  events: SpotlightEvent[],
  idPrefix: string,
  opts: TraceDetailOptions
): string {
  const prefix = idPrefix.toLowerCase();
  const spans = events.filter(
    (e) => e.trace_id?.toLowerCase().startsWith(prefix)
  );

  if (!spans.length) {
    return `No spans found for trace ID prefix "${idPrefix}".\n\n${dim("Use: spotlight-dev traces    # list available trace IDs")}`;
  }

  const traceId = spans[0].trace_id!;

  if (opts.json) {
    return JSON.stringify(spans, null, 2);
  }

  // Sort by timestamp
  spans.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Trace start time — earliest span timestamp
  const traceStart = new Date(spans[0].timestamp).getTime();

  // Build span tree
  const bySpanId = new Map<string, SpotlightEvent>();
  const children = new Map<string, SpotlightEvent[]>();
  const roots: SpotlightEvent[] = [];

  for (const span of spans) {
    if (span.span_id) {
      bySpanId.set(span.span_id, span);
    }
  }

  for (const span of spans) {
    if (span.parent_span_id && bySpanId.has(span.parent_span_id)) {
      const parentChildren = children.get(span.parent_span_id) ?? [];
      parentChildren.push(span);
      children.set(span.parent_span_id, parentChildren);
    } else {
      roots.push(span);
    }
  }

  const lines: string[] = [];
  const totalDuration = Math.max(...spans.map((s) => s.duration_ms ?? 0));
  const firstTime = formatTime(spans[0].timestamp);
  const platforms = [...new Set(spans.map((s) => s.platform).filter(Boolean))];

  const totalChildSpans = spans.reduce((sum, s) => sum + (s.span_count ?? 0), 0);

  lines.push(bold(`Trace ${traceId.substring(0, 8)}...`));
  lines.push(
    dim(
      `${spans.length} transactions  ${totalChildSpans} child spans  ${totalDuration}ms total  ${firstTime}  ${platforms.join(", ")}`
    )
  );
  lines.push("");

  // Render tree with offsets
  for (let i = 0; i < roots.length; i++) {
    renderSpan(roots[i], "", i === roots.length - 1, children, lines, traceStart);
  }

  // Explain what's visible
  if (totalChildSpans > spans.length) {
    lines.push("");
    lines.push(
      dim(`Note: ${totalChildSpans} child spans (db queries, http calls) are inside transactions.`)
    );
    lines.push(dim("View full span tree in Spotlight UI: http://localhost:8969"));
  }

  // Progressive disclosure hints
  lines.push("");
  lines.push(dim(`Full trace ID: ${traceId}`));
  lines.push(dim("JSON output:   spotlight-dev trace " + idPrefix + " --json | jq ."));
  if (spans.some((s) => s.replayId)) {
    lines.push(dim("Has browser replay data (replayId present)"));
  }

  return lines.join("\n");
}

function renderSpan(
  span: SpotlightEvent,
  prefix: string,
  isLast: boolean,
  children: Map<string, SpotlightEvent[]>,
  lines: string[],
  traceStart: number
): void {
  const connector = prefix === "" ? "" : isLast ? "└─ " : "├─ ";
  const dur =
    span.duration_ms != null ? `${c.yellow}${span.duration_ms}ms${c.reset}` : "";
  const name = span.transaction ?? span.op ?? "unnamed";
  const op = span.op ? `${c.cyan}[${span.op}]${c.reset} ` : "";
  const status =
    span.status && span.status !== "ok"
      ? ` ${c.red}${span.status}${c.reset}`
      : "";
  const spanCount =
    span.span_count != null ? dim(` (${span.span_count} spans)`) : "";

  // Offset from trace start — shows when this span began relative to the trace
  const spanStart = new Date(span.timestamp).getTime();
  const offsetMs = spanStart - traceStart;
  // For the very first span (offset 0), skip the label to reduce noise
  const offset = offsetMs > 0 ? dim(` +${offsetMs}ms`) : "";

  lines.push(`${prefix}${connector}${op}${name}  ${dur}${offset}${status}${spanCount}`);

  const kids = children.get(span.span_id ?? "") ?? [];
  // Sort children by timestamp
  kids.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 0; i < kids.length; i++) {
    const childPrefix = prefix + (prefix === "" ? "" : isLast ? "   " : "│  ");
    renderSpan(kids[i], childPrefix, i === kids.length - 1, children, lines, traceStart);
  }
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}
