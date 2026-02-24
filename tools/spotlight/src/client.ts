/**
 * Spotlight sidecar client.
 *
 * Uses `spotlight tail` CLI under the hood — it dumps all buffered events
 * from the running sidecar, which is more reliable than the MCP time-window API.
 *
 * Snapshots are cached to a temp file with a short TTL so that multiple
 * commands within a few seconds share the same data (avoids the sidecar's
 * non-deterministic SSE buffer replay).
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
  status?: string;
  duration_ms?: number;
  span_count?: number;
  transaction?: string;
  environment?: string;
  platform?: string;
  server_name?: string;
  sdk?: string;
  sdk_version?: string;
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
const TAIL_TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 5_000;
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
 * Fetch buffered events from the Spotlight sidecar.
 *
 * First checks for a recent cache (< 5s old). If fresh, returns cached data.
 * Otherwise runs `spotlight tail all --format json` with a short timeout,
 * caches the result, and returns it.
 *
 * Always fetches ALL event types and filters client-side, so that the cache
 * is shared across `traces`, `errors`, `logs`, and `all` queries.
 */
export async function fetchEvents(
  types: "traces" | "errors" | "logs" | "all" = "all"
): Promise<{ events: SpotlightEvent[]; buffer: BufferInfo }> {
  // Try cache first
  const cached = readCache();
  if (cached) {
    const filtered = filterByType(cached, types);
    return { events: filtered, buffer: computeBufferInfo(cached) };
  }

  // Health check
  try {
    const resp = await fetch(`http://localhost:${SPOTLIGHT_PORT}/`);
    if (!resp.ok) throw new Error();
    await resp.text();
  } catch {
    console.error(
      "Spotlight sidecar not running on localhost:8969.\n" +
        "Start dev servers with: just dev"
    );
    process.exit(1);
  }

  // Fetch ALL types so the cache is universal
  const proc = Bun.spawn(
    ["npx", "@spotlightjs/spotlight", "tail", "all", "--format", "json"],
    { stdout: "pipe", stderr: "pipe" }
  );

  const chunks: string[] = [];
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + TAIL_TIMEOUT_MS;

  try {
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const result = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((resolve) =>
          setTimeout(() => resolve({ done: true, value: undefined }), remaining)
        ),
      ]);

      if (result.done) break;
      if (result.value) {
        chunks.push(decoder.decode(result.value, { stream: true }));
      }
    }
  } finally {
    reader.releaseLock();
    proc.kill();
  }

  // Parse NDJSON lines, skip non-JSON (spotlight banner, errors)
  const allEvents: SpotlightEvent[] = [];
  const lines = chunks.join("").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) continue;
    try {
      allEvents.push(JSON.parse(trimmed));
    } catch {
      // Skip malformed lines (the RangeError lines from spotlight)
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
