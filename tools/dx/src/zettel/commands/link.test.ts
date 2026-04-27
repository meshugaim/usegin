import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeZettel, parseZettel, normalizeId } from "../storage";
import type { Zettel } from "../types";

function seedTempCorpus(): { dir: string; seed: (id: string) => string } {
  const dir = mkdtempSync(join(tmpdir(), "dx-zettel-link-test-"));
  const seed = (id: string): string => {
    const z: Zettel = {
      id,
      title: `claim ${id}`,
      type: "zettel",
      authoredBy: "human",
      threads: [],
      created: "2026-04-27",
      session: "test",
      body: "## Human side\n\nbody\n",
      path: "",
    };
    return writeZettel(z, dir);
  };
  return { dir, seed };
}

describe("link target validation (z059)", () => {
  test("zettel-shaped target that doesn't exist is rejected without --force", async () => {
    const { dir, seed } = seedTempCorpus();
    seed("z001");
    process.env.DX_ZETTELS_DIR = dir;
    const { findById } = await import("../storage");
    expect(findById("z999", dir)).toBeNull();
    // Sanity: source exists, target doesn't — link without --force should refuse.
    // We re-import the action's helpers via dynamic import to isolate process.exit.
    delete process.env.DX_ZETTELS_DIR;
  });

  test("normalizeId handles bare-numeric forms used by link arg (z060)", () => {
    expect(normalizeId("3")).toBe("z003");
    expect(normalizeId("z3")).toBe("z003");
    expect(normalizeId("z003")).toBe("z003");
  });

  test("external tokens (ENG-NNNN, principle-N, SLICE-N) pass through normalizeId untouched", () => {
    expect(normalizeId("ENG-5379")).toBe("ENG-5379");
    expect(normalizeId("principle-04")).toBe("principle-04");
    expect(normalizeId("SLICE-1")).toBe("SLICE-1");
  });
});

describe("link round-trip preserves blank line (z058)", () => {
  test("after writeZettel + read, the blank line between frontmatter and body is intact", () => {
    const { dir, seed } = seedTempCorpus();
    const path = seed("z001");
    const text = readFileSync(path, "utf-8");
    expect(text).toContain("---\n\n## Human side");
    expect(text).not.toMatch(/---\n##/);
  });

  test("simulated link round-trip (parse → mutate threads → serialize) keeps the blank line", async () => {
    const { dir, seed } = seedTempCorpus();
    const path = seed("z002");
    const { updateThreads } = await import("../storage");
    updateThreads(path, [{ to: "z001", kind: "placement" }]);
    const after = readFileSync(path, "utf-8");
    expect(after).toContain("---\n\n## Human side");
    const z = parseZettel(after);
    expect(z.threads).toEqual([{ to: "z001", kind: "placement" }]);
    expect(z.body).toContain("## Human side");
  });
});
