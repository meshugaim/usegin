import { describe, it, expect } from "bun:test";
import { parsePort, resolveConfig, snapshotSelector, DEFAULTS } from "../src/lib/config";

describe("resolveConfig", () => {
  it("uses built-in defaults with an empty env", () => {
    const cfg = resolveConfig({});
    expect(cfg.name).toBe(DEFAULTS.name);
    expect(cfg.mgmtName).toBe("effi-mgmt"); // always-on mgmt box (slice 6)
    expect(cfg.type).toBe("cpx42");
    expect(cfg.location).toBe("nbg1");
    expect(cfg.baseImage).toBe("ubuntu-24.04");
    expect(cfg.sshKeyName).toBe(""); // unset by default
    expect(cfg.repoUrl).toBe(DEFAULTS.repoUrl);
  });

  it("honours legacy HETZNER_* env as a fallback", () => {
    const cfg = resolveConfig({
      HETZNER_SERVER_NAME: "legacy-box",
      HETZNER_SERVER_TYPE: "ccx33",
      HETZNER_SSH_KEY_NAME: "my-key",
    });
    expect(cfg.name).toBe("legacy-box");
    expect(cfg.type).toBe("ccx33");
    expect(cfg.sshKeyName).toBe("my-key");
  });

  it("prefers BOX_* over legacy HETZNER_*", () => {
    const cfg = resolveConfig({
      BOX_NAME: "new-box",
      HETZNER_SERVER_NAME: "legacy-box",
      BOX_TYPE: "cax11",
      HETZNER_SERVER_TYPE: "ccx33",
    });
    expect(cfg.name).toBe("new-box");
    expect(cfg.type).toBe("cax11");
  });

  it("resolves the mgmt box name from BOX_MGMT_NAME (no legacy HETZNER_* name)", () => {
    expect(resolveConfig({}).mgmtName).toBe("effi-mgmt");
    expect(resolveConfig({ BOX_MGMT_NAME: "ops-box" }).mgmtName).toBe("ops-box");
  });
});

describe("resolveConfig — lease server fields (slice 7, push model)", () => {
  it("defaults leasePort to 9100 (outside the work boxes' serve-static range)", () => {
    expect(resolveConfig({}).leasePort).toBe(DEFAULTS.leasePort);
    expect(resolveConfig({}).leasePort).toBe(9100);
  });

  it("reads a valid BOX_LEASE_PORT", () => {
    expect(resolveConfig({ BOX_LEASE_PORT: "9200" }).leasePort).toBe(9200);
    expect(resolveConfig({ BOX_LEASE_PORT: " 8080 " }).leasePort).toBe(8080);
    expect(resolveConfig({ BOX_LEASE_PORT: "65535" }).leasePort).toBe(65535);
  });

  it("falls back to the default for an invalid BOX_LEASE_PORT (no garbage to Bun.serve)", () => {
    // Each of these would otherwise reach Bun.serve and either throw or, worse,
    // silently clamp (it clamps >65535 to 65535). Config fails soft to default.
    for (const bad of ["", "abc", "0", "-1", "99999abc", "70000", "1e3", "3.5"]) {
      expect(resolveConfig({ BOX_LEASE_PORT: bad }).leasePort).toBe(DEFAULTS.leasePort);
    }
  });

  it("defaults leaseStorePath under $HOME/.box/leases.json", () => {
    expect(resolveConfig({ HOME: "/home/dev" }).leaseStorePath).toBe("/home/dev/.box/leases.json");
  });

  it("reads an explicit BOX_LEASE_STORE verbatim", () => {
    expect(resolveConfig({ BOX_LEASE_STORE: "/srv/leases.json" }).leaseStorePath).toBe(
      "/srv/leases.json",
    );
  });

  it("falls back to USERPROFILE, then cwd, when HOME is unset", () => {
    expect(resolveConfig({ USERPROFILE: "C:\\Users\\dev" }).leaseStorePath).toBe(
      "C:\\Users\\dev/.box/leases.json",
    );
    expect(resolveConfig({}).leaseStorePath).toBe(".box/leases.json");
  });
});

describe("parsePort — the shared port validator (flag + env paths)", () => {
  it("accepts a valid port verbatim, trimming surrounding whitespace", () => {
    expect(parsePort("9100")).toBe(9100);
    expect(parsePort(" 8080 ")).toBe(8080);
    expect(parsePort("1")).toBe(1);
    expect(parsePort("65535")).toBe(65535);
  });

  it("rejects non-numeric, empty, and undefined → null", () => {
    expect(parsePort("abc")).toBeNull();
    expect(parsePort("")).toBeNull();
    expect(parsePort("   ")).toBeNull();
    expect(parsePort(undefined)).toBeNull();
  });

  it("rejects zero and negatives → null (a negative is truthy, so `|| default` would leak it)", () => {
    expect(parsePort("0")).toBeNull();
    expect(parsePort("-1")).toBeNull();
  });

  it("rejects trailing junk → null (parseInt('99999abc') would otherwise yield 99999)", () => {
    expect(parsePort("9100abc")).toBeNull();
    expect(parsePort("99999abc")).toBeNull();
    expect(parsePort("1e3")).toBeNull();
    expect(parsePort("3.5")).toBeNull();
    expect(parsePort("08080")).toBeNull(); // leading zero: String(8080) !== "08080"
    expect(parsePort("+80")).toBeNull();
  });

  it("rejects out-of-range → null (Bun.serve silently clamps >65535, never throws)", () => {
    expect(parsePort("65536")).toBeNull();
    expect(parsePort("70000")).toBeNull();
  });
});

describe("snapshotSelector — mgmt box lineage", () => {
  it("ties the mgmt box to its OWN role-labelled snapshots", () => {
    expect(snapshotSelector("effi-mgmt")).toBe("role=effi-mgmt-devbox");
  });
});

describe("snapshotSelector", () => {
  it("matches the hetzner.sh scheme so existing snapshots are found", () => {
    expect(snapshotSelector("effi-devbox")).toBe("role=effi-devbox-devbox");
    expect(snapshotSelector("agent-a")).toBe("role=agent-a-devbox");
  });
});
