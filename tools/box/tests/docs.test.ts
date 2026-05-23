import { describe, it, expect } from "bun:test";
import { loadAllDocs, findDoc, type Doc } from "../src/commands/docs";

// Validates box's OWN shipped docs (the .md files under tools/box/docs), not the
// shared docs-registry machinery (that's covered in tools/docs-registry). Guards
// against a doc that silently fails to load because its frontmatter is malformed.
const { user, internal } = loadAllDocs();
const docs: Doc[] = [...user, ...internal];

const VALID_TYPES = new Set(["tutorial", "how-to", "reference", "explanation"]);

describe("box shipped docs", () => {
  it("ships at least the core docs (golden-base, commands, troubleshooting)", () => {
    const handles = docs.map((d) => d.meta.handle);
    expect(handles).toContain("golden-base");
    expect(handles).toContain("commands");
    expect(handles).toContain("troubleshooting");
  });

  it("every doc has complete, well-typed frontmatter", () => {
    for (const d of docs) {
      expect(d.meta.name, `name on ${d.meta.handle}`).toBeTruthy();
      expect(d.meta.handle, "handle").toBeTruthy();
      expect(d.meta.context, `context on ${d.meta.handle}`).toBeTruthy();
      expect(VALID_TYPES.has(d.meta.type), `type "${d.meta.type}" on ${d.meta.handle}`).toBe(true);
      expect(d.content.trim().length, `body on ${d.meta.handle}`).toBeGreaterThan(0);
    }
  });

  it("handles are unique (so `docs show <handle>` is unambiguous)", () => {
    const handles = docs.map((d) => d.meta.handle);
    expect(new Set(handles).size).toBe(handles.length);
  });

  it("every doc resolves by its handle and by 1-indexed number", () => {
    docs.forEach((d, i) => {
      expect(findDoc(d.meta.handle, docs)?.meta.handle).toBe(d.meta.handle);
      expect(findDoc(String(i + 1), docs)?.meta.handle).toBe(d.meta.handle);
    });
  });

  it("the golden-base doc records both boot bugs (the brick + the harden race)", () => {
    const gb = findDoc("golden-base", docs);
    expect(gb).toBeDefined();
    expect(gb!.content).toMatch(/tkaSyncIfNeeded|panic/i); // the brick
    expect(gb!.content).toMatch(/100\.64\.0\.0\/10/); // the harden-race CIDR backstop
  });
});
