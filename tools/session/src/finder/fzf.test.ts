/**
 * Tests for FZF integration
 */

import { describe, test, expect } from "bun:test";
import {
  runFzf,
  buildFzfArgs,
  type SessionInfo,
} from "../finder";

describe("runFzf", () => {
  test("selects matching entry with --filter", async () => {
    const sessions: SessionInfo[] = [
      {
        path: "/path/to/session-aaa.jsonl",
        id: "session-aaa",
        mtime: new Date(),
        project: "to",
      },
      {
        path: "/path/to/session-bbb.jsonl",
        id: "session-bbb",
        mtime: new Date(),
        project: "to",
      },
    ];

    // Use --filter to non-interactively select
    const result = await runFzf(sessions, { filter: "bbb" });

    expect(result).toBe("/path/to/session-bbb.jsonl");
  });

  test("returns null when no match", async () => {
    const sessions: SessionInfo[] = [
      {
        path: "/path/to/session-aaa.jsonl",
        id: "session-aaa",
        mtime: new Date(),
        project: "to",
      },
    ];

    const result = await runFzf(sessions, { filter: "zzz-no-match" });

    expect(result).toBeNull();
  });
});

describe("buildFzfArgs", () => {
  test("includes basic fzf options", () => {
    const args = buildFzfArgs({});
    expect(args).toContain("--read0");
    expect(args).toContain("--highlight-line");
    expect(args).toContain("--gap");
  });

  test("includes header with keybinding hints", () => {
    const args = buildFzfArgs({});
    expect(args).toContain("--header");
    const headerIdx = args.indexOf("--header");
    const headerValue = args[headerIdx + 1];
    expect(headerValue).toContain("ctrl-r");
    expect(headerValue).toContain("resume");
  });

  test("includes ctrl-r binding that outputs RESUME marker", () => {
    const args = buildFzfArgs({});
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlRBind = bindArgs.find(b => b.includes("ctrl-r"));
    expect(ctrlRBind).toBeDefined();
    expect(ctrlRBind).toContain("become(");
    expect(ctrlRBind).toContain("RESUME:");
  });

  test("includes ctrl-t binding that outputs RETRO marker", () => {
    const args = buildFzfArgs({});
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlTBind = bindArgs.find(b => b.includes("ctrl-t"));
    expect(ctrlTBind).toBeDefined();
    expect(ctrlTBind).toContain("become(");
    expect(ctrlTBind).toContain("RETRO:");
  });

  test("includes ctrl-u binding for preview-half-page-up", () => {
    const args = buildFzfArgs({});
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlUBind = bindArgs.find(b => b.includes("ctrl-u"));
    expect(ctrlUBind).toBe("ctrl-u:preview-half-page-up");
  });

  test("includes ctrl-d binding for preview-half-page-down", () => {
    const args = buildFzfArgs({});
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlDBind = bindArgs.find(b => b.includes("ctrl-d"));
    expect(ctrlDBind).toBe("ctrl-d:preview-half-page-down");
  });

  test("includes scroll hint in header", () => {
    const args = buildFzfArgs({});
    const headerIdx = args.indexOf("--header");
    const headerValue = args[headerIdx + 1];
    expect(headerValue).toContain("ctrl-u/d");
    expect(headerValue).toContain("scroll");
  });

  test("includes ctrl-x hint in header when delete/reload commands provided", () => {
    const args = buildFzfArgs({
      deleteCommand: "echo {} | tail -1 | xargs session rm --yes",
      reloadCommand: "session find --fzf-entries",
    });
    const headerIdx = args.indexOf("--header");
    const headerValue = args[headerIdx + 1];
    expect(headerValue).toContain("ctrl-x");
    expect(headerValue).toContain("delete");
  });

  test("omits ctrl-x hint from header when delete/reload commands not provided", () => {
    const args = buildFzfArgs({});
    const headerIdx = args.indexOf("--header");
    const headerValue = args[headerIdx + 1];
    expect(headerValue).not.toContain("ctrl-x");
  });

  test("includes ctrl-x binding when delete and reload commands provided", () => {
    const args = buildFzfArgs({
      deleteCommand: "echo {} | tail -1 | xargs session rm --yes",
      reloadCommand: "session find --fzf-entries",
    });
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlXBind = bindArgs.find(b => b.includes("ctrl-x"));
    expect(ctrlXBind).toBeDefined();
    expect(ctrlXBind).toContain("execute-silent(");
    expect(ctrlXBind).toContain("reload(");
    expect(ctrlXBind).toContain("session rm --yes");
    expect(ctrlXBind).toContain("session find --fzf-entries");
  });

  test("omits ctrl-x binding when delete/reload commands not provided", () => {
    const args = buildFzfArgs({});
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlXBind = bindArgs.find(b => b.includes("ctrl-x"));
    expect(ctrlXBind).toBeUndefined();
  });

  test("disables keybindings in filter mode", () => {
    const args = buildFzfArgs({ filter: "test" });
    expect(args).toContain("--filter");
    // In filter mode, no interactive bindings needed
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlRBind = bindArgs.find(b => b.includes("ctrl-r"));
    expect(ctrlRBind).toBeUndefined();
  });

  test("disables preview when noPreview is true", () => {
    const args = buildFzfArgs({ preview: false });
    expect(args).not.toContain("--preview");
  });
});

describe("checkFzfAvailable", () => {
  test("returns true when fzf is installed", async () => {
    const { checkFzfAvailable } = await import("../finder");

    // fzf should be installed in dev environment
    const result = await checkFzfAvailable();

    expect(typeof result).toBe("boolean");
  });

  test("throws FzfNotFoundError with install instructions when fzf not found", async () => {
    const { FzfNotFoundError } = await import("../errors");

    const error = new FzfNotFoundError();
    expect(error.message).toContain("fzf");
    expect(error.message).toContain("install");
    // Should have platform-specific instructions
    expect(error.message).toMatch(/brew|apt|choco|scoop/i);
  });
});
