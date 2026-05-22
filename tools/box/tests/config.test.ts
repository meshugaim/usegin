import { describe, it, expect } from "bun:test";
import { resolveConfig, snapshotSelector, DEFAULTS } from "../src/lib/config";

describe("resolveConfig", () => {
  it("uses built-in defaults with an empty env", () => {
    const cfg = resolveConfig({});
    expect(cfg.name).toBe(DEFAULTS.name);
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
});

describe("snapshotSelector", () => {
  it("matches the hetzner.sh scheme so existing snapshots are found", () => {
    expect(snapshotSelector("effi-devbox")).toBe("role=effi-devbox-devbox");
    expect(snapshotSelector("agent-a")).toBe("role=agent-a-devbox");
  });
});
