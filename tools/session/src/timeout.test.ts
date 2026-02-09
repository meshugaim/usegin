import { describe, test, expect } from "bun:test";
import { withTimeout } from "./parser";

describe("withTimeout", () => {
  test("resolves when promise completes before timeout", async () => {
    const fastPromise = Promise.resolve("done");
    const result = await withTimeout(fastPromise, 5);
    expect(result).toBe("done");
  });

  test("rejects with user-friendly error when timeout expires", async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 5000));

    await expect(withTimeout(slowPromise, 0.1)).rejects.toThrow(
      "Parsing timed out after 0.1s"
    );
  });

  test("error message includes hint about --debug", async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      await withTimeout(slowPromise, 0.1);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("--debug");
    }
  });

  test("timeout of 0 disables timeout (returns promise as-is)", async () => {
    const promise = Promise.resolve("no timeout");
    const result = await withTimeout(promise, 0);
    expect(result).toBe("no timeout");
  });

  test("negative timeout disables timeout", async () => {
    const promise = Promise.resolve("negative");
    const result = await withTimeout(promise, -1);
    expect(result).toBe("negative");
  });

  test("propagates original promise rejection", async () => {
    const failingPromise = Promise.reject(new Error("original error"));

    await expect(withTimeout(failingPromise, 5)).rejects.toThrow("original error");
  });

  test("clears timeout when promise resolves (no orphaned timer)", async () => {
    // Spy on global clearTimeout to verify cleanup
    let clearTimeoutCalled = false;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.clearTimeout = (...args: Parameters<typeof clearTimeout>) => {
      clearTimeoutCalled = true;
      return originalClearTimeout(...args);
    };

    try {
      const fastPromise = Promise.resolve("done");
      await withTimeout(fastPromise, 30);
      expect(clearTimeoutCalled).toBe(true);
    } finally {
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  test("clears timeout when promise rejects (no orphaned timer)", async () => {
    // Verify cleanup also happens on rejection path
    let clearTimeoutCalled = false;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.clearTimeout = (...args: Parameters<typeof clearTimeout>) => {
      clearTimeoutCalled = true;
      return originalClearTimeout(...args);
    };

    try {
      const failingPromise = Promise.reject(new Error("boom"));
      await expect(withTimeout(failingPromise, 30)).rejects.toThrow("boom");
      expect(clearTimeoutCalled).toBe(true);
    } finally {
      globalThis.clearTimeout = originalClearTimeout;
    }
  });
});

describe("CLI --timeout flag", () => {
  test("--timeout flag is recognized in help", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts", "--help"], {
      cwd: "/workspaces/test-mvp/tools/session",
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output).toContain("--timeout");
  });

  test("--timeout accepts a value", async () => {
    // This should not error on flag parsing (may error on missing file, that's ok)
    const proc = Bun.spawn(["bun", "src/cli.ts", "--timeout", "10", "nonexistent.jsonl"], {
      cwd: "/workspaces/test-mvp/tools/session",
      stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    // Should not contain "unknown flag" or similar
    expect(stderr).not.toContain("unknown");
    expect(stderr).not.toContain("unrecognized");
  });
});
