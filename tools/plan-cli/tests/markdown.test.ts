import { describe, expect, it } from "bun:test";
import { renderMarkdown } from "../src/lib/markdown";
import { stripAnsi } from "../src/lib/colors";

describe("renderMarkdown", () => {
  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("", "  ")).toBe("");
  });

  it("renders headers", () => {
    const output = renderMarkdown("## Test Header");
    // Strip ANSI to check content
    expect(stripAnsi(output)).toContain("Test Header");
  });

  it("renders inline code", () => {
    const output = renderMarkdown("Use `plan show` command");
    expect(stripAnsi(output)).toContain("plan show");
  });

  it("renders bold text", () => {
    const output = renderMarkdown("This is **bold** text");
    expect(stripAnsi(output)).toContain("bold");
    // Markdown bold markers should be removed
    expect(output).not.toContain("**");
  });

  it("renders italic text", () => {
    const output = renderMarkdown("This is *italic* text");
    expect(stripAnsi(output)).toContain("italic");
  });

  it("renders code blocks", () => {
    const output = renderMarkdown("```bash\necho hello\n```");
    expect(stripAnsi(output)).toContain("echo");
  });

  it("renders lists", () => {
    const output = renderMarkdown("- Item one\n- Item two");
    expect(stripAnsi(output)).toContain("Item one");
    expect(stripAnsi(output)).toContain("Item two");
  });

  it("renders links with URL", () => {
    const output = renderMarkdown("[Link](https://example.com)");
    expect(stripAnsi(output)).toContain("example.com");
  });

  it("applies indentation to all lines", () => {
    const output = renderMarkdown("Line one\n\nLine two", "  ");
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.length > 0) {
        // Each non-empty line should start with the indent
        expect(line.startsWith("  ")).toBe(true);
      }
    }
  });

  it("trims trailing whitespace", () => {
    const output = renderMarkdown("Test\n\n\n");
    expect(output.endsWith("\n")).toBe(false);
  });
});
