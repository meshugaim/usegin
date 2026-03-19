/**
 * Tests for timestamp-based turn filtering.
 *
 * Covers:
 * - parseRelativeTime: converting "5m", "1h", "2d" to a Date in the past
 * - parseTimestampArg: resolving both ISO 8601 and relative formats to a Date
 * - filterByTimestamp: keeping/removing turns based on a cutoff date
 */

import { describe, it, expect } from "bun:test";
import { userTurn, assistantTurn } from "./testing";
import {
  parseRelativeTime,
  parseTimestampArg,
  filterByTimestamp,
  resolveCommitTimestamp,
} from "./filter-by-timestamp";

describe("parseRelativeTime", () => {
  it('parses "5m" as approximately 5 minutes ago', () => {
    const now = Date.now();
    const result = parseRelativeTime("5m");
    const expectedMs = 5 * 60_000;
    // Allow 100ms tolerance for execution time
    expect(Math.abs(now - result.getTime() - expectedMs)).toBeLessThan(100);
  });

  it('parses "1h" as approximately 1 hour ago', () => {
    const now = Date.now();
    const result = parseRelativeTime("1h");
    const expectedMs = 1 * 3_600_000;
    expect(Math.abs(now - result.getTime() - expectedMs)).toBeLessThan(100);
  });

  it('parses "2d" as approximately 2 days ago', () => {
    const now = Date.now();
    const result = parseRelativeTime("2d");
    const expectedMs = 2 * 86_400_000;
    expect(Math.abs(now - result.getTime() - expectedMs)).toBeLessThan(100);
  });

  it('parses "30s" as approximately 30 seconds ago', () => {
    const now = Date.now();
    const result = parseRelativeTime("30s");
    const expectedMs = 30 * 1000;
    expect(Math.abs(now - result.getTime() - expectedMs)).toBeLessThan(100);
  });

  it("throws on invalid relative time format", () => {
    expect(() => parseRelativeTime("xyz")).toThrow('Invalid relative time: "xyz"');
  });

  it("throws on missing unit", () => {
    expect(() => parseRelativeTime("5")).toThrow('Invalid relative time: "5"');
  });

  it("throws on unsupported unit", () => {
    expect(() => parseRelativeTime("5w")).toThrow('Invalid relative time: "5w"');
  });
});

describe("parseTimestampArg", () => {
  it("resolves ISO 8601 format to a Date", () => {
    const result = parseTimestampArg("2026-03-19T10:30:00");
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(new Date("2026-03-19T10:30:00").getTime());
  });

  it("resolves ISO 8601 with timezone to a Date", () => {
    const result = parseTimestampArg("2026-03-19T10:30:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(new Date("2026-03-19T10:30:00Z").getTime());
  });

  it("resolves relative format to a Date", () => {
    const now = Date.now();
    const result = parseTimestampArg("5m");
    const expectedMs = 5 * 60_000;
    expect(Math.abs(now - result.getTime() - expectedMs)).toBeLessThan(100);
  });

  it("throws on invalid format", () => {
    expect(() => parseTimestampArg("xyz")).toThrow(
      'Invalid timestamp: "xyz". Use ISO 8601 or relative (5m, 1h, 2d).'
    );
  });

  it("throws on empty string", () => {
    expect(() => parseTimestampArg("")).toThrow(
      'Invalid timestamp: "". Use ISO 8601 or relative (5m, 1h, 2d).'
    );
  });
});

describe("filterByTimestamp", () => {
  const cutoff = new Date("2026-03-19T10:00:00Z");

  it("keeps turns with timestamp after the cutoff", () => {
    const turns = [
      userTurn("u1", "Hello", { timestamp: "2026-03-19T11:00:00Z" }),
      assistantTurn("a1", "Hi!", { timestamp: "2026-03-19T12:00:00Z" }),
    ];
    const result = filterByTimestamp(turns, cutoff);
    expect(result).toHaveLength(2);
  });

  it("removes turns with timestamp before the cutoff", () => {
    const turns = [
      userTurn("u1", "Old message", { timestamp: "2026-03-19T08:00:00Z" }),
      assistantTurn("a1", "Old reply", { timestamp: "2026-03-19T09:00:00Z" }),
    ];
    const result = filterByTimestamp(turns, cutoff);
    expect(result).toHaveLength(0);
  });

  it("keeps turns with no timestamp (don't filter if we can't compare)", () => {
    const turns = [
      userTurn("u1", "No timestamp"),
      assistantTurn("a1", "Also no timestamp"),
    ];
    const result = filterByTimestamp(turns, cutoff);
    expect(result).toHaveLength(2);
  });

  it("filters a mix of before, after, and missing timestamps", () => {
    const turns = [
      userTurn("u1", "Before", { timestamp: "2026-03-19T08:00:00Z" }),
      assistantTurn("a1", "After", { timestamp: "2026-03-19T11:00:00Z" }),
      userTurn("u2", "No timestamp"),
      assistantTurn("a2", "Exactly at cutoff", { timestamp: "2026-03-19T10:00:00Z" }),
    ];
    const result = filterByTimestamp(turns, cutoff);
    // u1 is before cutoff (removed), a1 is after (kept), u2 has no timestamp (kept), a2 is exactly at cutoff (kept)
    expect(result).toHaveLength(3);
    expect(result[0]!.text).toBe("After");
    expect(result[1]!.text).toBe("No timestamp");
    expect(result[2]!.text).toBe("Exactly at cutoff");
  });

  it("returns empty array for empty input", () => {
    const result = filterByTimestamp([], cutoff);
    expect(result).toHaveLength(0);
  });
});

describe("resolveCommitTimestamp", () => {
  it("returns a Date for a valid full SHA", async () => {
    const result = await resolveCommitTimestamp("4a926940b6e05322522e014c11e2b90bb85aa66d");
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).not.toBeNaN();
  });

  it("returns a Date for a short SHA (7+ chars)", async () => {
    const result = await resolveCommitTimestamp("4a92694");
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).not.toBeNaN();
  });

  it("throws for an invalid/non-existent SHA", async () => {
    await expect(
      resolveCommitTimestamp("0000000000000000000000000000000000000000")
    ).rejects.toThrow('Could not resolve commit "0000000000000000000000000000000000000000"');
  });

  it("throws for a non-git directory", async () => {
    await expect(resolveCommitTimestamp("4a92694", "/tmp")).rejects.toThrow(
      'Could not resolve commit "4a92694"'
    );
  });

  it("throws for empty string", async () => {
    await expect(resolveCommitTimestamp("")).rejects.toThrow(
      "Commit SHA is required"
    );
  });
});
