import { describe, it, expect } from "bun:test";
import {
  GOLDEN_BASE_LABEL,
  GOLDEN_BASE_AUTHKEY_PATH,
  goldenBaseSelector,
  isValidBoxName,
  buildFirstBootUserData,
  buildGoldenSnapshotArgs,
  planGoldenFinalize,
} from "../src/lib/golden-base";

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
});
