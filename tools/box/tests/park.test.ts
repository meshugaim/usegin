import { describe, it, expect } from "bun:test";
import { buildSnapshotArgs } from "../src/lib/hcloud";
import { snapshotSelector } from "../src/lib/config";

/**
 * `box park` snapshots WITHOUT deleting. The snapshot args it sends are exactly
 * `buildSnapshotArgs` with the box's own `role=<name>-devbox` selector — same
 * lineage `box up` / `box down` use, so a parked checkpoint revives via `box up`.
 * (Park's no-delete behaviour is the IO-only difference from `down`; that side is
 * covered by the human's real-infra self-test, not unit tests.)
 */
describe("park snapshot args", () => {
  it("snapshots into the box's own lineage so `box up` can revive it", () => {
    const name = "agent-a";
    const description = "agent-a 2026-05-22T11:09:45Z";
    const args = buildSnapshotArgs({ name, description, label: snapshotSelector(name) });

    expect(args).toEqual([
      "server", "create-image", "agent-a",
      "--type", "snapshot",
      "--description", "agent-a 2026-05-22T11:09:45Z",
      "--label", "role=agent-a-devbox",
    ]);
  });

  it("never includes a server-delete verb (park keeps the box)", () => {
    const args = buildSnapshotArgs({
      name: "effi-devbox",
      description: "effi-devbox 2026-05-22T00:00:00Z",
      label: snapshotSelector("effi-devbox"),
    });
    expect(args).not.toContain("delete");
    expect(args).toContain("create-image");
  });
});
