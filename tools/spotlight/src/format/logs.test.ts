import { describe, test, expect } from "bun:test";
import { formatLogs } from "./logs";
import type { SpotlightEvent } from "../client";

function makeLog(overrides: Partial<SpotlightEvent> = {}): SpotlightEvent {
  return {
    timestamp: new Date().toISOString(),
    type: "log",
    event_id: "log12345log67890",
    platform: "node",
    ...overrides,
  };
}

const defaultOpts = { limit: "20" };

describe("formatLogs", () => {
  test("shows log count header", () => {
    const out = formatLogs([makeLog()], defaultOpts);
    expect(out).toContain("1 logs");
  });

  test("shows log level and message when available", () => {
    const out = formatLogs(
      [makeLog({ log_level: "warn", log_message: "Something went wrong" })],
      defaultOpts
    );
    expect(out).toContain("warn");
    expect(out).toContain("Something went wrong");
  });

  test("defaults to info level when not specified", () => {
    const out = formatLogs([makeLog()], defaultOpts);
    expect(out).toContain("info");
  });

  test("truncates long messages", () => {
    const longMsg = "x".repeat(200);
    const out = formatLogs(
      [makeLog({ log_message: longMsg })],
      defaultOpts
    );
    expect(out).toContain("...");
    // Should not contain the full message
    expect(out).not.toContain(longMsg);
  });

  test("shows transaction name", () => {
    const out = formatLogs(
      [makeLog({ transaction: "GET /api/health" })],
      defaultOpts
    );
    expect(out).toContain("GET /api/health");
  });

  test("respects --limit", () => {
    const logs = [
      makeLog({ event_id: "aaa" }),
      makeLog({ event_id: "bbb" }),
      makeLog({ event_id: "ccc" }),
    ];
    const out = formatLogs(logs, { limit: "2" });
    expect(out).toContain("2 logs");
  });

  test("returns JSON when --json is set", () => {
    const logs = [makeLog()];
    const out = formatLogs(logs, { ...defaultOpts, json: true });
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].type).toBe("log");
  });

  test("shows friendly message when no logs", () => {
    const out = formatLogs([], defaultOpts);
    expect(out).toContain("No logs");
  });
});
