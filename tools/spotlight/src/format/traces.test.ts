import { describe, test, expect } from "bun:test";
import { formatTraces } from "./traces";
import type { SpotlightEvent } from "../client";

function makeTrace(overrides: Partial<SpotlightEvent> = {}): SpotlightEvent {
  return {
    timestamp: new Date().toISOString(),
    type: "trace",
    trace_id: "aaaa1111bbbb2222cccc3333dddd4444",
    span_id: "1234567890abcdef",
    op: "http.server",
    status: "ok",
    duration_ms: 100,
    span_count: 3,
    transaction: "GET /test",
    platform: "node",
    ...overrides,
  };
}

const defaultOpts = { limit: "20" };

describe("formatTraces", () => {
  test("shows trace count header", () => {
    const out = formatTraces([makeTrace()], defaultOpts);
    expect(out).toContain("1 traces");
  });

  test("shows transaction name and duration", () => {
    const out = formatTraces(
      [makeTrace({ transaction: "GET /workspaces", duration_ms: 250 })],
      defaultOpts
    );
    expect(out).toContain("GET /workspaces");
    expect(out).toContain("250ms");
  });

  test("shows ok status in green", () => {
    const out = formatTraces([makeTrace({ status: "ok" })], defaultOpts);
    expect(out).toContain("ok");
  });

  test("shows error status in red", () => {
    const out = formatTraces(
      [makeTrace({ status: "internal_error" })],
      defaultOpts
    );
    expect(out).toContain("internal_error");
  });

  test("deduplicates by trace_id, keeping longest duration", () => {
    const traces = [
      makeTrace({ trace_id: "aaaa", duration_ms: 50, transaction: "short" }),
      makeTrace({ trace_id: "aaaa", duration_ms: 200, transaction: "long" }),
    ];
    const out = formatTraces(traces, defaultOpts);
    expect(out).toContain("1 traces");
    expect(out).toContain("long");
  });

  test("filters by --op", () => {
    const traces = [
      makeTrace({ op: "http.server", transaction: "server-req" }),
      makeTrace({
        trace_id: "bbbb",
        op: "http.server.middleware",
        transaction: "middleware",
      }),
    ];
    const out = formatTraces(traces, { ...defaultOpts, op: "http.server" });
    expect(out).toContain("server-req");
    expect(out).not.toContain("middleware");
  });

  test("filters by --transaction substring", () => {
    const traces = [
      makeTrace({ trace_id: "aaaa", transaction: "GET /workspaces" }),
      makeTrace({ trace_id: "bbbb", transaction: "GET /sign-in" }),
    ];
    const out = formatTraces(traces, {
      ...defaultOpts,
      transaction: "workspace",
    });
    expect(out).toContain("GET /workspaces");
    expect(out).not.toContain("sign-in");
  });

  test("filters by --slow threshold", () => {
    const traces = [
      makeTrace({ trace_id: "aaaa", duration_ms: 50 }),
      makeTrace({ trace_id: "bbbb", duration_ms: 500 }),
    ];
    const out = formatTraces(traces, { ...defaultOpts, slow: "200" });
    expect(out).toContain("1 traces");
    expect(out).toContain("500ms");
  });

  test("filters by --errors", () => {
    const traces = [
      makeTrace({ trace_id: "aaaa", status: "ok" }),
      makeTrace({ trace_id: "bbbb", status: "internal_error" }),
    ];
    const out = formatTraces(traces, { ...defaultOpts, errors: true });
    expect(out).toContain("1 traces");
    expect(out).toContain("internal_error");
  });

  test("filters by --since", () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 3_600_000).toISOString(); // 1h ago
    const traces = [
      makeTrace({ trace_id: "aaaa", timestamp: recent, transaction: "new" }),
      makeTrace({ trace_id: "bbbb", timestamp: old, transaction: "old" }),
    ];
    const out = formatTraces(traces, { ...defaultOpts, since: "5m" });
    expect(out).toContain("new");
    expect(out).not.toContain("old");
  });

  test("respects --limit", () => {
    const traces = [
      makeTrace({ trace_id: "aaaa", transaction: "first" }),
      makeTrace({ trace_id: "bbbb", transaction: "second" }),
      makeTrace({ trace_id: "cccc", transaction: "third" }),
    ];
    const out = formatTraces(traces, { ...defaultOpts, limit: "2" });
    expect(out).toContain("2 traces");
  });

  test("returns JSON when --json is set", () => {
    const traces = [makeTrace()];
    const out = formatTraces(traces, { ...defaultOpts, json: true });
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].transaction).toBe("GET /test");
  });

  test("returns message when no traces match filters", () => {
    const out = formatTraces(
      [makeTrace({ status: "ok" })],
      { ...defaultOpts, errors: true }
    );
    expect(out).toContain("No traces match");
  });
});
