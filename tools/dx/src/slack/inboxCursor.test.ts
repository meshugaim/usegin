/**
 * Unit tests for the `dx slack inbox` cursor file — atomic write,
 * round-trip, missing-file fallback, corrupt-file fallback.
 *
 * Part of: ENG-5415
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readInboxCursor,
  writeInboxCursor,
} from "./inboxCursor";

let tmp: string;
let cursorPath: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "dx-slack-inbox-cursor-"));
  cursorPath = join(tmp, "subdir", "slack-inbox-cursor.json");
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("readInboxCursor", () => {
  it("returns an empty cursor when the file does not exist", () => {
    const c = readInboxCursor(cursorPath);
    expect(c).toEqual({});
  });

  it("returns an empty cursor when the file is corrupt", () => {
    writeFileSync(cursorPath.replace("/subdir", ""), "{not json", "utf-8");
    const c = readInboxCursor(cursorPath.replace("/subdir", ""));
    expect(c).toEqual({});
  });

  it("returns an empty cursor when the JSON lacks lastSeenTs", () => {
    const path = join(tmp, "cursor.json");
    writeFileSync(path, JSON.stringify({ updatedAt: "x" }), "utf-8");
    expect(readInboxCursor(path)).toEqual({});
  });
});

describe("writeInboxCursor", () => {
  it("creates the parent dir and round-trips the cursor", () => {
    writeInboxCursor({ lastSeenTs: "1700000300.000000" }, cursorPath);
    expect(existsSync(cursorPath)).toBe(true);
    const c = readInboxCursor(cursorPath);
    expect(c.lastSeenTs).toBe("1700000300.000000");
    expect(typeof c.updatedAt).toBe("string");
  });

  it("overwrites a prior cursor atomically", () => {
    writeInboxCursor({ lastSeenTs: "1.0" }, cursorPath);
    writeInboxCursor({ lastSeenTs: "2.0" }, cursorPath);
    expect(readInboxCursor(cursorPath).lastSeenTs).toBe("2.0");
  });

  it("does not leave a .tmp sibling on success", () => {
    writeInboxCursor({ lastSeenTs: "1.0" }, cursorPath);
    expect(existsSync(`${cursorPath}.tmp`)).toBe(false);
  });
});
