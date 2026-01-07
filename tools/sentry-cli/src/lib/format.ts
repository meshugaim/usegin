/**
 * Sentry event formatting utilities
 */

export interface StackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  absPath?: string;
  context?: Array<[number, string]>;
}

export interface ExceptionValue {
  type?: string;
  value?: string;
  stacktrace?: {
    frames?: StackFrame[];
  };
}

export interface Breadcrumb {
  timestamp?: string;
  category?: string;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
}

export interface SentryEvent {
  eventID: string;
  title?: string;
  message?: string;
  dateCreated?: string;
  entries?: Array<{
    type: string;
    data?: {
      values?: ExceptionValue[] | Breadcrumb[];
    };
  }>;
  contexts?: Record<string, Record<string, unknown>>;
  tags?: Array<{ key: string; value: string }>;
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function formatStacktrace(frames: StackFrame[]): string {
  const lines: string[] = [];
  // Frames are typically in reverse order (innermost first), reverse for display
  const displayFrames = [...frames].reverse();

  for (const frame of displayFrames) {
    const fn = frame.function || "<anonymous>";
    const file = frame.filename || frame.absPath || "<unknown>";
    const loc = frame.lineno ? `:${frame.lineno}${frame.colno ? `:${frame.colno}` : ""}` : "";

    lines.push(`  ${colors.cyan}${fn}${colors.reset} at ${colors.dim}${file}${loc}${colors.reset}`);

    // Include source context if available
    if (frame.context && frame.context.length > 0) {
      for (const [lineNo, code] of frame.context) {
        const isCurrentLine = lineNo === frame.lineno;
        const prefix = isCurrentLine ? `${colors.red}>${colors.reset}` : " ";
        const lineColor = isCurrentLine ? colors.yellow : colors.gray;
        lines.push(`    ${prefix} ${colors.dim}${lineNo}${colors.reset} ${lineColor}${code}${colors.reset}`);
      }
    }
  }

  return lines.join("\n");
}

function formatBreadcrumbs(breadcrumbs: Breadcrumb[]): string {
  const lines: string[] = [];
  // Show breadcrumbs in chronological order
  const sorted = [...breadcrumbs].sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  for (const crumb of sorted) {
    const time = crumb.timestamp
      ? new Date(crumb.timestamp).toLocaleTimeString()
      : "??:??:??";
    const category = crumb.category || "unknown";
    const message = crumb.message || "";
    const level = crumb.level || "info";

    const levelColor =
      level === "error"
        ? colors.red
        : level === "warning"
          ? colors.yellow
          : colors.dim;

    lines.push(
      `  ${colors.dim}${time}${colors.reset} ${colors.magenta}[${category}]${colors.reset} ${levelColor}${message}${colors.reset}`
    );
  }

  return lines.join("\n");
}

function formatContexts(contexts: Record<string, Record<string, unknown>>): string {
  const lines: string[] = [];

  for (const [name, values] of Object.entries(contexts)) {
    if (name === "replay") continue; // Handle separately
    lines.push(`  ${colors.cyan}${name}${colors.reset}:`);
    for (const [key, value] of Object.entries(values)) {
      if (value !== null && value !== undefined) {
        lines.push(`    ${colors.dim}${key}:${colors.reset} ${value}`);
      }
    }
  }

  return lines.join("\n");
}

function formatTags(tags: Array<{ key: string; value: string }>): string {
  const lines: string[] = [];
  const maxKeyLen = Math.max(...tags.map((t) => t.key.length));

  for (const tag of tags) {
    const paddedKey = tag.key.padEnd(maxKeyLen);
    lines.push(`  ${colors.green}${paddedKey}${colors.reset}  ${tag.value}`);
  }

  return lines.join("\n");
}

export function formatEvent(event: SentryEvent, org?: string): string {
  const lines: string[] = [];

  // Header
  lines.push(
    `${colors.bold}Event:${colors.reset} ${colors.yellow}${event.eventID}${colors.reset}`
  );
  if (event.title) {
    lines.push(`${colors.bold}Title:${colors.reset} ${event.title}`);
  }
  lines.push(`${colors.bold}Date:${colors.reset} ${formatDate(event.dateCreated)}`);
  lines.push("");

  // Process entries
  const exceptions: ExceptionValue[] = [];
  const breadcrumbs: Breadcrumb[] = [];

  for (const entry of event.entries || []) {
    if (entry.type === "exception" && entry.data?.values) {
      exceptions.push(...(entry.data.values as ExceptionValue[]));
    } else if (entry.type === "breadcrumbs" && entry.data?.values) {
      breadcrumbs.push(...(entry.data.values as Breadcrumb[]));
    }
  }

  // Stacktrace
  if (exceptions.length > 0) {
    lines.push(`${colors.bold}${colors.red}Exception${colors.reset}`);
    for (const exc of exceptions) {
      if (exc.type || exc.value) {
        lines.push(
          `  ${colors.red}${exc.type || "Error"}${colors.reset}: ${exc.value || ""}`
        );
      }
      if (exc.stacktrace?.frames && exc.stacktrace.frames.length > 0) {
        lines.push("");
        lines.push(`${colors.bold}Stacktrace${colors.reset}`);
        lines.push(formatStacktrace(exc.stacktrace.frames));
      }
    }
    lines.push("");
  }

  // Breadcrumbs
  if (breadcrumbs.length > 0) {
    lines.push(`${colors.bold}Breadcrumbs${colors.reset} (${breadcrumbs.length})`);
    lines.push(formatBreadcrumbs(breadcrumbs));
    lines.push("");
  }

  // Contexts
  if (event.contexts && Object.keys(event.contexts).length > 0) {
    const nonReplayContexts = Object.entries(event.contexts).filter(
      ([name]) => name !== "replay"
    );
    if (nonReplayContexts.length > 0) {
      lines.push(`${colors.bold}Contexts${colors.reset}`);
      lines.push(formatContexts(event.contexts));
      lines.push("");
    }
  }

  // Tags
  if (event.tags && event.tags.length > 0) {
    lines.push(`${colors.bold}Tags${colors.reset}`);
    lines.push(formatTags(event.tags));
    lines.push("");
  }

  // Replay link
  const replayId = event.contexts?.replay?.replay_id as string | undefined;
  if (replayId && org) {
    const replayUrl = `https://sentry.io/organizations/${org}/replays/${replayId}/`;
    lines.push(`${colors.bold}Replay${colors.reset}`);
    lines.push(`  ${colors.blue}${replayUrl}${colors.reset}`);
    lines.push(`  ID: ${replayId}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function formatEventJson(event: SentryEvent): string {
  return JSON.stringify(event, null, 2);
}
