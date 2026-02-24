import type { SpotlightEvent } from "../client";
import { c, dim, bold } from "./colors";

interface ErrorsOptions {
  limit: string;
  json?: boolean;
}

export function formatErrors(
  events: SpotlightEvent[],
  opts: ErrorsOptions
): string {
  // Filter to error-type events
  let errors = events.filter((e) => e.type === "error");

  // Sort by timestamp descending
  errors.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const limit = parseInt(opts.limit, 10);
  errors = errors.slice(0, limit);

  if (opts.json) {
    return JSON.stringify(errors, null, 2);
  }

  if (!errors.length) {
    return "No errors in Spotlight buffer.\n\n" + dim("This is good! No runtime failures captured.");
  }

  const lines: string[] = [];
  lines.push(bold(`${errors.length} errors`) + "\n");

  for (const err of errors) {
    const time = formatTime(err.timestamp);
    const id = err.event_id?.substring(0, 8) ?? "????????";
    const platform = err.platform ?? "";

    // Show exception type + message if available, otherwise just metadata
    const excType = err.exception_type ? `${c.yellow}${err.exception_type}${c.reset}` : "";
    const excMsg = err.exception_value ?? "";

    if (excType || excMsg) {
      lines.push(`${c.red}error${c.reset}  ${id}  ${time}  ${excType}${excType && excMsg ? ": " : ""}${excMsg}`);
    } else {
      lines.push(`${c.red}error${c.reset}  ${id}  ${time}  ${platform}`);
    }

    if (err.transaction) {
      lines.push(dim(`  transaction: ${err.transaction}`));
    }
    if (err.trace_id) {
      lines.push(dim(`  trace: ${err.trace_id.substring(0, 8)}`));
    }
  }

  // Progressive disclosure hints
  lines.push("");
  if (errors.some((e) => e.trace_id)) {
    lines.push(dim("Trace context: spotlight-dev trace <trace-id>  # see surrounding spans"));
  }
  lines.push(dim("JSON output:   spotlight-dev errors --json"));

  return lines.join("\n");
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}
