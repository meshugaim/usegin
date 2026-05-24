import { describe, it, expect } from "bun:test";
import { parseActivity, ACTIVITY_PROBE } from "../src/lib/activity";

const NOW = new Date("2026-05-23T12:00:00.000Z");

describe("parseActivity — trusted signals", () => {
  it("ACTIVE → activity is now", () => {
    const r = parseActivity("ACTIVE\n", NOW);
    expect(r.lastActivity).toBe(NOW.toISOString());
    expect(r.detail).toContain("active");
  });

  it("IDLE <n> → n seconds before now (anchored to the watcher clock)", () => {
    const r = parseActivity("IDLE 600\n", NOW); // 10 minutes ago
    expect(r.lastActivity).toBe(new Date(NOW.getTime() - 600_000).toISOString());
    expect(r.detail).toContain("600s");
  });

  it("IDLE 0 → exactly now", () => {
    const r = parseActivity("IDLE 0", NOW);
    expect(r.lastActivity).toBe(NOW.toISOString());
  });

  it("clamps a negative age (box clock ahead) to 'just now', never the future", () => {
    const r = parseActivity("IDLE -120", NOW);
    expect(r.lastActivity).toBe(NOW.toISOString());
  });
});

describe("parseActivity — unknown (never idle-downed)", () => {
  it("NONE → null", () => {
    const r = parseActivity("NONE\n", NOW);
    expect(r.lastActivity).toBeNull();
    expect(r.detail).toContain("unknown");
  });

  it("empty output → null", () => {
    expect(parseActivity("", NOW).lastActivity).toBeNull();
    expect(parseActivity("   \n  ", NOW).lastActivity).toBeNull();
  });

  it("garbage / unexpected output → null (treated as possibly-working)", () => {
    expect(parseActivity("bash: tmux: command not found", NOW).lastActivity).toBeNull();
    expect(parseActivity("IDLE", NOW).lastActivity).toBeNull(); // missing number
    expect(parseActivity("IDLE abc", NOW).lastActivity).toBeNull();
  });
});

describe("parseActivity — output hygiene", () => {
  it("reads the LAST non-empty line, tolerating ssh banner/MOTD noise above it", () => {
    // ssh can print a login banner before the command output; the verdict is the
    // final line.
    const noisy = "Welcome to Ubuntu\nLast login: ...\nACTIVE\n";
    expect(parseActivity(noisy, NOW).lastActivity).toBe(NOW.toISOString());
  });
});

describe("ACTIVITY_PROBE", () => {
  it("uses the [c]laude self-match dodge so pgrep never matches itself", () => {
    expect(ACTIVITY_PROBE).toContain("[c]laude");
  });

  it("keys on a claude process or an ATTACHED tmux client, never on login sessions", () => {
    // `who`/login-session checks would count the probe's own ssh pts as activity
    // and pin every box 'busy' forever — the self-probe trap. Guard against a
    // regression that reintroduces it.
    expect(ACTIVITY_PROBE).toContain("pgrep -f '[c]laude'");
    expect(ACTIVITY_PROBE).toContain("tmux list-clients");
    expect(ACTIVITY_PROBE).not.toContain("who");
  });

  it("emits exactly one of ACTIVE / IDLE / NONE", () => {
    expect(ACTIVITY_PROBE).toContain("echo ACTIVE");
    expect(ACTIVITY_PROBE).toContain("IDLE");
    expect(ACTIVITY_PROBE).toContain("echo NONE");
  });
});
