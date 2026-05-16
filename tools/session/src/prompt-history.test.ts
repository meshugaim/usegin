/**
 * Tests for prompt-history — extract and format user prompts from
 * parsed session turns for the `session prompts` subcommand.
 */

import { describe, it, expect } from "bun:test";
import {
  extractUserPrompts,
  dedupPrompts,
  formatPromptEntry,
  extractPromptFromSelection,
  formatPromptGrep,
} from "./prompt-history";
import { userTurn, assistantTurn, toolResult } from "./testing";

const SID = "11111111-2222-3333-4444-555555555555";

describe("extractUserPrompts", () => {
  it("extracts text from user turns", () => {
    const turns = [
      userTurn("u1", "How do I run the tests?", { timestamp: "2026-05-16T10:00:00Z" }),
      assistantTurn("a1", "Run `bun test`"),
      userTurn("u2", "Thanks", { timestamp: "2026-05-16T10:01:00Z" }),
    ];
    const prompts = extractUserPrompts(turns, SID);
    expect(prompts).toHaveLength(2);
    expect(prompts[0].text).toBe("How do I run the tests?");
    expect(prompts[0].timestamp).toBe("2026-05-16T10:00:00Z");
    expect(prompts[0].sessionId).toBe(SID);
    expect(prompts[0].turnIndex).toBe(0);
    expect(prompts[1].text).toBe("Thanks");
  });

  it("skips empty user turns (tool-result-only)", () => {
    const turns = [
      userTurn("u1", "", { toolResults: [toolResult("t1", "ok")] }),
      userTurn("u2", "real prompt"),
    ];
    expect(extractUserPrompts(turns, SID)).toHaveLength(1);
  });

  it("skips system-tag user turns (<command-*>, <system-reminder>, etc.)", () => {
    const turns = [
      userTurn("u1", "<command-name>/help</command-name>"),
      userTurn("u2", "<system-reminder>foo</system-reminder>"),
      userTurn("u3", "<local-command-stdout>...</local-command-stdout>"),
      userTurn("u4", "<bash-input>ls</bash-input>"),
      userTurn("u5", "real human typing"),
    ];
    const prompts = extractUserPrompts(turns, SID);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].text).toBe("real human typing");
  });

  it("skips assistant turns", () => {
    const turns = [
      assistantTurn("a1", "I am the assistant"),
      userTurn("u1", "user typing"),
    ];
    const prompts = extractUserPrompts(turns, SID);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].text).toBe("user typing");
  });

  it("preserves multi-line prompts verbatim", () => {
    const turns = [userTurn("u1", "line one\nline two\nline three")];
    const prompts = extractUserPrompts(turns, SID);
    expect(prompts[0].text).toBe("line one\nline two\nline three");
  });
});

describe("dedupPrompts", () => {
  it("collapses exact duplicates, keeping most recent timestamp", () => {
    const prompts = [
      { text: "yes", timestamp: "2026-05-10T10:00:00Z", sessionId: SID, turnIndex: 0 },
      { text: "yes", timestamp: "2026-05-16T10:00:00Z", sessionId: SID, turnIndex: 2 },
      { text: "no", timestamp: "2026-05-15T10:00:00Z", sessionId: SID, turnIndex: 1 },
    ];
    const out = dedupPrompts(prompts);
    expect(out).toHaveLength(2);
    const yesEntry = out.find((p) => p.text === "yes")!;
    expect(yesEntry.timestamp).toBe("2026-05-16T10:00:00Z");
  });

  it("sorts descending by timestamp", () => {
    const prompts = [
      { text: "older", timestamp: "2026-05-01T10:00:00Z", sessionId: SID, turnIndex: 0 },
      { text: "newer", timestamp: "2026-05-15T10:00:00Z", sessionId: SID, turnIndex: 1 },
    ];
    const out = dedupPrompts(prompts);
    expect(out[0].text).toBe("newer");
    expect(out[1].text).toBe("older");
  });

  it("treats null timestamps as oldest", () => {
    const prompts = [
      { text: "no-ts", timestamp: null, sessionId: SID, turnIndex: 0 },
      { text: "with-ts", timestamp: "2026-05-15T10:00:00Z", sessionId: SID, turnIndex: 1 },
    ];
    const out = dedupPrompts(prompts);
    expect(out[0].text).toBe("with-ts");
  });
});

describe("formatPromptEntry + extractPromptFromSelection round-trip", () => {
  it("round-trips a single-line prompt", () => {
    const p = {
      text: "Hello world",
      timestamp: "2026-05-16T10:00:00Z",
      sessionId: SID,
      turnIndex: 0,
    };
    const entry = formatPromptEntry(p);
    expect(extractPromptFromSelection(entry)).toBe("Hello world");
  });

  it("round-trips a multi-line prompt verbatim", () => {
    const p = {
      text: "first\nsecond\nthird",
      timestamp: "2026-05-16T10:00:00Z",
      sessionId: SID,
      turnIndex: 0,
    };
    const entry = formatPromptEntry(p);
    expect(extractPromptFromSelection(entry)).toBe("first\nsecond\nthird");
  });

  it("round-trips prompts containing tabs and special chars", () => {
    const p = {
      text: 'a\tb "c" [d] {e}',
      timestamp: null,
      sessionId: SID,
      turnIndex: 0,
    };
    const entry = formatPromptEntry(p);
    expect(extractPromptFromSelection(entry)).toBe('a\tb "c" [d] {e}');
  });

  it("display side has no real newlines (fits a single fzf row)", () => {
    const p = {
      text: "line a\nline b",
      timestamp: "2026-05-16T10:00:00Z",
      sessionId: SID,
      turnIndex: 0,
    };
    const entry = formatPromptEntry(p);
    const display = entry.split("\t")[0];
    expect(display).not.toContain("\n");
  });

  it("returns selection as-is when no field separator is present", () => {
    expect(extractPromptFromSelection("just a prompt")).toBe("just a prompt");
  });
});

describe("formatPromptGrep", () => {
  it("returns matches with count header", () => {
    const prompts = [
      { text: "run the tests", timestamp: "2026-05-16T10:00:00Z", sessionId: SID, turnIndex: 0 },
      { text: "deploy", timestamp: "2026-05-16T10:01:00Z", sessionId: SID, turnIndex: 1 },
    ];
    const out = formatPromptGrep(prompts, "test");
    expect(out).toContain("Found 1 prompt(s) matching");
    expect(out).toContain("run the tests");
  });

  it("returns no-matches message when nothing matches", () => {
    const prompts = [
      { text: "deploy", timestamp: null, sessionId: SID, turnIndex: 0 },
    ];
    expect(formatPromptGrep(prompts, "xyz")).toContain("No prompts matching");
  });

  it("matches case-insensitively", () => {
    const prompts = [
      { text: "RUN THE TESTS", timestamp: null, sessionId: SID, turnIndex: 0 },
    ];
    expect(formatPromptGrep(prompts, "tests")).toContain("RUN THE TESTS");
  });
});
