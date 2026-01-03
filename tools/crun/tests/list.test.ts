import { describe, expect, it, beforeAll, afterAll, mock } from "bun:test";
import {
  formatOutputSnippet,
  getOutputSnippet,
  truncateLine,
} from "../src/commands/list";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

describe("list command", () => {
  describe("truncateLine", () => {
    it("returns short lines unchanged", () => {
      expect(truncateLine("Hello world", 40)).toBe("Hello world");
    });

    it("truncates long lines with ellipsis", () => {
      const long = "This is a very long line that should be truncated";
      expect(truncateLine(long, 20)).toBe("This is a very lo...");
    });

    it("handles exact length", () => {
      expect(truncateLine("1234567890", 10)).toBe("1234567890");
    });

    it("handles empty string", () => {
      expect(truncateLine("", 10)).toBe("");
    });
  });

  describe("formatOutputSnippet", () => {
    it("prefixes lines with arrow and proper indentation", () => {
      const snippet = "Line 1\nLine 2";
      const result = formatOutputSnippet(snippet);

      expect(result).toContain("→ Line 1");
      expect(result).toContain("→ Line 2");
    });

    it("indents to align under PROMPT column", () => {
      const snippet = "Test line";
      const result = formatOutputSnippet(snippet);

      // Should have 44 spaces before the arrow (to align under PROMPT)
      const lines = result.split("\n");
      expect(lines[0]).toMatch(/^\s{44}→/);
    });

    it("truncates long lines", () => {
      const long = "A".repeat(100);
      const result = formatOutputSnippet(long, 50);

      expect(result).toContain("...");
      expect(result.length).toBeLessThan(150); // rough check
    });

    it("handles empty snippet", () => {
      expect(formatOutputSnippet("")).toBe("");
    });

    it("limits number of lines shown", () => {
      const multiLine = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
      const result = formatOutputSnippet(multiLine, 50, 2);

      const outputLines = result.trim().split("\n");
      expect(outputLines.length).toBe(2);
    });
  });

  describe("getOutputSnippet", () => {
    const testLogDir = join(homedir(), ".pm2", "logs");
    const testSessionId = "test-session-12345678";
    const testLogFile = `crun-${testSessionId}-out.log`;

    beforeAll(async () => {
      // Ensure log directory exists
      await mkdir(testLogDir, { recursive: true });
    });

    afterAll(async () => {
      // Clean up test log file
      try {
        await rm(join(testLogDir, testLogFile));
      } catch {
        // Ignore if doesn't exist
      }
    });

    it("returns null for non-existent session", async () => {
      const result = await getOutputSnippet("nonexistent-session");
      expect(result).toBeNull();
    });

    it("reads last N lines from log file", async () => {
      // Create test log file
      const content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n";
      await writeFile(join(testLogDir, testLogFile), content);

      const result = await getOutputSnippet(testSessionId, 3);

      expect(result).not.toBeNull();
      expect(result).toContain("Line 3");
      expect(result).toContain("Line 4");
      expect(result).toContain("Line 5");
    });

    it("returns null for empty log file", async () => {
      await writeFile(join(testLogDir, testLogFile), "");

      const result = await getOutputSnippet(testSessionId);
      expect(result).toBeNull();
    });
  });
});
