/**
 * Tests for session bash command — fzf configuration, output parsing,
 * and ctrl-r run marker handling.
 */

import { describe, it, expect } from "bun:test";
import {
  buildBashFzfArgs,
  extractCommandFromSelection,
  parseBashFzfOutput,
  EXPECT_KEY,
} from "./bash";

// =============================================================================
// buildBashFzfArgs
// =============================================================================

describe("buildBashFzfArgs", () => {
  it("includes basic fzf flags", () => {
    const args = buildBashFzfArgs();
    expect(args).toContain("--read0");
    expect(args).toContain("--ansi");
    expect(args).toContain("--no-sort");
  });

  it("includes header with copy and run hints", () => {
    const args = buildBashFzfArgs();
    const headerIdx = args.indexOf("--header");
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    const headerValue = args[headerIdx + 1];
    expect(headerValue).toContain("enter: copy");
    expect(headerValue).toContain("ctrl-r: run");
  });

  it("uses --expect for ctrl-r instead of become()", () => {
    const args = buildBashFzfArgs();
    const expectIdx = args.indexOf("--expect");
    expect(expectIdx).toBeGreaterThanOrEqual(0);
    expect(args[expectIdx + 1]).toBe(EXPECT_KEY);
    // Verify become() is NOT used (shell injection vector)
    const allArgs = args.join(" ");
    expect(allArgs).not.toContain("become(");
  });

  it("includes ctrl-u binding for preview scroll up", () => {
    const args = buildBashFzfArgs();
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlUBind = bindArgs.find((b) => b.includes("ctrl-u"));
    expect(ctrlUBind).toBe("ctrl-u:preview-half-page-up");
  });

  it("includes ctrl-d binding for preview scroll down", () => {
    const args = buildBashFzfArgs();
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlDBind = bindArgs.find((b) => b.includes("ctrl-d"));
    expect(ctrlDBind).toBe("ctrl-d:preview-half-page-down");
  });

  it("includes preview pane configuration", () => {
    const args = buildBashFzfArgs();
    expect(args).toContain("--preview");
    expect(args).toContain("--preview-window");
  });

  it("includes scroll hint in header", () => {
    const args = buildBashFzfArgs();
    const headerIdx = args.indexOf("--header");
    const headerValue = args[headerIdx + 1];
    expect(headerValue).toContain("ctrl-u/d");
    expect(headerValue).toContain("scroll");
  });
});

// =============================================================================
// extractCommandFromSelection
// =============================================================================

describe("extractCommandFromSelection", () => {
  it("extracts command from multi-line selection", () => {
    const selected = "[2025-03-18 10:30]  Run the test suite\n$ bun test src/parser.test.ts";
    expect(extractCommandFromSelection(selected)).toBe("bun test src/parser.test.ts");
  });

  it("returns raw text when no $ prefix found", () => {
    const selected = "some raw text";
    expect(extractCommandFromSelection(selected)).toBe("some raw text");
  });

  it("handles multi-line commands by finding the $ line", () => {
    const selected = "[2025-03-18 10:30]  Description\nsome other line\n$ echo hello";
    expect(extractCommandFromSelection(selected)).toBe("echo hello");
  });

  it("strips only the '$ ' prefix, preserving the rest", () => {
    const selected = "$ git log --oneline | head -5";
    expect(extractCommandFromSelection(selected)).toBe("git log --oneline | head -5");
  });
});

// =============================================================================
// parseBashFzfOutput
// =============================================================================

describe("parseBashFzfOutput", () => {
  it("returns null for empty output (user cancelled)", () => {
    expect(parseBashFzfOutput("")).toBeNull();
    expect(parseBashFzfOutput("  \n  ")).toBeNull();
  });

  it("parses ctrl-r + selection as run action", () => {
    // --expect format: first line = key, rest = selected entry
    const output = "ctrl-r\n[2025-03-18 10:30]  Run tests\n$ bun test";
    const result = parseBashFzfOutput(output);
    expect(result).toEqual({ action: "run", command: "bun test" });
  });

  it("parses ctrl-r with command containing quotes and $() safely", () => {
    // This is the exact scenario that was vulnerable to shell injection
    const output = 'ctrl-r\n[2025-03-18 10:30]  Check status\n$ echo "$(whoami)" && cat /etc/passwd';
    const result = parseBashFzfOutput(output);
    expect(result).toEqual({
      action: "run",
      command: 'echo "$(whoami)" && cat /etc/passwd',
    });
  });

  it("parses ctrl-r with backtick command safely", () => {
    const output = "ctrl-r\n[2025-03-18 10:30]  List files\n$ echo `ls /tmp`";
    const result = parseBashFzfOutput(output);
    expect(result).toEqual({ action: "run", command: "echo `ls /tmp`" });
  });

  it("parses Enter (empty key) + selection as copy action", () => {
    // --expect format: empty first line = Enter was pressed
    const output = "\n[2025-03-18 10:30]  Run tests\n$ bun test";
    const result = parseBashFzfOutput(output);
    expect(result).toEqual({ action: "copy", command: "bun test" });
  });

  it("parses Enter selection without $ line as copy action", () => {
    const output = "\nsome raw text";
    const result = parseBashFzfOutput(output);
    expect(result).toEqual({ action: "copy", command: "some raw text" });
  });

  it("returns null when key is present but selection is empty", () => {
    expect(parseBashFzfOutput("ctrl-r\n")).toBeNull();
    expect(parseBashFzfOutput("ctrl-r\n  ")).toBeNull();
  });

  it("handles single-line output gracefully (no key line)", () => {
    // Edge case: if somehow only one line comes through
    const result = parseBashFzfOutput("$ bun test");
    expect(result).toEqual({ action: "copy", command: "bun test" });
  });
});

// =============================================================================
// EXPECT_KEY constant
// =============================================================================

describe("EXPECT_KEY", () => {
  it("is the string 'ctrl-r'", () => {
    expect(EXPECT_KEY).toBe("ctrl-r");
  });
});
