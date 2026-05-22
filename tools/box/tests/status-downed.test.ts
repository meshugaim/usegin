import { describe, it, expect } from "bun:test";
import {
  boxNameFromRole, groupSnapshotsByBox, formatAllBoxesSummary, buildAllBoxesJsonWithTotals,
  type BoxSummaryRow, type ServerInfo, type Snapshot, type SnapshotGroup,
} from "../src/lib/hcloud";
import { snapshotStorageCost } from "../src/lib/cost";

function srv(p: Partial<ServerInfo> & { id: number; name: string }): ServerInfo {
  return {
    status: "running",
    server_type: { name: "cpx42" },
    public_net: { ipv4: { ip: "1.2.3.4" } },
    datacenter: { name: "nbg1-dc3" },
    ...p,
  };
}

describe("boxNameFromRole", () => {
  it("strips exactly one trailing -devbox", () => {
    expect(boxNameFromRole("agent-a-devbox")).toBe("agent-a");
    // The default box round-trips through the doubled suffix.
    expect(boxNameFromRole("effi-devbox-devbox")).toBe("effi-devbox");
  });

  it("returns null for non-devbox / empty / suffix-only roles", () => {
    expect(boxNameFromRole("some-other-label")).toBeNull();
    expect(boxNameFromRole("-devbox")).toBeNull(); // nothing before the suffix
    expect(boxNameFromRole(undefined)).toBeNull();
    expect(boxNameFromRole("")).toBeNull();
  });
});

describe("groupSnapshotsByBox", () => {
  const snaps: Snapshot[] = [
    { id: 1, created: "2026-05-20T10:00:00Z", image_size: 7, labels: { role: "effi-devbox-devbox" } },
    { id: 2, created: "2026-05-21T10:00:00Z", image_size: 8, labels: { role: "effi-devbox-devbox" } },
    { id: 3, created: "2026-05-22T10:00:00Z", image_size: 3, labels: { role: "agent-a-devbox" } },
    { id: 4, created: "2026-05-22T11:00:00Z", image_size: 5, labels: { other: "x" } }, // no role → skipped
    { id: 5, created: "2026-05-22T12:00:00Z", image_size: 9 }, // no labels → skipped
  ];

  it("groups by box name (from the role label), sorted by name, with counts + sizes", () => {
    expect(groupSnapshotsByBox(snaps)).toEqual([
      { name: "agent-a", snapshotCount: 1, snapshotSizesGB: [3] },
      { name: "effi-devbox", snapshotCount: 2, snapshotSizesGB: [7, 8] },
    ]);
  });

  it("skips snapshots without a role=<name>-devbox label", () => {
    const groups = groupSnapshotsByBox(snaps);
    // ids 4 (other label) and 5 (no labels) contribute to no group.
    expect(groups.flatMap((g) => g.snapshotSizesGB)).toEqual([3, 7, 8]);
  });

  it("defaults a missing image_size to 0", () => {
    expect(groupSnapshotsByBox([{ id: 9, created: "2026-05-22T00:00:00Z", labels: { role: "x-devbox" } }]))
      .toEqual([{ name: "x", snapshotCount: 1, snapshotSizesGB: [0] }]);
  });

  it("yields no groups for an empty list", () => {
    expect(groupSnapshotsByBox([])).toEqual([]);
  });
});

const running: BoxSummaryRow[] = [{
  server: srv({ id: 1, name: "effi-devbox", public_net: { ipv4: { ip: "10.0.0.1" } } }),
  snapshotCount: 2,
  price: { hourlyGross: 0.0494, monthlyCapGross: 30.84 },
  snapshotSizesGB: [7, 8],
}];
const downed: SnapshotGroup[] = [{ name: "old-box", snapshotCount: 3, snapshotSizesGB: [10, 10, 10] }];

describe("formatAllBoxesSummary — downed (snapshot-only) boxes", () => {
  it("renders a 'down (snapshot only)' line with snapshot count + storage €/mo", () => {
    const lines = formatAllBoxesSummary(running, downed).split("\n");
    expect(lines[0]).toBe("  effi-devbox  cpx42  running  10.0.0.1  nbg1-dc3  2 snaps  €0.049/hr");
    // (10+10+10)GB × €0.0143 = €0.429/mo → €0.43.
    expect(lines[1]).toBe("  old-box  down (snapshot only)  3 snaps  €0.43/mo");
  });

  it("adds a downed sentence pointing at `box up` and `box prune`", () => {
    const out = formatAllBoxesSummary(running, downed);
    expect(out).toContain("1 down (snapshot only) — `box up <box>` to revive; `box prune <box>` to trim snapshots.");
  });

  it("folds downed snapshot storage into the total storage figure", () => {
    const out = formatAllBoxesSummary(running, downed);
    // running [7,8] + downed [10,10,10] = 45GB × €0.0143 = €0.6435/mo → €0.64.
    expect(out).toContain("total €0.049/hr across running boxes · €0.64/mo snapshot storage");
  });

  it("shows downed boxes even when nothing is running (no '/hr' part, no empty message)", () => {
    const out = formatAllBoxesSummary([], downed);
    expect(out.split("\n")[0]).toBe("  old-box  down (snapshot only)  3 snaps  €0.43/mo");
    expect(out).not.toContain("across running boxes");
    expect(out).toContain("€0.43/mo snapshot storage");
    expect(out).not.toContain("No boxes running");
  });

  it("still shows the empty message when there are no boxes at all", () => {
    expect(formatAllBoxesSummary([], [])).toContain("No boxes running");
  });
});

describe("buildAllBoxesJsonWithTotals — downed boxes", () => {
  it("includes a downed array and counts downed storage in totals", () => {
    const result = buildAllBoxesJsonWithTotals(running, downed);
    expect(result.downed).toEqual([
      { name: "old-box", snapshotCount: 3, storageEurMonthly: snapshotStorageCost([10, 10, 10]) },
    ]);
    expect(result.totals.storageEurMonthly).toBeCloseTo(snapshotStorageCost([7, 8, 10, 10, 10]), 6);
    expect(result.totals.costEurHourly).toBeCloseTo(0.0494, 6);
  });
});
