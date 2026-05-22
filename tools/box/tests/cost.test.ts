import { describe, it, expect } from "bun:test";
import {
  runningCostSoFar, snapshotStorageCost, hoursBetween,
  formatEur, formatEurHourly, formatHours, SNAPSHOT_EUR_PER_GB_MONTH,
} from "../src/lib/cost";

describe("runningCostSoFar", () => {
  it("multiplies hourly gross by hours up for a normal short run", () => {
    // cpx42 gross ~€0.0494/hr, up ~4h → ~€0.20.
    expect(runningCostSoFar({ hourlyGross: 0.0494, hoursUp: 4, monthlyCapGross: 30.84 }))
      .toBeCloseTo(0.1976, 4);
  });

  it("caps spend at the monthly price once hours×hourly exceeds the cap", () => {
    // A full month (730h) at hourly would be ~€36, but the cap is €30.84.
    expect(runningCostSoFar({ hourlyGross: 0.0494, hoursUp: 730, monthlyCapGross: 30.84 }))
      .toBe(30.84);
  });

  it("returns exactly the cap when hours×hourly lands above it", () => {
    expect(runningCostSoFar({ hourlyGross: 1, hoursUp: 100, monthlyCapGross: 25 })).toBe(25);
  });

  it("returns 0 for 0 hours up", () => {
    expect(runningCostSoFar({ hourlyGross: 0.0494, hoursUp: 0, monthlyCapGross: 30.84 })).toBe(0);
  });

  it("floors negative hours at 0 (clock skew never yields negative spend)", () => {
    expect(runningCostSoFar({ hourlyGross: 0.0494, hoursUp: -5, monthlyCapGross: 30.84 })).toBe(0);
  });
});

describe("snapshotStorageCost", () => {
  it("multiplies the summed sizes by the per-GB-month rate", () => {
    // 7GB snapshot → ~€0.10/mo (matches the README cost model).
    expect(snapshotStorageCost([7])).toBeCloseTo(0.1001, 4);
  });

  it("sums multiple snapshot sizes before applying the rate", () => {
    expect(snapshotStorageCost([7, 3])).toBeCloseTo(10 * SNAPSHOT_EUR_PER_GB_MONTH, 6);
  });

  it("returns 0 for an empty list", () => {
    expect(snapshotStorageCost([])).toBe(0);
  });

  it("treats falsy/zero sizes as 0 contribution", () => {
    expect(snapshotStorageCost([0, 0])).toBe(0);
  });
});

describe("hoursBetween", () => {
  it("computes fractional hours between two ISO timestamps", () => {
    expect(hoursBetween("2026-05-22T00:00:00Z", "2026-05-22T04:30:00Z")).toBeCloseTo(4.5, 6);
  });

  it("returns 0 when the end precedes the start (defensive floor)", () => {
    expect(hoursBetween("2026-05-22T04:00:00Z", "2026-05-22T00:00:00Z")).toBe(0);
  });

  it("returns 0 for an unparseable timestamp", () => {
    expect(hoursBetween("not-a-date", "2026-05-22T04:00:00Z")).toBe(0);
    expect(hoursBetween("2026-05-22T00:00:00Z", "nope")).toBe(0);
  });
});

describe("formatting", () => {
  it("formats euros to two decimals", () => {
    expect(formatEur(0.1976)).toBe("€0.20");
    expect(formatEur(30.8429)).toBe("€30.84");
    expect(formatEur(0)).toBe("€0.00");
  });

  it("formats an hourly rate to three decimals", () => {
    expect(formatEurHourly(0.0494)).toBe("€0.049/hr");
    expect(formatEurHourly(0)).toBe("€0.000/hr");
  });

  it("formats small hours with one decimal and large hours rounded", () => {
    expect(formatHours(4.27)).toBe("~4.3h");
    expect(formatHours(0)).toBe("~0.0h");
    expect(formatHours(12.6)).toBe("~13h");
    expect(formatHours(10)).toBe("~10h");
  });
});
