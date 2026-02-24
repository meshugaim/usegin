import { describe, test, expect } from "bun:test";
import { formatTraceDetail } from "./trace-detail";
import type { SpotlightEvent } from "../client";

function makeSpan(overrides: Partial<SpotlightEvent> = {}): SpotlightEvent {
  return {
    timestamp: "2026-02-24T18:00:00.000Z",
    type: "trace",
    trace_id: "aaaa1111bbbb2222cccc3333dddd4444",
    span_id: "1111111111111111",
    op: "http.server",
    status: "ok",
    duration_ms: 200,
    span_count: 5,
    transaction: "GET /workspaces",
    platform: "node",
    ...overrides,
  };
}

describe("formatTraceDetail", () => {
  test("finds trace by ID prefix", () => {
    const spans = [makeSpan()];
    const out = formatTraceDetail(spans, "aaaa1111", {});
    expect(out).toContain("Trace aaaa1111...");
  });

  test("reports no spans for unknown prefix", () => {
    const spans = [makeSpan()];
    const out = formatTraceDetail(spans, "zzzz", {});
    expect(out).toContain('No spans found for trace ID prefix "zzzz"');
  });

  test("shows transaction name and duration", () => {
    const spans = [makeSpan({ transaction: "GET /projects", duration_ms: 350 })];
    const out = formatTraceDetail(spans, "aaaa", {});
    expect(out).toContain("GET /projects");
    expect(out).toContain("350ms");
  });

  test("shows description when different from transaction", () => {
    const spans = [
      makeSpan({
        transaction: "GET /api/chat",
        description: "serverAction/getWorkspaces",
      }),
    ];
    const out = formatTraceDetail(spans, "aaaa", {});
    expect(out).toContain("serverAction/getWorkspaces");
  });

  test("falls back to transaction when description matches", () => {
    const spans = [
      makeSpan({
        transaction: "GET /test",
        description: "GET /test",
      }),
    ];
    const out = formatTraceDetail(spans, "aaaa", {});
    expect(out).toContain("GET /test");
  });

  test("shows timing offsets for multiple spans", () => {
    const spans = [
      makeSpan({
        span_id: "aaa",
        timestamp: "2026-02-24T18:00:00.000Z",
        transaction: "root",
        duration_ms: 500,
      }),
      makeSpan({
        span_id: "bbb",
        timestamp: "2026-02-24T18:00:00.100Z",
        transaction: "child",
        duration_ms: 200,
      }),
    ];
    const out = formatTraceDetail(spans, "aaaa", {});
    // The second span should show +100ms offset
    expect(out).toContain("+100ms");
  });

  test("renders parent-child hierarchy", () => {
    const spans = [
      makeSpan({
        span_id: "root_1",
        transaction: "GET /page",
        duration_ms: 500,
      }),
      makeSpan({
        span_id: "child_1",
        parent_span_id: "root_1",
        transaction: "getWorkspaces",
        duration_ms: 200,
        timestamp: "2026-02-24T18:00:00.050Z",
      }),
    ];
    const out = formatTraceDetail(spans, "aaaa", {});
    // Child should appear after parent — tree connectors only at depth 2+
    // but the child should still be rendered
    expect(out).toContain("GET /page");
    expect(out).toContain("getWorkspaces");
    // Only 1 root (parent is root, child is nested)
    const rootLines = out.split("\n").filter((l) => l.includes("[http.server]"));
    // The child is a child of root, so we should see both
    expect(rootLines.length).toBe(2);
  });

  test("renders tree connectors at depth 2+", () => {
    const spans = [
      makeSpan({
        span_id: "root_1",
        transaction: "GET /page",
        duration_ms: 500,
      }),
      makeSpan({
        span_id: "mid_1",
        parent_span_id: "root_1",
        op: "function.server_action",
        transaction: "getWorkspace",
        duration_ms: 200,
        timestamp: "2026-02-24T18:00:00.050Z",
      }),
      makeSpan({
        span_id: "leaf_1",
        parent_span_id: "mid_1",
        op: "db.query",
        transaction: "SELECT * FROM workspaces",
        duration_ms: 15,
        timestamp: "2026-02-24T18:00:00.060Z",
      }),
    ];
    const out = formatTraceDetail(spans, "aaaa", {});
    // Depth-2 child should have a tree connector
    expect(out).toContain("└─");
    expect(out).toContain("SELECT * FROM workspaces");
  });

  test("shows measurements (TTFB, etc.) when present", () => {
    const spans = [
      makeSpan({
        op: "pageload",
        "measurement.ttfb": 2500,
        "measurement.fcp": 3000,
      } as SpotlightEvent),
    ];
    const out = formatTraceDetail(spans, "aaaa", {});
    expect(out).toContain("TTFB=2500ms");
    expect(out).toContain("FCP=3000ms");
  });

  test("does not show measurements line when none present", () => {
    const spans = [makeSpan()];
    const out = formatTraceDetail(spans, "aaaa", {});
    expect(out).not.toContain("Measurements:");
  });

  test("returns JSON when --json is set", () => {
    const spans = [makeSpan()];
    const out = formatTraceDetail(spans, "aaaa", { json: true });
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].transaction).toBe("GET /workspaces");
  });

  test("notes child span count when spans have children", () => {
    const spans = [makeSpan({ span_count: 12 })];
    const out = formatTraceDetail(spans, "aaaa", {});
    expect(out).toContain("12 child spans");
  });

  test("shows replay hint when replayId present", () => {
    const spans = [makeSpan({ replayId: "replay-123" })];
    const out = formatTraceDetail(spans, "aaaa", {});
    expect(out).toContain("replay");
  });
});
