import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { runKill, formatKillResult } from "../src/kill";
import { recordInvocation, type InvocationEntry } from "../src/invocations";

const TEST_DIR = join(tmpdir(), "crun-kill-test");
const TEST_INVOCATIONS_PATH = join(TEST_DIR, "invocations.jsonl");

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("formatKillResult", () => {
  test("formats killed result", () => {
    const output = formatKillResult({ status: "killed", message: "Sent SIGTERM to process 1234" });
    expect(output).toContain("Killed");
    expect(output).toContain("SIGTERM");
  });

  test("formats not_found result", () => {
    const output = formatKillResult({ status: "not_found", message: "Invocation 'abc' not found" });
    expect(output).toContain("Not found");
    expect(output).toContain("abc");
  });

  test("formats already_stopped result", () => {
    const output = formatKillResult({ status: "already_stopped", message: "Already stopped" });
    expect(output).toContain("Already stopped");
  });

  test("formats process_not_found result", () => {
    const output = formatKillResult({ status: "process_not_found", message: "Process gone" });
    expect(output).toContain("Stale entry");
  });

  test("formats kill_failed result", () => {
    const output = formatKillResult({ status: "kill_failed", message: "Permission denied" });
    expect(output).toContain("Failed");
  });
});

describe("runKill", () => {
  test("returns formatted output for not_found", async () => {
    const output = await runKill("non-existent", TEST_INVOCATIONS_PATH);
    expect(output).toContain("Not found");
  });

  test("returns formatted output for already_stopped", async () => {
    const entry: InvocationEntry = {
      id: "completed-id",
      sessionId: "session-123",
      pid: 1234,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "completed",
      exitCode: 0,
      prompt: "Test",
    };

    await recordInvocation(entry, TEST_INVOCATIONS_PATH);

    const output = await runKill("completed-id", TEST_INVOCATIONS_PATH);
    expect(output).toContain("Already stopped");
  });

  test("returns formatted output for stale entry", async () => {
    const entry: InvocationEntry = {
      id: "stale-id",
      sessionId: "session-123",
      pid: 999999999, // Non-existent PID
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: "Test",
    };

    await recordInvocation(entry, TEST_INVOCATIONS_PATH);

    const output = await runKill("stale-id", TEST_INVOCATIONS_PATH);
    expect(output).toContain("Stale entry");
    expect(output).toContain("999999999");
  });
});
