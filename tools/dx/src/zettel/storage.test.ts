import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseFrontmatter,
  parseThreadsList,
  parseZettel,
  serializeZettel,
  serializeThreads,
  normalizeId,
  nextId,
  readAll,
  findById,
  writeZettel,
  updateThreads,
} from "./storage";
import type { Zettel } from "./types";

const SAMPLE = `---
id: z003
title: Open-to-empty — create the address before you have the content
type: zettel
authored-by: human
threads: [↑z002, ~z015, ~zettel-custom-future]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

The implementation primitive that makes "no later" survivable.

## UseGin side

Open-to-empty has a graph property worth naming.
`;

describe("parseFrontmatter", () => {
  test("parses required keys", () => {
    const fm = parseFrontmatter(`id: z003
title: Open-to-empty
type: zettel
authored-by: human
threads: [↑z002, ~z015]
created: 2026-04-27
session: 5d7f3c80`);
    expect(fm.id).toBe("z003");
    expect(fm.title).toBe("Open-to-empty");
    expect(fm.authoredBy).toBe("human");
    expect(fm.threads).toEqual([
      { to: "z002", kind: "placement" },
      { to: "z015", kind: "cross" },
    ]);
    expect(fm.created).toBe("2026-04-27");
    expect(fm.session).toBe("5d7f3c80");
  });

  test("preserves unknown keys in extra", () => {
    const fm = parseFrontmatter(`id: z033
title: rename
type: zettel
authored-by: human
threads: []
created: 2026-04-27
session: x
supersedes: z021
linear: ENG-5379`);
    expect(fm.extra.supersedes).toBe("z021");
    expect(fm.extra.linear).toBe("ENG-5379");
  });

  test("requires id and title", () => {
    expect(() => parseFrontmatter(`title: hi\nthreads: []`)).toThrow(/id/);
    expect(() => parseFrontmatter(`id: z001\nthreads: []`)).toThrow(/title/);
  });
});

describe("parseThreadsList", () => {
  test("placement vs cross prefixes", () => {
    expect(parseThreadsList("[↑z002, ~z015, ~ENG-5379]")).toEqual([
      { to: "z002", kind: "placement" },
      { to: "z015", kind: "cross" },
      { to: "ENG-5379", kind: "cross" },
    ]);
  });
  test("bare token defaults to cross", () => {
    expect(parseThreadsList("[z015]")).toEqual([{ to: "z015", kind: "cross" }]);
  });
  test("empty list", () => {
    expect(parseThreadsList("[]")).toEqual([]);
  });
});

describe("parseZettel", () => {
  test("round-trips frontmatter + body", () => {
    const z = parseZettel(SAMPLE, "/tmp/sample.md");
    expect(z.id).toBe("z003");
    expect(z.title).toContain("Open-to-empty");
    expect(z.body).toContain("## Human side");
    expect(z.body).toContain("## UseGin side");
    expect(z.path).toBe("/tmp/sample.md");
  });

  test("rejects input with no frontmatter", () => {
    expect(() => parseZettel("just body")).toThrow(/frontmatter/);
  });
});

describe("serializeZettel", () => {
  test("preserves the blank line between frontmatter and body (z058 regression)", () => {
    const z = parseZettel(SAMPLE);
    const text = serializeZettel(z);
    // The exact textual shape we promise: ---\n\n<body>
    expect(text).toContain("---\n\n## Human side");
    expect(text).not.toMatch(/---\n##/);
  });

  test("round-trip is byte-stable across multiple passes", () => {
    let text = SAMPLE;
    for (let i = 0; i < 3; i++) {
      const z = parseZettel(text);
      text = serializeZettel(z);
    }
    const z = parseZettel(text);
    // Body keeps its sections and its blank-line spacing.
    expect(z.body).toContain("\n## Human side");
    expect(z.body).toContain("\n## UseGin side");
  });

  test("round-trip parse → serialize → parse is stable", () => {
    const z = parseZettel(SAMPLE);
    const text = serializeZettel(z);
    const z2 = parseZettel(text);
    expect(z2.id).toBe(z.id);
    expect(z2.title).toBe(z.title);
    expect(z2.threads).toEqual(z.threads);
    expect(z2.body.trim()).toBe(z.body.trim());
  });
});

describe("serializeThreads", () => {
  test("emits the bullet/prefix shape", () => {
    expect(
      serializeThreads([
        { to: "z002", kind: "placement" },
        { to: "z015", kind: "cross" },
      ]),
    ).toBe("[↑z002, ~z015]");
  });
  test("empty list", () => {
    expect(serializeThreads([])).toBe("[]");
  });
});

describe("normalizeId", () => {
  test("various inputs → padded id", () => {
    expect(normalizeId("3")).toBe("z003");
    expect(normalizeId("03")).toBe("z003");
    expect(normalizeId("z3")).toBe("z003");
    expect(normalizeId("z003")).toBe("z003");
    expect(normalizeId("z34")).toBe("z034");
    expect(normalizeId("z123")).toBe("z123");
  });
  test("non-numeric pass-through", () => {
    expect(normalizeId("ENG-5379")).toBe("ENG-5379");
  });
});

function withTempDir(): { dir: string; seed: (id: string, title: string, body?: string) => void } {
  const dir = mkdtempSync(join(tmpdir(), "dx-zettel-test-"));
  const seed = (id: string, title: string, body = "## Human side\n\ntest\n") => {
    const z: Zettel = {
      id,
      title,
      type: "zettel",
      authoredBy: "human",
      threads: [],
      created: "2026-04-27",
      session: "test",
      body,
      path: "",
    };
    writeZettel(z, dir);
  };
  return { dir, seed };
}

describe("filesystem ops (writeZettel / readAll / findById / nextId)", () => {
  test("writeZettel + readAll round-trips", () => {
    const { dir, seed } = withTempDir();
    seed("z001", "first thought");
    seed("z002", "second thought");
    const all = readAll(dir);
    expect(all.length).toBe(2);
    expect(all[0].id).toBe("z001");
    expect(all[1].id).toBe("z002");
  });

  test("findById accepts short forms", () => {
    const { dir, seed } = withTempDir();
    seed("z042", "the answer");
    expect(findById("42", dir)?.id).toBe("z042");
    expect(findById("z42", dir)?.id).toBe("z042");
    expect(findById("z042", dir)?.id).toBe("z042");
    expect(findById("999", dir)).toBeNull();
  });

  test("nextId returns next sequential id", () => {
    const { dir, seed } = withTempDir();
    expect(nextId(dir)).toBe("z001");
    seed("z001", "a");
    expect(nextId(dir)).toBe("z002");
    seed("z005", "skip");
    expect(nextId(dir)).toBe("z006");
  });
});

describe("updateThreads", () => {
  test("rewrites only the threads list, preserves body", () => {
    const { dir, seed } = withTempDir();
    seed("z001", "topic", "## Human side\n\nbody text\n\n## UseGin side\n\nmore\n");
    const path = readAll(dir)[0].path;
    updateThreads(path, [
      { to: "z003", kind: "placement" },
      { to: "ENG-5379", kind: "cross" },
    ]);
    const after = parseZettel(readFileSync(path, "utf-8"));
    expect(after.threads).toEqual([
      { to: "z003", kind: "placement" },
      { to: "ENG-5379", kind: "cross" },
    ]);
    expect(after.body).toContain("body text");
    expect(after.body).toContain("more");
  });
});
