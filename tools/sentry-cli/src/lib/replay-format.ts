/**
 * rrweb replay parsing and formatting utilities
 *
 * Parses rrweb recording segments to extract user actions, mutations, and errors.
 * See: https://github.com/rrweb-io/rrweb
 */

// rrweb event types
export enum RrwebEventType {
  DomContentLoaded = 0,
  Load = 1,
  FullSnapshot = 2,
  IncrementalSnapshot = 3,
  Meta = 4,
  Custom = 5,
  Plugin = 6,
}

// rrweb incremental source types
export enum RrwebIncrementalSource {
  Mutation = 0,
  MouseMove = 1,
  MouseInteraction = 2,
  Scroll = 3,
  ViewportResize = 4,
  Input = 5,
  TouchMove = 6,
  MediaInteraction = 7,
  StyleSheetRule = 8,
  CanvasMutation = 9,
  Font = 10,
  Log = 11,
  Drag = 12,
  StyleDeclaration = 13,
  Selection = 14,
  AdoptedStyleSheet = 15,
  CustomElement = 16,
}

// Mouse interaction types
export enum MouseInteractionType {
  MouseUp = 0,
  MouseDown = 1,
  Click = 2,
  ContextMenu = 3,
  DblClick = 4,
  Focus = 5,
  Blur = 6,
  TouchStart = 7,
  TouchEnd = 9,
}

export interface RrwebEvent {
  type: RrwebEventType;
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * Normalize timestamp to milliseconds
 * rrweb uses milliseconds, but some Sentry custom events use seconds
 */
function normalizeTimestamp(ts: number): number {
  // If timestamp is before year 2000 in milliseconds, it's likely in seconds
  // 946684800000 = Jan 1, 2000 in ms
  if (ts < 946684800000) {
    return ts * 1000;
  }
  return ts;
}

export type ParsedEventType =
  | "meta"
  | "snapshot"
  | "mutation"
  | "click"
  | "input"
  | "scroll"
  | "viewport"
  | "error"
  | "log"
  | "other";

export interface ParsedReplayEvent {
  type: ParsedEventType;
  timestamp: number;
  details: string;
  raw?: Record<string, unknown>;
}

export interface ParseOptions {
  type?: string;
  includeRaw?: boolean;
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

/**
 * Parse rrweb events into a simplified format
 */
export function parseRrwebEvents(
  events: RrwebEvent[],
  options: ParseOptions = {}
): ParsedReplayEvent[] {
  const parsed: ParsedReplayEvent[] = [];

  for (const event of events) {
    const parsedEvent = parseEvent(event, options);
    if (parsedEvent) {
      // Apply type filter
      if (options.type) {
        if (options.type === "hydration") {
          // Special handling for hydration filter
          if (isHydrationRelated(parsedEvent)) {
            parsed.push(parsedEvent);
          }
        } else if (parsedEvent.type === options.type) {
          parsed.push(parsedEvent);
        }
      } else {
        parsed.push(parsedEvent);
      }
    }
  }

  return parsed;
}

function isHydrationRelated(event: ParsedReplayEvent): boolean {
  const hydrationKeywords = [
    "hydration",
    "hydrate",
    "server",
    "client",
    "mismatch",
    "reactroot",
    "data-reactroot",
  ];
  const details = event.details.toLowerCase();
  return hydrationKeywords.some((kw) => details.includes(kw));
}

function parseEvent(
  event: RrwebEvent,
  options: ParseOptions
): ParsedReplayEvent | null {
  const { type, data } = event;
  const timestamp = normalizeTimestamp(event.timestamp);

  switch (type) {
    case RrwebEventType.Meta:
      return {
        type: "meta",
        timestamp,
        details: formatMetaDetails(data),
        raw: options.includeRaw ? data : undefined,
      };

    case RrwebEventType.FullSnapshot:
      return {
        type: "snapshot",
        timestamp,
        details: "Full DOM snapshot captured",
        raw: options.includeRaw ? data : undefined,
      };

    case RrwebEventType.IncrementalSnapshot:
      return parseIncrementalSnapshot(timestamp, data, options);

    case RrwebEventType.Custom:
      return parseCustomEvent(timestamp, data, options);

    default:
      return null;
  }
}

function formatMetaDetails(data?: Record<string, unknown>): string {
  if (!data) return "Page meta";
  const parts: string[] = [];
  if (data.href) parts.push(`URL: ${data.href}`);
  if (data.width && data.height) parts.push(`${data.width}x${data.height}`);
  return parts.join(", ") || "Page meta";
}

function parseIncrementalSnapshot(
  timestamp: number,
  data?: Record<string, unknown>,
  options?: ParseOptions
): ParsedReplayEvent | null {
  if (!data) return null;

  const source = data.source as number;

  switch (source) {
    case RrwebIncrementalSource.Mutation:
      return {
        type: "mutation",
        timestamp,
        details: formatMutationDetails(data),
        raw: options?.includeRaw ? data : undefined,
      };

    case RrwebIncrementalSource.MouseInteraction:
      return parseMouseInteraction(timestamp, data, options);

    case RrwebIncrementalSource.Input:
      return {
        type: "input",
        timestamp,
        details: `[input] on element #${data.id || "unknown"}`,
        raw: options?.includeRaw ? data : undefined,
      };

    case RrwebIncrementalSource.Scroll:
      return {
        type: "scroll",
        timestamp,
        details: `Scroll to y=${data.y || 0}`,
        raw: options?.includeRaw ? data : undefined,
      };

    case RrwebIncrementalSource.ViewportResize:
      return {
        type: "viewport",
        timestamp,
        details: `Viewport resized to ${data.width}x${data.height}`,
        raw: options?.includeRaw ? data : undefined,
      };

    case RrwebIncrementalSource.Log:
      return {
        type: "log",
        timestamp,
        details: formatLogDetails(data),
        raw: options?.includeRaw ? data : undefined,
      };

    default:
      return null;
  }
}

function formatMutationDetails(data: Record<string, unknown>): string {
  const adds = data.adds as Array<{ node?: { tagName?: string } }> | undefined;
  const removes = data.removes as Array<unknown> | undefined;
  const texts = data.texts as Array<{ value?: string }> | undefined;
  const attrs = data.attributes as Array<{ attributes?: Record<string, string> }> | undefined;

  const parts: string[] = [];

  if (adds && adds.length > 0) {
    const tags = adds
      .map((a) => a.node?.tagName)
      .filter(Boolean)
      .slice(0, 3);
    parts.push(`+${adds.length} nodes${tags.length > 0 ? ` (${tags.join(", ")})` : ""}`);
  }

  if (removes && removes.length > 0) {
    parts.push(`-${removes.length} nodes`);
  }

  if (texts && texts.length > 0) {
    parts.push(`${texts.length} text changes`);
  }

  if (attrs && attrs.length > 0) {
    const attrNames = attrs
      .flatMap((a) => Object.keys(a.attributes || {}))
      .slice(0, 3);
    parts.push(`${attrs.length} attr changes${attrNames.length > 0 ? ` (${attrNames.join(", ")})` : ""}`);
  }

  return parts.length > 0 ? `DOM mutation: ${parts.join(", ")}` : "DOM mutation";
}

function parseMouseInteraction(
  timestamp: number,
  data: Record<string, unknown>,
  options?: ParseOptions
): ParsedReplayEvent | null {
  const interactionType = data.type as number;

  // Only track clicks and double-clicks
  if (
    interactionType !== MouseInteractionType.Click &&
    interactionType !== MouseInteractionType.DblClick
  ) {
    return null;
  }

  const x = data.x as number | undefined;
  const y = data.y as number | undefined;
  const isDouble = interactionType === MouseInteractionType.DblClick;

  return {
    type: "click",
    timestamp,
    details: `${isDouble ? "Double-click" : "Click"} at (${x || 0}, ${y || 0})`,
    raw: options?.includeRaw ? data : undefined,
  };
}

function formatLogDetails(data: Record<string, unknown>): string {
  const level = data.level as string | undefined;
  const payload = data.payload as string | undefined;
  return `[${level || "log"}] ${payload || ""}`.trim();
}

function parseCustomEvent(
  timestamp: number,
  data?: Record<string, unknown>,
  options?: ParseOptions
): ParsedReplayEvent | null {
  if (!data) return null;

  const tag = data.tag as string | undefined;
  const payload = data.payload as Record<string, unknown> | undefined;

  if (tag === "error") {
    const message =
      (payload?.message as string) ||
      (payload?.error as string) ||
      "Unknown error";
    return {
      type: "error",
      timestamp,
      details: message,
      raw: options?.includeRaw ? data : undefined,
    };
  }

  return {
    type: "other",
    timestamp,
    details: `Custom event: ${tag || "unknown"}`,
    raw: options?.includeRaw ? data : undefined,
  };
}

/**
 * Format parsed events as a human-readable timeline
 */
export function formatReplayTimeline(events: ParsedReplayEvent[]): string {
  if (events.length === 0) {
    return `${colors.dim}No events found${colors.reset}`;
  }

  const lines: string[] = [];
  const startTime = events[0].timestamp;

  lines.push(`${colors.bold}Timeline${colors.reset} (${events.length} events)`);
  lines.push("");

  for (const event of events) {
    const relativeMs = event.timestamp - startTime;
    const relativeStr = formatRelativeTime(relativeMs);

    const typeColor = getTypeColor(event.type);
    const typeStr = event.type.padEnd(10);

    lines.push(
      `${colors.dim}${relativeStr}${colors.reset}  ${typeColor}${typeStr}${colors.reset}  ${event.details}`
    );
  }

  return lines.join("\n");
}

function formatRelativeTime(ms: number): string {
  if (ms < 1000) {
    return `+${ms}ms`.padStart(10);
  } else if (ms < 60000) {
    return `+${(ms / 1000).toFixed(1)}s`.padStart(10);
  } else {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `+${mins}m${secs}s`.padStart(10);
  }
}

function getTypeColor(type: ParsedEventType): string {
  switch (type) {
    case "error":
      return colors.red;
    case "click":
      return colors.cyan;
    case "mutation":
      return colors.yellow;
    case "input":
      return colors.green;
    case "scroll":
      return colors.blue;
    case "meta":
    case "snapshot":
      return colors.magenta;
    default:
      return colors.dim;
  }
}

/**
 * Format parsed events as JSON
 */
export function formatReplayJson(events: ParsedReplayEvent[]): string {
  return JSON.stringify(events, null, 2);
}
