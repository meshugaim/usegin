import type { SpotlightEvent } from "../client";
import { c, dim, bold } from "./colors";

interface LogsOptions {
  limit: string;
  json?: boolean;
}

export function formatLogs(
  events: SpotlightEvent[],
  opts: LogsOptions
): string {
  // Filter to log-type events
  let logs = events.filter((e) => e.type === "log");

  // Sort by timestamp descending
  logs.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const limit = parseInt(opts.limit, 10);
  logs = logs.slice(0, limit);

  if (opts.json) {
    return JSON.stringify(logs, null, 2);
  }

  if (!logs.length) {
    return "No logs in Spotlight buffer.\n\n" + dim("Application may be idle or not generating log events.");
  }

  const lines: string[] = [];
  lines.push(bold(`${logs.length} logs`) + "\n");

  for (const log of logs) {
    const time = formatTime(log.timestamp);
    const id = log.event_id?.substring(0, 8) ?? "--------";

    // Show level + message if available
    const level = log.log_level ?? "info";
    const levelColor = level === "error" ? c.red : level === "warn" ? c.yellow : c.blue;
    const msg = log.log_message ?? "";

    if (msg) {
      // Truncate long messages to keep the list scannable
      const truncated = msg.length > 120 ? msg.substring(0, 117) + "..." : msg;
      lines.push(`${levelColor}${level}${c.reset}  ${id}  ${time}  ${truncated}`);
    } else {
      lines.push(`${levelColor}${level}${c.reset}  ${id}  ${time}`);
    }

    if (log.transaction) {
      lines.push(dim(`  transaction: ${log.transaction}`));
    }
  }

  // Progressive disclosure hints
  lines.push("");
  lines.push(dim("JSON output:  spotlight-dev logs --json"));
  lines.push(dim("Also check:   spotlight-dev errors    # runtime failures"));
  lines.push(dim("              spotlight-dev traces    # request performance"));

  return lines.join("\n");
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}
