import { describe, it, expect } from "bun:test";
import {
  pickLatestSnapshot, buildCreateFromSnapshotArgs, buildSnapshotArgs, resolveTargetName,
  parseServerTypePrice,
  type Snapshot, type ServerInfo, type ServerTypePriceEntry,
} from "../src/lib/hcloud";

describe("pickLatestSnapshot", () => {
  it("returns null for an empty list", () => {
    expect(pickLatestSnapshot([])).toBeNull();
  });

  it("picks the most recently created snapshot regardless of input order", () => {
    const snaps: Snapshot[] = [
      { id: 1, created: "2026-05-20T16:37:19Z" },
      { id: 3, created: "2026-05-22T11:09:45Z" },
      { id: 2, created: "2026-05-22T00:27:32Z" },
    ];
    expect(pickLatestSnapshot(snaps)?.id).toBe(3);
  });
});

describe("buildCreateFromSnapshotArgs", () => {
  it("builds the hcloud server create args", () => {
    expect(buildCreateFromSnapshotArgs({
      name: "effi-devbox", type: "cpx42", image: 389291091,
      location: "nbg1", sshKey: "effi-devbox", label: "role=effi-devbox-devbox",
    })).toEqual([
      "server", "create",
      "--name", "effi-devbox",
      "--type", "cpx42",
      "--image", "389291091",
      "--location", "nbg1",
      "--ssh-key", "effi-devbox",
      "--label", "role=effi-devbox-devbox",
    ]);
  });
});

describe("buildSnapshotArgs", () => {
  it("builds the hcloud server create-image args", () => {
    expect(buildSnapshotArgs({
      name: "effi-devbox", description: "effi-devbox 2026-05-22T11:09:45Z", label: "role=effi-devbox-devbox",
    })).toEqual([
      "server", "create-image", "effi-devbox",
      "--type", "snapshot",
      "--description", "effi-devbox 2026-05-22T11:09:45Z",
      "--label", "role=effi-devbox-devbox",
    ]);
  });
});

describe("resolveTargetName", () => {
  const servers: ServerInfo[] = [
    { id: 132357453, name: "effi-devbox", status: "running" },
    { id: 132378378, name: "effi-spike-rc", status: "running" },
  ];

  it("falls back to the default name when no selector is given", () => {
    expect(resolveTargetName({}, "effi-devbox", servers)).toEqual({ name: "effi-devbox" });
  });

  it("resolves a name selector", () => {
    expect(resolveTargetName({ selector: "effi-spike-rc" }, "effi-devbox", servers)).toEqual({ name: "effi-spike-rc" });
  });

  it("resolves a numeric id selector to its box name", () => {
    expect(resolveTargetName({ selector: "132378378" }, "effi-devbox", servers)).toEqual({ name: "effi-spike-rc" });
  });

  it("errors when an id/name selector matches nothing", () => {
    const res = resolveTargetName({ selector: "999999" }, "effi-devbox", servers);
    expect(res.name).toBeUndefined();
    expect(res.error).toContain("999999");
  });
});

describe("parseServerTypePrice", () => {
  // Mirrors the real `hcloud server-type describe cpx42 -o json` price shape
  // (gross strings; multiple locations with different prices for `sin`).
  const prices: ServerTypePriceEntry[] = [
    { location: "fsn1", price_hourly: { gross: "0.0493680000000000" }, price_monthly: { gross: "30.8429000000000000" } },
    { location: "nbg1", price_hourly: { gross: "0.0493680000000000" }, price_monthly: { gross: "30.8429000000000000" } },
    { location: "sin", price_hourly: { gross: "0.1085370000000000" }, price_monthly: { gross: "67.7479000000000000" } },
  ];

  it("prefers the requested location's price", () => {
    expect(parseServerTypePrice(prices, "sin")).toEqual({ hourlyGross: 0.108537, monthlyCapGross: 67.7479 });
  });

  it("coerces gross strings to numbers for the nbg1 entry", () => {
    expect(parseServerTypePrice(prices, "nbg1")).toEqual({ hourlyGross: 0.049368, monthlyCapGross: 30.8429 });
  });

  it("falls back to the first entry when the location is missing or unknown", () => {
    expect(parseServerTypePrice(prices)).toEqual({ hourlyGross: 0.049368, monthlyCapGross: 30.8429 });
    expect(parseServerTypePrice(prices, "atlantis")).toEqual({ hourlyGross: 0.049368, monthlyCapGross: 30.8429 });
  });

  it("returns null for an empty or missing prices array", () => {
    expect(parseServerTypePrice([])).toBeNull();
    expect(parseServerTypePrice(undefined)).toBeNull();
  });

  it("returns null when a price field is unparseable", () => {
    expect(parseServerTypePrice([{ location: "x", price_hourly: { gross: "oops" }, price_monthly: { gross: "1" } }])).toBeNull();
    expect(parseServerTypePrice([{ location: "x", price_hourly: {}, price_monthly: {} }])).toBeNull();
  });
});
