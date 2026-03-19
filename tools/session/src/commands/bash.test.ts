/**
 * Tests for session bash command — fzf configuration, output parsing,
 * and ctrl-r run marker handling.
 */

import { describe, it, expect } from "bun:test";
import {
  buildBashFzfArgs,
  extractCommandFromSelection,
  parseBashFzfOutput,
  RUN_MARKER,
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

  it("includes ctrl-r binding that outputs RUN: marker", () => {
    const args = buildBashFzfArgs();
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlRBind = bindArgs.find((b) => b.includes("ctrl-r"));
    expect(ctrlRBind).toBeDefined();
    expect(ctrlRBind).toContain("become(");
    expect(ctrlRBind).toContain(RUN_MARKER);
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

  it("parses RUN: marker output as run action", () => {
    const result = parseBashFzfOutput("RUN:$ bun test");
    expect(result).toEqual({ action: "run", command: "bun test" });
  });

  it("parses RUN: marker with whitespace", () => {
    const result = parseBashFzfOutput("RUN: $ bun test --grep parser");
    expect(result).toEqual({ action: "run", command: "bun test --grep parser" });
  });

  it("parses RUN: marker without $ prefix", () => {
    const result = parseBashFzfOutput("RUN:echo hello");
    expect(result).toEqual({ action: "run", command: "echo hello" });
  });

  it("parses normal selection as copy action", () => {
    const selected = "[2025-03-18 10:30]  Run tests\n$ bun test";
    const result = parseBashFzfOutput(selected);
    expect(result).toEqual({ action: "copy", command: "bun test" });
  });

  it("parses normal selection without $ line as copy action", () => {
    const result = parseBashFzfOutput("some raw text");
    expect(result).toEqual({ action: "copy", command: "some raw text" });
  });
});

// =============================================================================
// RUN_MARKER constant
// =============================================================================

describe("RUN_MARKER", () => {
  it("is the string 'RUN:'", () => {
    expect(RUN_MARKER).toBe("RUN:");
  });
});
