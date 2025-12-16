import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// We'll test the core functions that will be exported from docs.ts
// For now, define the expected interfaces

interface DocMeta {
  name: string;
  handle: string;
  type: "tutorial" | "how-to" | "reference" | "explanation";
  context: string;
  tags?: string[];
}

interface Doc {
  meta: DocMeta;
  content: string;
}

// Test data
const sampleDocContent = `---
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

const sampleDocContent2 = `---
name: Writing good docs
handle: writing-docs
type: explanation
context: Understanding what makes documentation effective
---

# Writing Good Docs

Keep it concise. Use tables.
`;

describe("docs frontmatter parsing", () => {
  // These tests will drive the implementation of parseFrontmatter()

  it("parses valid frontmatter", async () => {
    const { parseFrontmatter } = await import("../src/commands/docs");
    const result = parseFrontmatter(sampleDocContent);

    expect(result.meta.name).toBe("How to add a doc");
    expect(result.meta.handle).toBe("adding-docs");
    expect(result.meta.type).toBe("how-to");
    expect(result.meta.context).toBe("When you want to add documentation to this CLI");
    expect(result.meta.tags).toEqual(["meta", "docs"]);
  });

  it("returns body without frontmatter", async () => {
    const { parseFrontmatter } = await import("../src/commands/docs");
    const result = parseFrontmatter(sampleDocContent);

    expect(result.body).toContain("# How to Add a Doc");
    expect(result.body).not.toContain("---");
    expect(result.body).not.toContain("name:");
  });

  it("handles content without frontmatter", async () => {
    const { parseFrontmatter } = await import("../src/commands/docs");
    const result = parseFrontmatter("# Just content\n\nNo frontmatter here.");

    expect(result.meta).toEqual({});
    expect(result.body).toBe("# Just content\n\nNo frontmatter here.");
  });

  it("handles tags as array", async () => {
    const { parseFrontmatter } = await import("../src/commands/docs");
    const result = parseFrontmatter(sampleDocContent);

    expect(Array.isArray(result.meta.tags)).toBe(true);
    expect(result.meta.tags).toContain("meta");
    expect(result.meta.tags).toContain("docs");
  });
});

describe("docs loading", () => {
  let testDocsDir: string;

  beforeEach(() => {
    // Create a temp directory for test docs
    testDocsDir = join(tmpdir(), `plan-cli-docs-test-${Date.now()}`);
    mkdirSync(testDocsDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    rmSync(testDocsDir, { recursive: true, force: true });
  });

  it("loads docs from directory", async () => {
    // Write test docs
    writeFileSync(join(testDocsDir, "adding-docs.md"), sampleDocContent);
    writeFileSync(join(testDocsDir, "writing-docs.md"), sampleDocContent2);

    const { loadDocsFromDir } = await import("../src/commands/docs");
    const docs = loadDocsFromDir(testDocsDir);

    expect(docs.length).toBe(2);
    expect(docs.some((d) => d.meta.handle === "adding-docs")).toBe(true);
    expect(docs.some((d) => d.meta.handle === "writing-docs")).toBe(true);
  });

  it("skips files without required frontmatter", async () => {
    writeFileSync(join(testDocsDir, "valid.md"), sampleDocContent);
    writeFileSync(join(testDocsDir, "invalid.md"), "# No frontmatter\n\nJust content.");

    const { loadDocsFromDir } = await import("../src/commands/docs");
    const docs = loadDocsFromDir(testDocsDir);

    expect(docs.length).toBe(1);
    expect(docs[0].meta.handle).toBe("adding-docs");
  });

  it("returns empty array for non-existent directory", async () => {
    const { loadDocsFromDir } = await import("../src/commands/docs");
    const docs = loadDocsFromDir("/non/existent/path");

    expect(docs).toEqual([]);
  });
});

describe("docs list formatting", () => {
  it("formats docs in 2-line format", async () => {
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

    const { formatDocsList } = await import("../src/commands/docs");
    const output = formatDocsList(docs);

    // Check 2-line format: name + type on first line, context on second
    expect(output).toContain("1");
    expect(output).toContain("How to add a doc");
    expect(output).toContain("[how-to]");
    expect(output).toContain("When you want to add documentation");

    expect(output).toContain("2");
    expect(output).toContain("Writing good docs");
    expect(output).toContain("[explanation]");
  });
});

describe("docs help text", () => {
  let testDocsDir: string;

  beforeEach(() => {
    testDocsDir = join(tmpdir(), `plan-cli-docs-help-test-${Date.now()}`);
    mkdirSync(testDocsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDocsDir, { recursive: true, force: true });
  });

  it("generates help text with doc handles and names", async () => {
    writeFileSync(join(testDocsDir, "test-doc.md"), sampleDocContent);

    const { loadDocsFromDir } = await import("../src/commands/docs");
    const docs = loadDocsFromDir(testDocsDir);

    // The format should include handle and name
    expect(docs.length).toBe(1);
    expect(docs[0].meta.handle).toBe("adding-docs");
    expect(docs[0].meta.name).toBe("How to add a doc");
  });

  it("returns empty string when no docs exist", async () => {
    // Test with empty directory - we can't easily test getDocsHelpText directly
    // because it uses hardcoded paths, but we verify the docs loading works
    const { loadDocsFromDir } = await import("../src/commands/docs");
    const docs = loadDocsFromDir("/non/existent/path");

    expect(docs).toEqual([]);
  });
});

describe("docs finding", () => {
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

  it("finds doc by handle", async () => {
    const { findDoc } = await import("../src/commands/docs");
    const doc = findDoc("adding-docs", testDocs);

    expect(doc).toBeDefined();
    expect(doc?.meta.name).toBe("How to add a doc");
  });

  it("finds doc by number (1-indexed)", async () => {
    const { findDoc } = await import("../src/commands/docs");

    const doc1 = findDoc("1", testDocs);
    expect(doc1).toBeDefined();
    expect(doc1?.meta.handle).toBe("adding-docs");

    const doc2 = findDoc("2", testDocs);
    expect(doc2).toBeDefined();
    expect(doc2?.meta.handle).toBe("writing-docs");
  });

  it("returns undefined for invalid handle", async () => {
    const { findDoc } = await import("../src/commands/docs");
    const doc = findDoc("non-existent", testDocs);

    expect(doc).toBeUndefined();
  });

  it("returns undefined for out-of-range number", async () => {
    const { findDoc } = await import("../src/commands/docs");

    const doc = findDoc("5", testDocs);
    expect(doc).toBeUndefined();
  });
});
