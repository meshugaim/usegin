import { describe, it, expect } from "bun:test";
import {
  pickLatestSnapshot, buildCreateFromSnapshotArgs, buildSnapshotArgs, resolveTargetName,
  type Snapshot, type ServerInfo,
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
