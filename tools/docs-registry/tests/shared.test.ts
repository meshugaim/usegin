import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseFrontmatter,
  loadDocsFromDir,
  findDoc,
  formatDocsList,
  type Doc,
} from "../src/shared";

// ─── Test fixtures ───────────────────────────────────────────────────────────

const validDoc = `---
name: How to add a doc
handle: adding-docs
type: how-to
context: When you want to add documentation to this CLI
tags: [meta, docs]
---

# How to Add a Doc

**TL;DR**: Create a markdown file in \`docs/\` with YAML frontmatter.

## Steps

1. Create a new \`.md\` file in the \`docs/\` directory
2. Add YAML frontmatter with required fields
3. Write your content below the frontmatter
`;

const validDoc2 = `---
name: Writing good docs
handle: writing-docs
type: explanation
context: Understanding what makes documentation effective
---

# Writing Good Docs

Keep it concise. Use tables.
`;

const noFrontmatter = "# Just content\n\nNo frontmatter here.";

const missingFields = `---
name: Incomplete
---

Missing handle, type, and context.
`;

// ─── parseFrontmatter ────────────────────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("parses valid frontmatter", () => {
    const result = parseFrontmatter(validDoc);

    expect(result.meta.name).toBe("How to add a doc");
    expect(result.meta.handle).toBe("adding-docs");
    expect(result.meta.type).toBe("how-to");
    expect(result.meta.context).toBe("When you want to add documentation to this CLI");
  });

  it("returns body without frontmatter", () => {
    const result = parseFrontmatter(validDoc);

    expect(result.body).toContain("# How to Add a Doc");
    expect(result.body).not.toContain("---");
    expect(result.body).not.toContain("name:");
  });

  it("handles content without frontmatter", () => {
    const result = parseFrontmatter(noFrontmatter);

    expect(result.meta).toEqual({});
    expect(result.body).toBe("# Just content\n\nNo frontmatter here.");
  });

  it("parses tags as array", () => {
    const result = parseFrontmatter(validDoc);

    expect(Array.isArray(result.meta.tags)).toBe(true);
    expect(result.meta.tags).toContain("meta");
    expect(result.meta.tags).toContain("docs");
  });

  it("parses frontmatter without tags", () => {
    const result = parseFrontmatter(validDoc2);

    expect(result.meta.name).toBe("Writing good docs");
    expect(result.meta.tags).toBeUndefined();
  });
});

// ─── loadDocsFromDir ─────────────────────────────────────────────────────────

describe("loadDocsFromDir", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `docs-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("loads docs from directory", () => {
    writeFileSync(join(testDir, "adding-docs.md"), validDoc);
    writeFileSync(join(testDir, "writing-docs.md"), validDoc2);

    const docs = loadDocsFromDir(testDir);

    expect(docs.length).toBe(2);
    expect(docs.some((d) => d.meta.handle === "adding-docs")).toBe(true);
    expect(docs.some((d) => d.meta.handle === "writing-docs")).toBe(true);
  });

  it("skips files without required frontmatter", () => {
    writeFileSync(join(testDir, "valid.md"), validDoc);
    writeFileSync(join(testDir, "invalid.md"), noFrontmatter);
    writeFileSync(join(testDir, "incomplete.md"), missingFields);

    const docs = loadDocsFromDir(testDir);

    expect(docs.length).toBe(1);
    expect(docs[0].meta.handle).toBe("adding-docs");
  });

  it("returns empty array for non-existent directory", () => {
    const docs = loadDocsFromDir("/non/existent/path");
    expect(docs).toEqual([]);
  });

  it("skips non-markdown files", () => {
    writeFileSync(join(testDir, "valid.md"), validDoc);
    writeFileSync(join(testDir, "readme.txt"), "not a markdown file");
    writeFileSync(join(testDir, "config.json"), "{}");

    const docs = loadDocsFromDir(testDir);

    expect(docs.length).toBe(1);
  });
});

// ─── findDoc ─────────────────────────────────────────────────────────────────

describe("findDoc", () => {
  const testDocs: Doc[] = [
    {
      meta: {
        name: "How to add a doc",
        handle: "adding-docs",
        type: "how-to",
        context: "When you want to add documentation",
      },
      content: "Content for adding docs",
    },
    {
      meta: {
        name: "Writing good docs",
        handle: "writing-docs",
        type: "explanation",
        context: "Understanding effective documentation",
      },
      content: "Content for writing docs",
    },
  ];

  it("finds doc by handle", () => {
    const doc = findDoc("adding-docs", testDocs);

    expect(doc).toBeDefined();
    expect(doc?.meta.name).toBe("How to add a doc");
  });

  it("finds doc by number (1-indexed)", () => {
    const doc1 = findDoc("1", testDocs);
    expect(doc1).toBeDefined();
    expect(doc1?.meta.handle).toBe("adding-docs");

    const doc2 = findDoc("2", testDocs);
    expect(doc2).toBeDefined();
    expect(doc2?.meta.handle).toBe("writing-docs");
  });

  it("returns undefined for invalid handle", () => {
    const doc = findDoc("non-existent", testDocs);
    expect(doc).toBeUndefined();
  });

  it("returns undefined for out-of-range number", () => {
    expect(findDoc("0", testDocs)).toBeUndefined();
    expect(findDoc("5", testDocs)).toBeUndefined();
    expect(findDoc("-1", testDocs)).toBeUndefined();
  });
});

// ─── formatDocsList ──────────────────────────────────────────────────────────

describe("formatDocsList", () => {
  it("formats docs in 2-line format", () => {
    const docs: Doc[] = [
      {
        meta: {
          name: "How to add a doc",
          handle: "adding-docs",
          type: "how-to",
          context: "When you want to add documentation",
        },
        content: "...",
      },
      {
        meta: {
          name: "Writing good docs",
          handle: "writing-docs",
          type: "explanation",
          context: "Understanding effective documentation",
        },
        content: "...",
      },
    ];

    const output = formatDocsList(docs);
    const lines = output.split("\n");

    // First doc: number + name + type on line 1, context on line 2
    expect(lines[0]).toContain(" 1");
    expect(lines[0]).toContain("How to add a doc");
    expect(lines[0]).toContain("[how-to]");
    expect(lines[1]).toContain("When you want to add documentation");

    // Blank line separator
    expect(lines[2]).toBe("");

    // Second doc
    expect(lines[3]).toContain(" 2");
    expect(lines[3]).toContain("Writing good docs");
    expect(lines[3]).toContain("[explanation]");
    expect(lines[4]).toContain("Understanding effective documentation");
  });

  it("handles empty docs list", () => {
    const output = formatDocsList([]);
    expect(output).toBe("");
  });

  it("handles single doc without trailing blank line", () => {
    const docs: Doc[] = [
      {
        meta: {
          name: "Solo doc",
          handle: "solo",
          type: "reference",
          context: "The only doc",
        },
        content: "...",
      },
    ];

    const output = formatDocsList(docs);
    const lines = output.split("\n");

    // Two lines, no blank separator
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("Solo doc");
    expect(lines[0]).toContain("[reference]");
    expect(lines[1]).toContain("The only doc");
  });
});
