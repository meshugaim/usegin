import { describe, it, expect } from "bun:test";
import {
  GOLDEN_BASE_LABEL,
  GOLDEN_BASE_AUTHKEY_PATH,
  goldenBaseSelector,
  isValidBoxName,
  buildFirstBootUserData,
  buildGoldenSnapshotArgs,
  planGoldenFinalize,
  buildFinalizeLogoutCommand,
  TAILSCALE_STATE_PATHS,
  wrapBashC,
  chooseSpinSource,
  summarizeGoldenBase,
  formatGoldenBaseLine,
} from "../src/lib/golden-base";
import type { Snapshot } from "../src/lib/hcloud";

const snap = (id: number): Snapshot => ({ id, created: "2026-05-23T00:00:00Z" });

describe("goldenBaseSelector", () => {
  it("selects on the golden-base label, NOT a per-box role label", () => {
    expect(goldenBaseSelector()).toBe(GOLDEN_BASE_LABEL);
    expect(goldenBaseSelector()).toBe("purpose=golden-base");
    // Must not collide with the per-box scheme (config.snapshotSelector → role=…).
    expect(goldenBaseSelector()).not.toContain("role=");
  });
});

describe("isValidBoxName", () => {
  it("accepts RFC-1123 DNS labels", () => {
    expect(isValidBoxName("effi-devbox")).toBe(true);
    expect(isValidBoxName("box1")).toBe(true);
    expect(isValidBoxName("a")).toBe(true);
    expect(isValidBoxName("a".repeat(63))).toBe(true);
  });

  it("rejects names that would break a hostname / shell out", () => {
    expect(isValidBoxName("")).toBe(false);
    expect(isValidBoxName("Effi-Devbox")).toBe(false); // uppercase
    expect(isValidBoxName("-leading")).toBe(false);
    expect(isValidBoxName("trailing-")).toBe(false);
    expect(isValidBoxName("has space")).toBe(false);
    expect(isValidBoxName("a".repeat(64))).toBe(false); // > 63
    expect(isValidBoxName("box;rm -rf /")).toBe(false); // injection attempt
    expect(isValidBoxName("under_score")).toBe(false);
  });
});

describe("buildFirstBootUserData", () => {
  it("sets the OS hostname AND a fresh tailscale up to the box name", () => {
    const ud = buildFirstBootUserData("my-box");
    expect(ud.startsWith("#cloud-config\n")).toBe(true);
    expect(ud).toContain("hostname: my-box");
    expect(ud).toContain("hostnamectl set-hostname my-box");
    expect(ud).toContain("tailscale up");
    expect(ud).toContain("--hostname=my-box");
  });

  it("reads the baked key from disk — never inlines it into metadata", () => {
    const ud = buildFirstBootUserData("my-box");
    // The key is read at runtime from the baked file; it must not be interpolated
    // into the user-data (which lands in Hetzner instance metadata).
    expect(ud).toContain(`--authkey="$(cat ${GOLDEN_BASE_AUTHKEY_PATH})"`);
    expect(ud).not.toMatch(/tskey-/); // no literal key material
  });

  it("throws on an invalid name rather than emitting a broken/injectable config", () => {
    expect(() => buildFirstBootUserData("Bad Name")).toThrow(/invalid box name/);
    expect(() => buildFirstBootUserData("")).toThrow(/invalid box name/);
    expect(() => buildFirstBootUserData("x;reboot")).toThrow(/invalid box name/);
  });
});

describe("buildGoldenSnapshotArgs", () => {
  it("creates a snapshot stamped with the golden-base label", () => {
    const args = buildGoldenSnapshotArgs({ name: "build-box", description: "slice4 golden base" });
    expect(args).toEqual([
      "server", "create-image", "build-box",
      "--type", "snapshot",
      "--description", "slice4 golden base",
      "--label", "purpose=golden-base",
    ]);
  });
});

describe("summarizeGoldenBase / formatGoldenBaseLine", () => {
  it("summarises the latest golden-base snapshot with its disk floor", () => {
    const snaps: Snapshot[] = [
      { id: 1, created: "2026-05-20T00:00:00Z", disk_size: 40 },
      { id: 2, created: "2026-05-23T00:00:00Z", disk_size: 40 },
    ];
    expect(summarizeGoldenBase(snaps)).toEqual({ id: 2, diskSizeGB: 40, created: "2026-05-23T00:00:00Z" });
  });

  it("is null when no golden base exists, and the line says so", () => {
    expect(summarizeGoldenBase([])).toBeNull();
    expect(formatGoldenBaseLine(null)).toContain("none yet");
  });

  it("renders the disk floor a box spun from it would need", () => {
    const line = formatGoldenBaseLine({ id: 389645657, diskSizeGB: 40, created: "2026-05-23T11:34:28Z" });
    expect(line).toContain("389645657");
    expect(line).toContain(">=40GB");
    expect(line).toContain("2026-05-23");
  });
});

describe("chooseSpinSource", () => {
  it("prefers a box's own snapshot — identity preserved, no first-boot injection", () => {
    const c = chooseSpinSource(snap(111), snap(999))!;
    expect(c).toEqual({ image: 111, source: "per-box", identityless: false });
  });

  it("falls back to the golden base for a new box — identity-less, needs first-boot", () => {
    const c = chooseSpinSource(null, snap(999))!;
    expect(c).toEqual({ image: 999, source: "golden-base", identityless: true });
  });

  it("returns null when there's neither a per-box snapshot nor a golden base", () => {
    expect(chooseSpinSource(null, null)).toBeNull();
  });
});

describe("wrapBashC", () => {
  it("keeps a multi-word command as one bash -c argument (the ssh-flatten bug)", () => {
    // The whole command must stay inside one pair of quotes — so that after ssh
    // flattens argv and the remote shell re-splits, `bash -c` still gets it whole.
    expect(wrapBashC("sudo tee /x && sudo chmod 600 /x")).toBe(
      "bash -c 'sudo tee /x && sudo chmod 600 /x'",
    );
  });

  it("escapes embedded single quotes POSIX-style", () => {
    expect(wrapBashC("echo 'hi'")).toBe(`bash -c 'echo '\\''hi'\\'''`);
  });

  it("survives the nested bash -c the deferred scrub needs (the load-bearing case)", () => {
    // sshExec wraps EVERY remote command in wrapBashC, so the deferred logout is a
    // `bash -c` (singleQuote) nested inside wrapBashC's `bash -c`. If singleQuote
    // didn't nest cleanly, ssh argv-flattening + remote re-split would shred the
    // scrub and the snapshot would re-capture the poisoned state. Pin the exact
    // wire string so a quoting regression can't pass silently.
    const wireString = wrapBashC(buildFinalizeLogoutCommand());
    expect(wireString).toBe(
      "bash -c 'sudo systemd-run --on-active=3s --unit=box-ts-logout --collect bash -c " +
        "'\\''timeout 8s tailscale logout; systemctl stop tailscaled; rm -rf " +
        "/var/lib/tailscale/tailscaled.state* /var/lib/tailscale/profile-data'\\'''",
    );
  });
});

describe("planGoldenFinalize", () => {
  const steps = planGoldenFinalize("build-box");

  it("orders the steps so the box is never locked out prematurely", () => {
    expect(steps.map((s) => s.id)).toEqual(["bake-key", "harden", "logout", "snapshot"]);
  });

  it("hardens BEFORE logout (harden-firewall refuses with tailscale down)", () => {
    const harden = steps.findIndex((s) => s.id === "harden");
    const logout = steps.findIndex((s) => s.id === "logout");
    expect(harden).toBeLessThan(logout);
  });

  it("flags logout as the irreversible step that drives the confirm gate", () => {
    const logout = steps.find((s) => s.id === "logout")!;
    expect(logout.irreversible).toBe(true);
    // Logout is the last on-box (ssh) step; the snapshot runs via the API after.
    expect(steps.filter((s) => s.kind === "ssh").at(-1)!.id).toBe("logout");
    expect(steps.at(-1)!.kind).toBe("hcloud");
  });

  it("never leaks key material into a step's detail", () => {
    for (const s of steps) expect(s.detail).not.toMatch(/tskey-/);
  });

  it("logout step advertises the local state wipe (so the dry-run plan is honest)", () => {
    // The dry-run plan must say it scrubs LOCAL state, not just `tailscale
    // logout` — logout alone leaves a snapshot that panics tailscaled on boot.
    const logout = steps.find((s) => s.id === "logout")!;
    expect(logout.detail).toMatch(/state|wipe|scrub/i);
  });
});

describe("buildFinalizeLogoutCommand", () => {
  const cmd = buildFinalizeLogoutCommand();

  it("logs out AND wipes local tailscale state (logout alone bricks the snapshot)", () => {
    // `tailscale logout` clears the node key but leaves tailscaled.state's
    // tailnet-lock (tka) data behind — tailscaled then panics on the next boot
    // from the snapshot (nil-pointer in tkaSyncIfNeeded), so every spun box
    // can't start tailscaled and never joins the tailnet. Finalize must also
    // stop the daemon and remove the local state. Root-caused live (v2debug).
    expect(cmd).toContain("tailscale logout");
    expect(cmd).toContain("systemctl stop tailscaled");
    expect(cmd).toContain("rm -rf");
    expect(cmd).toContain("/var/lib/tailscale/tailscaled.state");
    expect(cmd).toContain("/var/lib/tailscale/profile-data");
  });

  it("wipes exactly the state paths the boot panic comes from", () => {
    expect(cmd).toContain(TAILSCALE_STATE_PATHS);
  });

  it("defers via systemd-run so our own ssh session returns before the tailnet drops", () => {
    // logout / stopping tailscaled severs our tailnet ssh session; running it
    // synchronously returns a broken-pipe failure even on success. Schedule it
    // a few seconds out so the ssh call returns 0 first; --collect reaps the unit.
    expect(cmd).toContain("systemd-run");
    expect(cmd).toMatch(/--on-active=\d+s/);
    expect(cmd).toContain("--collect");
  });

  it("caps logout with `timeout` and uses `;` so a slow/failed logout never blocks the wipe", () => {
    // `tailscale logout` contacts the control server and can run many seconds.
    // The snapshot is taken after a fixed delay, so the wipe must NOT wait on
    // logout — cap it and sequence with `;` (not `&&`) so the wipe always runs.
    expect(cmd).toMatch(/timeout \d+s? tailscale logout/);
    const wipeIdx = cmd.indexOf("rm -rf");
    const stopIdx = cmd.indexOf("systemctl stop tailscaled");
    const logoutIdx = cmd.indexOf("tailscale logout");
    expect(logoutIdx).toBeLessThan(stopIdx); // logout (best-effort) before the stop
    expect(stopIdx).toBeLessThan(wipeIdx); // stop the daemon before removing its state
    // The separators MUST be `;` (unconditional), not `&&` (short-circuit): a
    // failed/timed-out logout must NOT abort the wipe, or the snapshot re-captures
    // the poisoned state and bricks every spun box. `&&` here would silently
    // reintroduce that — pin it so a future refactor can't.
    expect(cmd).not.toContain("&&");
    expect(cmd).toMatch(/tailscale logout; *systemctl stop tailscaled; *rm -rf/);
  });

  it("never inlines key material", () => {
    expect(cmd).not.toMatch(/tskey-/);
  });
});
