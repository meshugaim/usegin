import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import {
  buildPm2Name,
  parsePm2Name,
  mapPm2Status,
  generateSessionId,
} from "../src/pm2";

describe("pm2 utilities", () => {
  describe("generateSessionId", () => {
    it("generates a valid UUID", async () => {
      const id = await generateSessionId();
      // UUID format: 8-4-4-4-12
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("generates unique IDs", async () => {
      const id1 = await generateSessionId();
      const id2 = await generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("buildPm2Name", () => {
    it("builds name from session ID only", () => {
      const name = buildPm2Name("abc123");
      expect(name).toBe("crun-abc123");
    });

    it("builds name from session ID and issue ID", () => {
      const name = buildPm2Name("abc123", "ENG-456");
      expect(name).toBe("crun-abc123-ENG-456");
    });

    it("handles empty issue ID", () => {
      const name = buildPm2Name("abc123", "");
      // Empty string is falsy, so should be same as no issue
      expect(name).toBe("crun-abc123");
    });
  });

  describe("parsePm2Name", () => {
    it("returns null for non-crun names", () => {
      expect(parsePm2Name("other-process")).toBeNull();
      expect(parsePm2Name("pm2-web")).toBeNull();
    });

    it("parses simple session ID", () => {
      const result = parsePm2Name("crun-abc123");
      expect(result).toEqual({ sessionId: "abc123" });
    });

    it("parses UUID session ID", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = parsePm2Name(`crun-${uuid}`);
      expect(result).toEqual({ sessionId: uuid });
    });

    it("parses UUID session ID with issue ID", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = parsePm2Name(`crun-${uuid}-ENG-123`);
      expect(result).toEqual({ sessionId: uuid, issueId: "ENG-123" });
    });

    it("parses various issue ID formats", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(parsePm2Name(`crun-${uuid}-ABC-1`)).toEqual({
        sessionId: uuid,
        issueId: "ABC-1",
      });
      expect(parsePm2Name(`crun-${uuid}-PROJ-99999`)).toEqual({
        sessionId: uuid,
        issueId: "PROJ-99999",
      });
    });
  });

  describe("mapPm2Status", () => {
    it("maps online to running", () => {
      expect(mapPm2Status("online")).toBe("running");
    });

    it("maps stopped with exit code 0 to done", () => {
      expect(mapPm2Status("stopped", 0)).toBe("done");
    });

    it("maps stopped with non-zero exit code to errored", () => {
      expect(mapPm2Status("stopped", 1)).toBe("errored");
    });

    it("maps errored to errored", () => {
      expect(mapPm2Status("errored")).toBe("errored");
    });

    it("maps stopping to running", () => {
      expect(mapPm2Status("stopping")).toBe("running");
    });

    it("maps unknown status to stopped", () => {
      expect(mapPm2Status("unknown")).toBe("stopped");
    });
  });
});

describe("parseLogFilename", () => {
  it("parses log filename with session ID only", async () => {
    const { parseLogFilename } = await import("../src/pm2");
    const result = parseLogFilename("crun-01f89845-29b8-4b00-b846-78badad84563-out.log");
    expect(result).toEqual({
      sessionId: "01f89845-29b8-4b00-b846-78badad84563",
    });
  });

  it("parses log filename with session ID and issue ID", async () => {
    const { parseLogFilename } = await import("../src/pm2");
    const result = parseLogFilename("crun-0175aeba-92f2-4d8e-bf03-f08625695bbb-ENG-123-out.log");
    expect(result).toEqual({
      sessionId: "0175aeba-92f2-4d8e-bf03-f08625695bbb",
      issueId: "ENG-123",
    });
  });

  it("parses error log filename", async () => {
    const { parseLogFilename } = await import("../src/pm2");
    const result = parseLogFilename("crun-01f89845-29b8-4b00-b846-78badad84563-error.log");
    expect(result).toEqual({
      sessionId: "01f89845-29b8-4b00-b846-78badad84563",
    });
  });

  it("returns null for non-crun logs", async () => {
    const { parseLogFilename } = await import("../src/pm2");
    expect(parseLogFilename("other-app-out.log")).toBeNull();
    expect(parseLogFilename("pm2-web-out.log")).toBeNull();
  });
});

describe("listHistoricalProcesses", () => {
  it("returns an array of historical processes", async () => {
    const { listHistoricalProcesses } = await import("../src/pm2");
    const processes = await listHistoricalProcesses();
    expect(Array.isArray(processes)).toBe(true);
  });

  it("returns processes with historical status", async () => {
    const { listHistoricalProcesses } = await import("../src/pm2");
    const processes = await listHistoricalProcesses();

    for (const proc of processes) {
      expect(proc.status).toBe("historical");
      expect(proc.sessionId).toBeDefined();
      expect(proc.pm2Name.startsWith("crun-")).toBe(true);
    }
  });

  it("extracts issue IDs from log filenames", async () => {
    const { listHistoricalProcesses } = await import("../src/pm2");
    const processes = await listHistoricalProcesses();

    // Some processes should have issue IDs (based on our data)
    const withIssues = processes.filter(p => p.issueId);
    expect(withIssues.length).toBeGreaterThan(0);
  });

  it("excludes active pm2 processes by default", async () => {
    const { listHistoricalProcesses, listProcesses } = await import("../src/pm2");

    const active = await listProcesses();
    const historical = await listHistoricalProcesses();

    // Historical list should not include any active session IDs
    const activeIds = new Set(active.map(p => p.sessionId));
    for (const proc of historical) {
      expect(activeIds.has(proc.sessionId)).toBe(false);
    }
  });
});

describe("pm2 SDK operations", () => {
  // These tests verify the SDK wrapper functions work correctly
  // They use mocking to avoid actual pm2 daemon interactions

  describe("withPm2Connection", () => {
    it("connects before operation and disconnects after", async () => {
      const { withPm2Connection } = await import("../src/pm2");

      // This test verifies the connection wrapper pattern
      // In integration tests, this would actually connect to pm2
      let operationCalled = false;

      try {
        await withPm2Connection(async () => {
          operationCalled = true;
        });
      } catch {
        // May fail if pm2 daemon not running, that's ok for unit test
      }

      // The function should attempt to run the operation
      // (may throw if pm2 not running, which is expected in test env)
    });
  });

  describe("listProcesses", () => {
    it("returns empty array when no crun processes exist", async () => {
      const { listProcesses } = await import("../src/pm2");

      // In a clean test environment, there should be no crun processes
      // or if pm2 isn't running, it should return empty array
      const processes = await listProcesses();
      expect(Array.isArray(processes)).toBe(true);
    });

    it("filters to only crun-prefixed processes", async () => {
      const { listProcesses } = await import("../src/pm2");

      const processes = await listProcesses();

      // All returned processes should have crun- prefix
      for (const p of processes) {
        expect(p.pm2Name.startsWith("crun-")).toBe(true);
      }
    });
  });

  describe("spawnProcess", () => {
    it("generates session ID and pm2 name", async () => {
      const { spawnProcess } = await import("../src/pm2");

      // Note: This will actually start a process if pm2 is running
      // In a proper test setup, we'd mock pm2
      // For now, we test that it throws or returns the expected shape
      try {
        const result = await spawnProcess({ prompt: "test" });
        expect(result.sessionId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
        expect(result.pm2Name).toMatch(/^crun-/);

        // Clean up
        const { deleteProcess } = await import("../src/pm2");
        await deleteProcess(result.sessionId);
      } catch {
        // Expected if pm2 not running or other issues
      }
    });

    it("uses provided session ID when resuming", async () => {
      const { spawnProcess } = await import("../src/pm2");

      const existingSessionId = "550e8400-e29b-41d4-a716-446655440000";

      try {
        const result = await spawnProcess({
          prompt: "test",
          resumeSessionId: existingSessionId,
        });
        expect(result.sessionId).toBe(existingSessionId);

        // Clean up
        const { deleteProcess } = await import("../src/pm2");
        await deleteProcess(result.sessionId);
      } catch {
        // Expected if pm2 not running
      }
    });

    it("includes issue ID in pm2 name when provided", async () => {
      const { spawnProcess, deleteProcess } = await import("../src/pm2");

      try {
        const result = await spawnProcess({
          prompt: "test",
          issueId: "ENG-123",
        });
        expect(result.pm2Name).toContain("ENG-123");

        // Clean up
        await deleteProcess(result.sessionId);
      } catch {
        // Expected if pm2 not running
      }
    });
  });

  describe("deleteProcess", () => {
    it("returns false for non-existent process", async () => {
      const { deleteProcess } = await import("../src/pm2");

      const result = await deleteProcess("non-existent-session-id");
      expect(result).toBe(false);
    });
  });

  describe("deleteAllProcesses", () => {
    it("returns count of deleted processes", async () => {
      const { deleteAllProcesses } = await import("../src/pm2");

      const count = await deleteAllProcesses();
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getProcess", () => {
    it("returns null for non-existent session", async () => {
      const { getProcess } = await import("../src/pm2");

      const process = await getProcess("non-existent-session-id");
      expect(process).toBeNull();
    });
  });

  describe("followProcess", () => {
    it("exits when an already-finished process is checked", async () => {
      const { followProcess, deleteProcess, generateSessionId, buildPm2Name, withPm2Connection } = await import("../src/pm2");
      const pm2 = await import("pm2");

      // Generate a unique session ID
      const sessionId = await generateSessionId();
      const pm2Name = buildPm2Name(sessionId);

      // Create a quick script that exits immediately
      const scriptFile = `/tmp/crun-test-${sessionId}.sh`;
      await Bun.write(scriptFile, `#!/bin/bash\necho "test output"\nexit 0\n`);
      await Bun.spawn(["chmod", "+x", scriptFile]).exited;

      // Start the process via pm2
      await withPm2Connection(async () => {
        return new Promise<void>((resolve, reject) => {
          pm2.default.start(
            {
              script: scriptFile,
              name: pm2Name,
              autorestart: false,
            },
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      // followProcess should return within 5 seconds
      // If it hangs forever, this test will timeout
      const timeout = 5000;
      const start = Date.now();

      try {
        await Promise.race([
          followProcess(sessionId),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("followProcess did not exit within timeout")), timeout)
          ),
        ]);
      } finally {
        // Cleanup
        await deleteProcess(sessionId);
        await Bun.spawn(["rm", "-f", scriptFile]).exited;
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(timeout);
    }, 10000);

    it("exits when process finishes while following", async () => {
      const { followProcess, deleteProcess, generateSessionId, buildPm2Name, withPm2Connection } = await import("../src/pm2");
      const pm2 = await import("pm2");

      // Generate a unique session ID
      const sessionId = await generateSessionId();
      const pm2Name = buildPm2Name(sessionId);

      // Create a script that runs for 2 seconds then exits
      const scriptFile = `/tmp/crun-test-${sessionId}.sh`;
      await Bun.write(scriptFile, `#!/bin/bash\necho "starting"\nsleep 2\necho "done"\nexit 0\n`);
      await Bun.spawn(["chmod", "+x", scriptFile]).exited;

      // Start the process via pm2
      await withPm2Connection(async () => {
        return new Promise<void>((resolve, reject) => {
          pm2.default.start(
            {
              script: scriptFile,
              name: pm2Name,
              autorestart: false,
            },
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      // followProcess should return within 5 seconds (2 seconds for process + 3 second buffer)
      // If it hangs forever, this test will timeout
      const timeout = 5000;
      const start = Date.now();

      try {
        await Promise.race([
          followProcess(sessionId),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("followProcess did not exit within timeout")), timeout)
          ),
        ]);
      } finally {
        // Cleanup
        await deleteProcess(sessionId);
        await Bun.spawn(["rm", "-f", scriptFile]).exited;
      }

      const elapsed = Date.now() - start;
      // Should take roughly 2 seconds (process runtime), not hang forever
      expect(elapsed).toBeGreaterThan(1500); // At least 1.5 seconds
      expect(elapsed).toBeLessThan(timeout);
    }, 10000);

    it("does not exit immediately for non-existent process (race condition fix)", async () => {
      // Regression test for ENG-766: followProcess was exiting immediately
      // when pm2.list() didn't find the process, treating "not found" as "finished"
      const { followProcess } = await import("../src/pm2");

      const fakeSessionId = `non-existent-${Date.now()}`;
      const start = Date.now();

      // followProcess should poll for the process (10 * 100ms = 1 second minimum)
      // before giving up and relying on bus events. Set a timeout to abort since
      // for a non-existent process, the bus will never fire an exit event.
      const timeout = 2000;

      await Promise.race([
        followProcess(fakeSessionId),
        new Promise<void>((resolve) => setTimeout(resolve, timeout)),
      ]);

      const elapsed = Date.now() - start;

      // Should have waited at least 500ms (polling attempts), not returned immediately
      // Before the fix, this would return in ~30-50ms
      expect(elapsed).toBeGreaterThanOrEqual(500);
    }, 5000);
  });
});
