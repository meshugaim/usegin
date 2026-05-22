import { describe, it, expect } from "bun:test";
import { selectSnapshotsToPrune, type Snapshot } from "../src/lib/hcloud";

// Four snapshots, oldest → newest by id.
const snaps: Snapshot[] = [
  { id: 1, created: "2026-05-20T10:00:00Z" },
  { id: 2, created: "2026-05-21T10:00:00Z" },
  { id: 3, created: "2026-05-22T10:00:00Z" },
  { id: 4, created: "2026-05-23T10:00:00Z" },
];

describe("selectSnapshotsToPrune — keep the latest N", () => {
  it("returns the oldest ids (newest survive) when there are more than N", () => {
    // keep 2 → survivors {4,3}; prune the rest, newest-of-the-doomed first.
    expect(selectSnapshotsToPrune(snaps, 2)).toEqual([2, 1]);
  });

  it("prunes nothing when keep >= the snapshot count", () => {
    expect(selectSnapshotsToPrune(snaps, 4)).toEqual([]);
    expect(selectSnapshotsToPrune(snaps, 10)).toEqual([]);
  });

  it("prunes everything when keep is 0 (the explicit footgun)", () => {
    expect(selectSnapshotsToPrune(snaps, 0)).toEqual([4, 3, 2, 1]);
  });

  it("floors a negative keep at 0 (prunes everything)", () => {
    expect(selectSnapshotsToPrune(snaps, -1)).toEqual([4, 3, 2, 1]);
  });

  it("floors a fractional keep", () => {
    // keep 1.9 → floor 1 → survivor {4}; prune {3,2,1}.
    expect(selectSnapshotsToPrune(snaps, 1.9)).toEqual([3, 2, 1]);
  });

  it("returns nothing for an empty lineage", () => {
    expect(selectSnapshotsToPrune([], 3)).toEqual([]);
  });

  it("does not mutate its input", () => {
    const before = snaps.map((s) => s.id);
    selectSnapshotsToPrune(snaps, 1);
    expect(snaps.map((s) => s.id)).toEqual(before);
  });
});
