import type { SpotlightEvent } from "../client";
import { c, dim, bold } from "./colors";

interface TracesOptions {
  limit: string;
  op?: string;
  transaction?: string;
  slow?: string;
  errors?: boolean;
  json?: boolean;
}

/** Deduplicate: group spans by trace_id, keep the root (no parent) or longest */
function deduplicateTraces(events: SpotlightEvent[]): SpotlightEvent[] {
  const byTrace = new Map<string, SpotlightEvent>();

  for (const ev of events) {
    if (!ev.trace_id) continue;
    const existing = byTrace.get(ev.trace_id);
    if (
      !existing ||
      // Prefer root spans (no parent)
      (!ev.parent_span_id && existing.parent_span_id) ||
      // Prefer longer duration (likely the root transaction)
      (ev.duration_ms ?? 0) > (existing.duration_ms ?? 0)
    ) {
      byTrace.set(ev.trace_id, ev);
    }
  }

  return Array.from(byTrace.values());
}

export function formatTraces(
  events: SpotlightEvent[],
  opts: TracesOptions
): string {
  let traces = deduplicateTraces(events);

  // Apply filters
  if (opts.op) {
    traces = traces.filter((t) => t.op === opts.op);
  }
  if (opts.transaction) {
    const q = opts.transaction.toLowerCase();
    traces = traces.filter(
      (t) => t.transaction?.toLowerCase().includes(q)
    );
  }
  if (opts.slow) {
    const threshold = parseInt(opts.slow, 10);
    traces = traces.filter((t) => (t.duration_ms ?? 0) > threshold);
  }
  if (opts.errors) {
    traces = traces.filter((t) => t.status !== "ok");
  }

  // Sort by timestamp descending (most recent first)
  traces.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const limit = parseInt(opts.limit, 10);
  traces = traces.slice(0, limit);

  if (opts.json) {
    return JSON.stringify(traces, null, 2);
  }

  if (!traces.length) {
    return "No traces match the filters.";
  }

  const lines: string[] = [];
  lines.push(bold(`${traces.length} traces`) + "\n");

  for (const t of traces) {
    const dur = t.duration_ms != null ? `${t.duration_ms}ms` : "?";
    const status =
      t.status === "ok"
        ? `${c.green}ok${c.reset}`
        : `${c.red}${t.status ?? "?"}${c.reset}`;
    const tx = t.transaction ?? "unknown";
    const op = t.op ? `${c.cyan}[${t.op}]${c.reset} ` : "";
    const id = t.trace_id?.substring(0, 8) ?? "????????";
    const spans = t.span_count != null ? `${t.span_count} spans` : "";
    const time = formatTime(t.timestamp);

    lines.push(`${op}${tx}  ${c.yellow}${dur}${c.reset}  ${status}`);
    lines.push(
      dim(`  ${id}  ${spans}  ${time}  ${t.platform ?? ""}`)
    );
  }

  // Progressive disclosure hints
  lines.push("");
  lines.push(dim("Drill in:  spotlight-dev trace <id>        # span tree for a trace"));
  if (!opts.transaction) {
    lines.push(dim("By route:  spotlight-dev traces --transaction workspaces"));
  }
  if (!opts.op) {
    lines.push(dim("By op:     spotlight-dev traces --op http.server"));
  }
  if (!opts.slow) {
    lines.push(dim("Slow only: spotlight-dev traces --slow 1000  # >1s"));
  }

  return lines.join("\n");
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}
