import { describe, it, expect } from "bun:test";
import {
  formatAllBoxesSummary, buildAllBoxesJson, buildAllBoxesJsonWithTotals, resolveSize,
  type BoxSummaryRow, type ServerInfo,
} from "../src/lib/hcloud";

function srv(p: Partial<ServerInfo> & { id: number; name: string }): ServerInfo {
  return {
    status: "running",
    server_type: { name: "cpx42" },
    public_net: { ipv4: { ip: "1.2.3.4" } },
    datacenter: { name: "nbg1-dc3" },
    ...p,
  };
}

const rows: BoxSummaryRow[] = [
  { server: srv({ id: 1, name: "effi-devbox", server_type: { name: "cpx42" }, public_net: { ipv4: { ip: "10.0.0.1" } }, datacenter: { name: "nbg1-dc3" } }), snapshotCount: 3 },
  { server: srv({ id: 2, name: "agent-a", server_type: { name: "cpx31" }, status: "initializing", public_net: { ipv4: { ip: "10.0.0.2" } }, datacenter: { name: "fsn1-dc14" } }), snapshotCount: 1 },
];

describe("formatAllBoxesSummary", () => {
  it("renders one line per box (name, type, status, ip, datacenter, snapshot count)", () => {
    const out = formatAllBoxesSummary(rows);
    const lines = out.split("\n");
    expect(lines[0]).toBe("  effi-devbox  cpx42  running  10.0.0.1  nbg1-dc3  3 snaps");
    expect(lines[1]).toBe("  agent-a  cpx31  initializing  10.0.0.2  fsn1-dc14  1 snap");
  });

  it("singularises 'snap' for exactly one snapshot and pluralises otherwise", () => {
    const out = formatAllBoxesSummary(rows);
    expect(out).toContain("3 snaps");
    expect(out).toContain("1 snap\n"); // not "1 snaps"
    expect(out).not.toContain("1 snaps");
  });

  it("ends with a total line that pluralises box count", () => {
    const out = formatAllBoxesSummary(rows);
    expect(out).toContain("2 boxes running");
    expect(formatAllBoxesSummary([rows[0]!])).toContain("1 box running");
  });

  it("shows a helpful empty message and no total when no boxes run", () => {
    const out = formatAllBoxesSummary([]);
    expect(out).toContain("No boxes running");
    expect(out).not.toContain("running — billing");
  });

  it("falls back to '?' for missing type/ip/datacenter", () => {
    const bare: BoxSummaryRow[] = [{ server: { id: 9, name: "bare", status: "running" }, snapshotCount: 0 }];
    expect(formatAllBoxesSummary(bare)).toBe(
      "  bare  ?  running  ?  ?  0 snaps\n\n1 box running — billing per hour. `box status <box>` for detail; `box down <box>` to stop one.",
    );
  });
});

describe("buildAllBoxesJson", () => {
  it("maps each row to a flat JSON object with the snapshot count", () => {
    expect(buildAllBoxesJson(rows)).toEqual([
      { name: "effi-devbox", id: 1, type: "cpx42", status: "running", ip: "10.0.0.1", datacenter: "nbg1-dc3", snapshotCount: 3 },
      { name: "agent-a", id: 2, type: "cpx31", status: "initializing", ip: "10.0.0.2", datacenter: "fsn1-dc14", snapshotCount: 1 },
    ]);
  });

  it("yields an empty array for no boxes", () => {
    expect(buildAllBoxesJson([])).toEqual([]);
  });

  it("nulls missing type/datacenter and empties a missing ip", () => {
    const bare: BoxSummaryRow[] = [{ server: { id: 9, name: "bare", status: "off" }, snapshotCount: 0 }];
    expect(buildAllBoxesJson(bare)).toEqual([
      { name: "bare", id: 9, type: null, status: "off", ip: "", datacenter: null, snapshotCount: 0 },
    ]);
  });
});

describe("resolveSize — --size beats BOX_TYPE beats default", () => {
  it("uses the --size flag when given", () => {
    expect(resolveSize({ sizeFlag: "cpx31", configType: "cpx42" })).toBe("cpx31");
  });

  it("falls back to the configured type (BOX_TYPE / default) without --size", () => {
    expect(resolveSize({ configType: "cpx42" })).toBe("cpx42");
    expect(resolveSize({ sizeFlag: undefined, configType: "cpx42" })).toBe("cpx42");
  });

  it("treats a blank/whitespace --size as absent (config wins)", () => {
    expect(resolveSize({ sizeFlag: "   ", configType: "cpx42" })).toBe("cpx42");
    expect(resolveSize({ sizeFlag: "", configType: "cpx42" })).toBe("cpx42");
  });

  it("trims a padded --size value", () => {
    expect(resolveSize({ sizeFlag: " cpx51 ", configType: "cpx42" })).toBe("cpx51");
  });
});

// Cost rows carry an optional price + snapshot sizes; without them the output is
// byte-identical to the dependency-free view (asserted by the tests above).
const costRows: BoxSummaryRow[] = [
  {
    server: srv({ id: 1, name: "effi-devbox", public_net: { ipv4: { ip: "10.0.0.1" } } }),
    snapshotCount: 1,
    price: { hourlyGross: 0.0494, monthlyCapGross: 30.84 },
    snapshotSizesGB: [7],
  },
  {
    server: srv({ id: 2, name: "agent-a", server_type: { name: "cpx31" }, public_net: { ipv4: { ip: "10.0.0.2" } }, datacenter: { name: "fsn1-dc14" } }),
    snapshotCount: 1,
    price: { hourlyGross: 0.0241, monthlyCapGross: 15.0 },
    snapshotSizesGB: [3],
  },
];

describe("formatAllBoxesSummary — cost", () => {
  it("appends €/hr to each line when a price is known", () => {
    const lines = formatAllBoxesSummary(costRows).split("\n");
    expect(lines[0]).toBe("  effi-devbox  cpx42  running  10.0.0.1  nbg1-dc3  1 snap  €0.049/hr");
    expect(lines[1]).toBe("  agent-a  cpx31  running  10.0.0.2  fsn1-dc14  1 snap  €0.024/hr");
  });

  it("adds a cost footer with total €/hr and total snapshot storage €/mo", () => {
    const out = formatAllBoxesSummary(costRows);
    // 0.0494 + 0.0241 = 0.0735/hr (toFixed(3) → 0.073); (7+3)GB × 0.0143 = €0.143/mo → €0.14.
    expect(out).toContain("total €0.073/hr across running boxes · €0.14/mo snapshot storage");
  });

  it("omits the €/hr suffix and cost footer entirely when no price is present", () => {
    // Same fixture used by the dependency-free tests — must stay identical.
    const out = formatAllBoxesSummary(rows);
    expect(out).not.toContain("/hr");
    expect(out).not.toContain("snapshot storage");
  });
});

describe("buildAllBoxesJsonWithTotals", () => {
  it("wraps the per-box array and adds fleet totals", () => {
    const result = buildAllBoxesJsonWithTotals(costRows);
    expect(result.boxes[0]).toMatchObject({ name: "effi-devbox", costEurHourly: 0.0494, costCapEurMonthly: 30.84 });
    expect(result.boxes[1]).toMatchObject({ name: "agent-a", costEurHourly: 0.0241, costCapEurMonthly: 15.0 });
    expect(result.totals.costEurHourly).toBeCloseTo(0.0735, 6);
    expect(result.totals.storageEurMonthly).toBeCloseTo(0.143, 6);
  });

  it("yields zeroed totals and empty arrays for no boxes", () => {
    expect(buildAllBoxesJsonWithTotals([])).toEqual({ boxes: [], downed: [], totals: { costEurHourly: 0, storageEurMonthly: 0 } });
  });

  it("omits per-row cost keys when a row has no price", () => {
    const result = buildAllBoxesJsonWithTotals(rows);
    expect(result.boxes[0]).not.toHaveProperty("costEurHourly");
    expect(result.totals.costEurHourly).toBe(0);
  });
});
