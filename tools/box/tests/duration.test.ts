import { describe, it, expect } from "bun:test";
import { parseDuration, formatDuration } from "../src/lib/duration";

describe("parseDuration", () => {
  it("parses single-unit durations to ms", () => {
    expect(parseDuration("500ms")).toBe(500);
    expect(parseDuration("90s")).toBe(90_000);
    expect(parseDuration("30m")).toBe(30 * 60_000);
    expect(parseDuration("8h")).toBe(8 * 3_600_000);
    expect(parseDuration("2d")).toBe(2 * 86_400_000);
  });

  it("sums compound durations like 1h30m", () => {
    expect(parseDuration("1h30m")).toBe(3_600_000 + 30 * 60_000);
    expect(parseDuration("1m30s")).toBe(60_000 + 30_000);
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    expect(parseDuration("  8H ")).toBe(8 * 3_600_000);
    expect(parseDuration("30M")).toBe(30 * 60_000);
  });

  it("does not mistake 500ms for 500m + s", () => {
    // The `ms` alternative must win over `m` so the unit is milliseconds, not
    // minutes — a 500-minute misparse would be a 60000x error.
    expect(parseDuration("500ms")).toBe(500);
  });

  it("rejects a bare number with no unit (ambiguous → would false-down)", () => {
    // `--idle 30` could mean 30ms/s/m/h; guessing ms would fire the idle window
    // in 30ms. Reject loudly instead.
    expect(() => parseDuration("30")).toThrow();
  });

  it("rejects empty and garbage input", () => {
    expect(() => parseDuration("")).toThrow();
    expect(() => parseDuration("   ")).toThrow();
    expect(() => parseDuration("30x")).toThrow();
    expect(() => parseDuration("h")).toThrow();
    expect(() => parseDuration("8h junk")).toThrow();
  });
});

describe("formatDuration", () => {
  it("formats to the two most-significant non-zero units", () => {
    expect(formatDuration(8 * 3_600_000)).toBe("8h");
    expect(formatDuration(3_600_000 + 30 * 60_000)).toBe("1h30m");
    expect(formatDuration(25 * 60_000)).toBe("25m");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(2 * 86_400_000 + 3 * 3_600_000)).toBe("2d3h");
  });

  it("skips a zero middle unit rather than printing 0m", () => {
    // 1h exactly → just "1h" (no trailing 0m).
    expect(formatDuration(3_600_000)).toBe("1h");
    // 1h + 30s (zero minutes between) → "1h30s", NOT "1h0m" — only non-zero
    // units are shown, so the two shown are the hour and the seconds.
    expect(formatDuration(3_600_000 + 30_000)).toBe("1h30s");
  });

  it("renders sub-second and non-positive input as 0s", () => {
    expect(formatDuration(500)).toBe("0s");
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(-5_000)).toBe("0s");
    expect(formatDuration(Number.NaN)).toBe("0s");
  });

  it("round-trips through parseDuration for clean values", () => {
    for (const d of ["30m", "8h", "45s", "2d"]) {
      expect(formatDuration(parseDuration(d))).toBe(d);
    }
  });
});
