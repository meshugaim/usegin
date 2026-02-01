import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { parseSession } from "./parser";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

describe("parseSession with debug option", () => {
  const DEBUG_TEST_DIR = "/tmp/session-parser-debug-test";
  const DEBUG_SESSION_ID = "debug-test-session";

  beforeAll(async () => {
    await mkdir(DEBUG_TEST_DIR, { recursive: true });

    const mainSession = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: DEBUG_SESSION_ID,
        cwd: "/test",
        tools: ["Read"],
        model: "claude",
      }),
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: DEBUG_SESSION_ID,
        message: { role: "user", content: "Hello" },
      }),
    ].join("\n");

    await writeFile(join(DEBUG_TEST_DIR, `${DEBUG_SESSION_ID}.jsonl`), mainSession);
  });

  afterAll(async () => {
    await rm(DEBUG_TEST_DIR, { recursive: true, force: true });
  });

  test("accepts debug option without error", async () => {
    const session = await parseSession(join(DEBUG_TEST_DIR, `${DEBUG_SESSION_ID}.jsonl`), {
      debug: true,
    });

    expect(session.sessionId).toBe(DEBUG_SESSION_ID);
    expect(session.turns).toHaveLength(1);
  });

  test("works normally with debug disabled", async () => {
    const session = await parseSession(join(DEBUG_TEST_DIR, `${DEBUG_SESSION_ID}.jsonl`), {
      debug: false,
    });

    expect(session.sessionId).toBe(DEBUG_SESSION_ID);
  });
});

describe("parseSession malformed JSONL handling", () => {
  const MALFORMED_TEST_DIR = "/tmp/session-parser-malformed-test";

  beforeAll(async () => {
    await mkdir(MALFORMED_TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(MALFORMED_TEST_DIR, { recursive: true, force: true });
  });

  test("skips lines with invalid JSON", async () => {
    const content = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: "malformed-test",
        cwd: "/test",
        tools: [],
        model: "claude",
      }),
      "{invalid json line",
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: "malformed-test",
        message: { role: "user", content: "Hello" },
      }),
    ].join("\n");

    await writeFile(join(MALFORMED_TEST_DIR, "invalid-json.jsonl"), content);

    const session = await parseSession(join(MALFORMED_TEST_DIR, "invalid-json.jsonl"));

    expect(session.sessionId).toBe("malformed-test");
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.text).toBe("Hello");
  });

  test("skips entries with unknown type", async () => {
    const content = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: "unknown-type-test",
        cwd: "/test",
        tools: [],
        model: "claude",
      }),
      JSON.stringify({
        type: "unknown_type_xyz",
        uuid: "unknown1",
        session_id: "unknown-type-test",
      }),
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: "unknown-type-test",
        message: { role: "user", content: "Valid message" },
      }),
    ].join("\n");

    await writeFile(join(MALFORMED_TEST_DIR, "unknown-type.jsonl"), content);

    const session = await parseSession(join(MALFORMED_TEST_DIR, "unknown-type.jsonl"));

    expect(session.sessionId).toBe("unknown-type-test");
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.text).toBe("Valid message");
  });

  test("skips entries with missing type field", async () => {
    const content = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: "missing-type-test",
        cwd: "/test",
        tools: [],
        model: "claude",
      }),
      JSON.stringify({
        uuid: "no-type",
        session_id: "missing-type-test",
        message: { role: "user", content: "No type field" },
      }),
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: "missing-type-test",
        message: { role: "user", content: "Has type field" },
      }),
    ].join("\n");

    await writeFile(join(MALFORMED_TEST_DIR, "missing-type.jsonl"), content);

    const session = await parseSession(join(MALFORMED_TEST_DIR, "missing-type.jsonl"));

    expect(session.sessionId).toBe("missing-type-test");
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.text).toBe("Has type field");
  });

  test("handles file with all invalid entries", async () => {
    const content = [
      "{invalid json",
      JSON.stringify({ uuid: "no-type" }),
      JSON.stringify({ type: "unknown" }),
    ].join("\n");

    await writeFile(join(MALFORMED_TEST_DIR, "all-invalid.jsonl"), content);

    const session = await parseSession(join(MALFORMED_TEST_DIR, "all-invalid.jsonl"));

    expect(session.sessionId).toBe("");
    expect(session.turns).toHaveLength(0);
  });

  test("handles empty file", async () => {
    await writeFile(join(MALFORMED_TEST_DIR, "empty.jsonl"), "");

    const session = await parseSession(join(MALFORMED_TEST_DIR, "empty.jsonl"));

    expect(session.sessionId).toBe("");
    expect(session.turns).toHaveLength(0);
  });
});
