import { describe, test, expect } from "bun:test";
import { formatErrors } from "./errors";
import type { SpotlightEvent } from "../client";

function makeError(overrides: Partial<SpotlightEvent> = {}): SpotlightEvent {
  return {
    timestamp: new Date().toISOString(),
    type: "error",
    event_id: "err12345err67890",
    platform: "node",
    ...overrides,
  };
}

const defaultOpts = { limit: "20" };

describe("formatErrors", () => {
  test("shows error count header", () => {
    const out = formatErrors([makeError()], defaultOpts);
    expect(out).toContain("1 errors");
  });

  test("shows exception type and message when available", () => {
    const out = formatErrors(
      [
        makeError({
          exception_type: "TypeError",
          exception_value: "Cannot read property 'foo' of undefined",
        }),
      ],
      defaultOpts
    );
    expect(out).toContain("TypeError");
    expect(out).toContain("Cannot read property");
  });

  test("falls back to platform when no exception info", () => {
    const out = formatErrors([makeError({ platform: "node" })], defaultOpts);
    expect(out).toContain("node");
  });

  test("shows transaction name", () => {
    const out = formatErrors(
      [makeError({ transaction: "GET /api/chat" })],
      defaultOpts
    );
    expect(out).toContain("GET /api/chat");
  });

  test("shows trace ID for correlation", () => {
    const out = formatErrors(
      [makeError({ trace_id: "aaaa1111bbbb2222" })],
      defaultOpts
    );
    expect(out).toContain("aaaa1111");
  });

  test("respects --limit", () => {
    const errors = [
      makeError({ event_id: "aaa" }),
      makeError({ event_id: "bbb" }),
      makeError({ event_id: "ccc" }),
    ];
    const out = formatErrors(errors, { limit: "2" });
    expect(out).toContain("2 errors");
  });

  test("returns JSON when --json is set", () => {
    const errors = [makeError()];
    const out = formatErrors(errors, { ...defaultOpts, json: true });
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].type).toBe("error");
  });

  test("shows friendly message when no errors", () => {
    const out = formatErrors([], defaultOpts);
    expect(out).toContain("No errors");
  });
});
