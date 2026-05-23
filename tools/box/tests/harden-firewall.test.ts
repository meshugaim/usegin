import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

// `box base finalize` (default, no --skip-harden) reads this script and pipes it
// to `sudo bash -s` on the build box (see commands/base.ts), so its contents are
// baked into every hardened golden base. These tests pin the firewall rules so a
// refactor can't silently drop the race-proof tailnet backstop and reintroduce
// the unreachable-brick bug (slice-4 debug, session 918f3748).
const SCRIPT = readFileSync(
  new URL("../../../scripts/hetzner/harden-firewall.sh", import.meta.url).pathname,
  "utf8",
);

describe("harden-firewall.sh", () => {
  it("refuses to close :22 unless tailscale is up (no self-lockout)", () => {
    expect(SCRIPT).toContain("tailscale status");
    expect(SCRIPT).toMatch(/Refusing to close public :22/);
  });

  it("keeps trusting the tailnet by interface (the working-case rule, non-regression)", () => {
    expect(SCRIPT).toContain("ufw allow in on tailscale0");
  });

  it("ALSO trusts the tailnet by source CIDR — interface-independent, race-proof", () => {
    // The interface rule has a boot race: a box spun from a hardened snapshot
    // loads ufw rules before tailscale0 exists, so the iface rule can be inert and
    // tailnet :22 gets dropped → unreachable brick. The CGNAT/ULA source rules
    // match regardless of when the interface appears, so they backstop the race.
    expect(SCRIPT).toContain("ufw allow from 100.64.0.0/10"); // Tailscale CGNAT v4
    expect(SCRIPT).toContain("ufw allow from fd7a:115c:a1e0::/48"); // Tailscale ULA v6
  });

  it("trusts ALL tailnet ports, not only :22 (serve-static needs 9000-9009 over the tailnet)", () => {
    // A `to any port 22` scoping here would re-break serve-static over the tailnet.
    // The backstop must be as broad as the interface rule it backs: any port.
    expect(SCRIPT).not.toMatch(/ufw allow from 100\.64\.0\.0\/10 .*port/);
  });

  it("makes the v6 backstop best-effort so a v6-disabled ufw can't abort hardening under set -e", () => {
    expect(SCRIPT).toMatch(/ufw allow from fd7a:115c:a1e0::\/48[^\n]*\|\| true/);
  });

  it("adds the trust rules BEFORE enabling ufw, so they're live the moment it's enabled", () => {
    const cgnat = SCRIPT.indexOf("ufw allow from 100.64.0.0/10");
    const enable = SCRIPT.indexOf("ufw --force enable");
    expect(cgnat).toBeGreaterThan(-1);
    expect(enable).toBeGreaterThan(-1);
    expect(cgnat).toBeLessThan(enable);
  });

  it("still removes the public OpenSSH allow (the actual hardening)", () => {
    expect(SCRIPT).toContain("ufw delete allow OpenSSH");
  });
});
