/**
 * Spotlight sidecar client.
 *
 * Queries the sidecar's SSE stream directly at localhost:8969/stream,
 * parsing raw Sentry envelopes into SpotlightEvents.
 *
 * Snapshots are cached to a temp file with a short TTL so that multiple
 * commands within a few seconds share the same data.
 */

import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface SpotlightEvent {
  timestamp: string;
  type: "trace" | "error" | "log";
  event_id?: string;
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  op?: string;
  description?: string;
  status?: string;
  duration_ms?: number;
  span_count?: number;
  transaction?: string;
  environment?: string;
  platform?: string;
  server_name?: string;
  sdk?: string;
  sdk_version?: string;
  // Error events
  exception_type?: string;
  exception_value?: string;
  // Log events
  log_level?: string;
  log_message?: string;
  // Measurements (traces)
  [key: `measurement.${string}`]: number;
  // Replay
  replayId?: string;
}

export interface BufferInfo {
  total: number;
  traces: number;
  errors: number;
  logs: number;
  oldest: string | null;
  newest: string | null;
}

const SPOTLIGHT_PORT = 8969;
const SSE_TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 30_000;
const CACHE_FILE = join(tmpdir(), "spotlight-dev-cache.json");

interface CacheEntry {
  timestamp: number;
  events: SpotlightEvent[];
}

function readCache(): SpotlightEvent[] | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const stat = statSync(CACHE_FILE);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    const data: CacheEntry = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    if (Date.now() - data.timestamp > CACHE_TTL_MS) return null;
    return data.events;
  } catch {
    return null;
  }
}

function writeCache(events: SpotlightEvent[]): void {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), events };
    writeFileSync(CACHE_FILE, JSON.stringify(entry));
  } catch {
    // Non-fatal — cache is an optimization, not a requirement
  }
}

/**
 * Convert a Sentry timestamp to an ISO string.
 * Handles both ISO strings and Unix epoch floats (seconds since epoch).
 */
function toISOTimestamp(ts: unknown): string {
  if (!ts) return new Date(0).toISOString();
  if (typeof ts === "string") {
    // Already ISO — validate it
    const d = new Date(ts);
    return isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
  }
  if (typeof ts === "number") {
    // Unix epoch in seconds (with optional fractional ms)
    const d = new Date(ts * 1000);
    return isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * Parse a Sentry envelope item into a SpotlightEvent.
 * Returns null if the item type is not one we care about.
 */
function parseEnvelopeItem(
  itemHeader: { type: string },
  itemPayload: Record<string, unknown>
): SpotlightEvent | null {
  if (itemHeader.type === "transaction") {
    const ctx = (itemPayload.contexts as Record<string, unknown>)
      ?.trace as Record<string, unknown> | undefined;
    const sdk = itemPayload.sdk as Record<string, unknown> | undefined;
    const spans = itemPayload.spans as unknown[] | undefined;
    const startTs = itemPayload.start_timestamp as number | string | undefined;
    const endTs = itemPayload.timestamp as number | string | undefined;

    let duration_ms: number | undefined;
    if (startTs && endTs) {
      const startNum =
        typeof startTs === "number" ? startTs : new Date(startTs).getTime() / 1000;
      const endNum =
        typeof endTs === "number" ? endTs : new Date(endTs).getTime() / 1000;
      duration_ms = Math.round((endNum - startNum) * 1000);
    }

    const event: SpotlightEvent = {
      type: "trace",
      timestamp: toISOTimestamp(endTs),
      event_id: itemPayload.event_id as string,
      trace_id: ctx?.trace_id as string,
      span_id: ctx?.span_id as string,
      parent_span_id: ctx?.parent_span_id as string,
      op: ctx?.op as string,
      status: ctx?.status as string,
      description: ctx?.description as string,
      transaction: itemPayload.transaction as string,
      environment: itemPayload.environment as string,
      platform: itemPayload.platform as string,
      server_name: itemPayload.server_name as string,
      sdk: sdk?.name as string,
      sdk_version: sdk?.version as string,
      span_count: spans?.length,
      duration_ms,
    };

    // Extract measurements
    const measurements = itemPayload.measurements as
      | Record<string, { value: number }>
      | undefined;
    if (measurements) {
      for (const [key, val] of Object.entries(measurements)) {
        (event as Record<string, unknown>)[`measurement.${key}`] = val.value;
      }
    }

    return event;
  }

  if (itemHeader.type === "event") {
    const sdk = itemPayload.sdk as Record<string, unknown> | undefined;
    const ctx = (itemPayload.contexts as Record<string, unknown>)
      ?.trace as Record<string, unknown> | undefined;
    const exception = itemPayload.exception as {
      values?: { type?: string; value?: string }[];
    } | undefined;
    const logentry = itemPayload.logentry as {
      message?: string;
      formatted?: string;
    } | undefined;

    const message =
      (itemPayload.message as string) ??
      logentry?.message ??
      logentry?.formatted ??
      null;

    const level = (itemPayload.level as string) ?? "error";

    return {
      type: "error",
      timestamp: toISOTimestamp(itemPayload.timestamp),
      event_id: itemPayload.event_id as string,
      trace_id: ctx?.trace_id as string,
      span_id: ctx?.span_id as string,
      transaction: itemPayload.transaction as string,
      environment: itemPayload.environment as string,
      platform: itemPayload.platform as string,
      server_name: itemPayload.server_name as string,
      sdk: sdk?.name as string,
      sdk_version: sdk?.version as string,
      exception_type: exception?.values?.[0]?.type,
      exception_value: exception?.values?.[0]?.value,
      log_level: level,
      log_message: message ?? undefined,
    };
  }

  // Skip profiles, sessions, spans, etc.
  return null;
}

/**
 * Fetch buffered events from the Spotlight sidecar.
 *
 * Connects to the SSE stream at localhost:8969/stream, reads all buffered
 * envelopes, parses them into SpotlightEvents, and caches the result.
 */
export async function fetchEvents(
  types: "traces" | "errors" | "logs" | "all" = "all",
  options?: { noCache?: boolean }
): Promise<{ events: SpotlightEvent[]; buffer: BufferInfo }> {
  // Try cache first (skip if --no-cache)
  const cached = options?.noCache ? null : readCache();
  if (cached) {
    const filtered = filterByType(cached, types);
    return { events: filtered, buffer: computeBufferInfo(cached) };
  }

  // Connect to SSE stream with a timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SSE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`http://localhost:${SPOTLIGHT_PORT}/stream`, {
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error();
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === "AbortError") {
      // Timeout — sidecar is slow but running, return empty
      return { events: [], buffer: computeBufferInfo([]) };
    }
    console.error(
      "Spotlight sidecar not running on localhost:8969.\n" +
        "Start dev servers with: just dev"
    );
    process.exit(1);
  }

  // Read the SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } catch {
    // AbortError from timeout — expected, we have what we need
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }

  // Parse SSE events
  // Format: "event: application/x-sentry-envelope\ndata: [header, [items...]]\n\n"
  const allEvents: SpotlightEvent[] = [];
  const raw = chunks.join("");

  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6); // strip "data: "
    if (!data.startsWith("[")) continue;

    try {
      const envelope = JSON.parse(data) as [
        Record<string, unknown>,
        [{ type: string }, Record<string, unknown>][]
      ];

      const items = envelope[1];
      if (!Array.isArray(items)) continue;

      for (const [itemHeader, itemPayload] of items) {
        const event = parseEnvelopeItem(itemHeader, itemPayload);
        if (event) allEvents.push(event);
      }
    } catch {
      // Skip malformed envelopes
    }
  }

  // Cache the full result
  writeCache(allEvents);

  const filtered = filterByType(allEvents, types);
  return { events: filtered, buffer: computeBufferInfo(allEvents) };
}

function filterByType(
  events: SpotlightEvent[],
  types: "traces" | "errors" | "logs" | "all"
): SpotlightEvent[] {
  if (types === "all") return events;
  const typeMap: Record<string, string> = {
    traces: "trace",
    errors: "error",
    logs: "log",
  };
  const target = typeMap[types];
  return events.filter((e) => e.type === target);
}

function computeBufferInfo(events: SpotlightEvent[]): BufferInfo {
  const timestamps = events
    .map((e) => e.timestamp)
    .filter(Boolean)
    .sort();

  return {
    total: events.length,
    traces: events.filter((e) => e.type === "trace").length,
    errors: events.filter((e) => e.type === "error").length,
    logs: events.filter((e) => e.type === "log").length,
    oldest: timestamps[0] ?? null,
    newest: timestamps[timestamps.length - 1] ?? null,
  };
}
