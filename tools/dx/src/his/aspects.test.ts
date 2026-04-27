import { describe, expect, it } from "bun:test";
import { validateRegistryForTest } from "./aspects";

describe("validateRegistry", () => {
  it("passes a clean registry", () => {
    const w = validateRegistryForTest({
      _doc: "ok",
      shared: { vibe: { aliases: ["v"], hint: "overall" } },
    });
    expect(w).toEqual([]);
  });

  it("warns on typo'd field name (alaises -> aliases)", () => {
    const w = validateRegistryForTest({
      shared: { vibe: { alaises: ["v"] } },
    });
    expect(w.some((m) => m.includes("alaises") && m.includes('typo for "aliases"'))).toBe(true);
  });

  it("warns on duplicate aspect across buckets", () => {
    const w = validateRegistryForTest({
      human: { vibe: {} },
      shared: { vibe: {} },
    });
    expect(w.some((m) => m.includes('"vibe"') && m.includes("both"))).toBe(true);
  });

  it("warns on alias collision", () => {
    const w = validateRegistryForTest({
      shared: {
        vibe: { aliases: ["v"] },
        velocity: { aliases: ["v"] },
      },
    });
    expect(w.some((m) => m.includes('"v"') && m.includes("both"))).toBe(true);
  });

  it("warns on non-array aliases", () => {
    const w = validateRegistryForTest({
      shared: { vibe: { aliases: "v" } },
    });
    expect(w.some((m) => m.includes("aliases must be an array"))).toBe(true);
  });

  it("warns on unknown top-level key", () => {
    const w = validateRegistryForTest({
      bots: { foo: {} },
    });
    expect(w.some((m) => m.includes("unknown top-level key") && m.includes("bots"))).toBe(true);
  });
});
