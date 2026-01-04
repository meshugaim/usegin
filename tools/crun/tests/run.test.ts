import { describe, test, expect, mock, beforeEach } from "bun:test";
import {
  run,
  createDefaultDeps,
  generateSessionId,
  type RunOptions,
  type RunDeps,
} from "../src/run";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Test fixtures
const TEST_SESSION_ID = "test-1234-5678-abcd-ef0123456789";
const TEST_LOG_DIR = join(tmpdir(), "crun-test-logs");

/**
 * Create mock deps with spawnClaude mocked (for unit tests)
 */
function createMockDeps(overrides: Partial<RunDeps> = {}): RunDeps {
  return {
    generateSessionId: mock(() => Promise.resolve(TEST_SESSION_ID)),
    spawnClaude: mock(() =>
      Promise.resolve({
        exitCode: 0,
        stdout: "Claude output here",
        stderr: "",
      })
    ),
    logDir: TEST_LOG_DIR,
    claudeCommand: ["echo"],
    ...overrides,
  };
}

/**
 * Create real deps with a test command instead of claude (for integration tests)
 * Uses the real spawnClaude implementation but with `echo` as the command
 */
function createTestDeps(overrides: Partial<RunDeps> = {}): RunDeps {
  const defaults = createDefaultDeps();
  return {
    ...defaults,
    generateSessionId: mock(() => Promise.resolve(TEST_SESSION_ID)),
    logDir: TEST_LOG_DIR,
    // Use 'echo' to test the actual spawn logic without running claude
    claudeCommand: ["echo", "ARGS:"],
    ...overrides,
  };
}

beforeEach(async () => {
  await rm(TEST_LOG_DIR, { recursive: true, force: true });
  await mkdir(TEST_LOG_DIR, { recursive: true });
});

describe("crun run", () => {
  describe("prompt handling", () => {
    test("uses prompt from positional argument", async () => {
      const deps = createMockDeps();
      await run({ prompt: "fix the bug" }, deps);

      expect(deps.spawnClaude).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "fix the bug" })
      );
    });

    test("reads prompt from file when --prompt-file provided", async () => {
      const promptFile = join(TEST_LOG_DIR, "prompt.txt");
      await Bun.write(promptFile, "prompt from file");

      const deps = createMockDeps();
      await run({ promptFile }, deps);

      expect(deps.spawnClaude).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "prompt from file" })
      );
    });

    test("errors when no prompt provided", async () => {
      const deps = createMockDeps();
      await expect(run({}, deps)).rejects.toThrow("No prompt provided");
    });
  });

  describe("session handling", () => {
    test("generates new session ID when not resuming", async () => {
      const deps = createMockDeps();
      const result = await run({ prompt: "test" }, deps);

      expect(deps.generateSessionId).toHaveBeenCalled();
      expect(result.sessionId).toBe(TEST_SESSION_ID);
    });

    test("uses provided session ID when --resume", async () => {
      const deps = createMockDeps();
      const result = await run(
        { prompt: "test", resume: "existing-session-id" },
        deps
      );

      expect(deps.generateSessionId).not.toHaveBeenCalled();
      expect(result.sessionId).toBe("existing-session-id");
    });

    test("passes --resume flag to claude when resuming", async () => {
      const deps = createMockDeps();
      await run({ prompt: "test", resume: "existing-session-id" }, deps);

      expect(deps.spawnClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          resume: "existing-session-id",
        })
      );
    });
  });

  describe("claude invocation", () => {
    test("passes model to claude", async () => {
      const deps = createMockDeps();
      await run({ prompt: "test", model: "opus" }, deps);

      expect(deps.spawnClaude).toHaveBeenCalledWith(
        expect.objectContaining({ model: "opus" })
      );
    });

    test("passes cwd to claude", async () => {
      const deps = createMockDeps();
      await run({ prompt: "test", cwd: "/path/to/worktree" }, deps);

      expect(deps.spawnClaude).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: "/path/to/worktree" })
      );
    });

    test("runs claude in specified directory", async () => {
      const testDir = join(TEST_LOG_DIR, "workdir");
      await mkdir(testDir, { recursive: true });

      let capturedCwd: string | undefined;
      const deps = createMockDeps({
        spawnClaude: async (options) => {
          capturedCwd = options.cwd;
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      });

      await run({ prompt: "test", cwd: testDir }, deps);

      expect(capturedCwd).toBe(testDir);
    });

    test("passes extra claude flags", async () => {
      const deps = createMockDeps();
      await run(
        {
          prompt: "test",
          claudeFlags: ["--verbose"],
        },
        deps
      );

      expect(deps.spawnClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          extraFlags: ["--verbose"],
        })
      );
    });

    test("passes claude command to spawner", async () => {
      const deps = createMockDeps({
        claudeCommand: ["custom", "claude", "command"],
      });
      await run({ prompt: "test" }, deps);

      expect(deps.spawnClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          command: ["custom", "claude", "command"],
        })
      );
    });
  });

  describe("logging", () => {
    test("writes output to log file", async () => {
      const deps = createMockDeps({
        spawnClaude: mock(() =>
          Promise.resolve({
            exitCode: 0,
            stdout: "stdout content",
            stderr: "stderr content",
          })
        ),
      });

      await run({ prompt: "test" }, deps);

      const logPath = join(TEST_LOG_DIR, `${TEST_SESSION_ID}.log`);
      const logContent = await Bun.file(logPath).text();
      expect(logContent).toContain("stdout content");
      expect(logContent).toContain("stderr content");
    });
  });

  describe("exit handling", () => {
    test("returns exit code from claude", async () => {
      const deps = createMockDeps({
        spawnClaude: mock(() =>
          Promise.resolve({ exitCode: 1, stdout: "", stderr: "" })
        ),
      });

      const result = await run({ prompt: "test" }, deps);
      expect(result.exitCode).toBe(1);
    });

    test("returns session ID and log path", async () => {
      const deps = createMockDeps();
      const result = await run({ prompt: "test" }, deps);

      expect(result.sessionId).toBe(TEST_SESSION_ID);
      expect(result.logPath).toBe(join(TEST_LOG_DIR, `${TEST_SESSION_ID}.log`));
    });
  });
});

describe("crun integration", () => {
  test("spawns process with correct args for new session", async () => {
    const deps = createTestDeps();
    const result = await run({ prompt: "test prompt" }, deps);

    // echo outputs the args, which get captured in the log
    const logContent = await Bun.file(result.logPath).text();
    expect(logContent).toContain("ARGS:");
    expect(logContent).toContain("--session-id");
    expect(logContent).toContain(TEST_SESSION_ID);
    expect(result.exitCode).toBe(0);
  });

  test("spawns process with --resume for existing session", async () => {
    const deps = createTestDeps();
    const result = await run(
      { prompt: "test", resume: "existing-id" },
      deps
    );

    const logContent = await Bun.file(result.logPath).text();
    expect(logContent).toContain("--resume");
    expect(logContent).toContain("existing-id");
  });

  test("spawns process with --model flag", async () => {
    const deps = createTestDeps();
    const result = await run({ prompt: "test", model: "opus" }, deps);

    const logContent = await Bun.file(result.logPath).text();
    expect(logContent).toContain("--model");
    expect(logContent).toContain("opus");
  });

  test("spawns process with extra flags", async () => {
    const deps = createTestDeps();
    const result = await run(
      { prompt: "test", claudeFlags: ["--verbose", "--no-cache"] },
      deps
    );

    const logContent = await Bun.file(result.logPath).text();
    expect(logContent).toContain("--verbose");
    expect(logContent).toContain("--no-cache");
  });

  test("captures non-zero exit code", async () => {
    const deps = createTestDeps({
      claudeCommand: ["sh", "-c", "exit 42"],
    });
    const result = await run({ prompt: "test" }, deps);

    expect(result.exitCode).toBe(42);
  });

  test("captures stderr output", async () => {
    const deps = createTestDeps({
      claudeCommand: ["sh", "-c", "echo 'stderr output' >&2"],
    });
    const result = await run({ prompt: "test" }, deps);

    const logContent = await Bun.file(result.logPath).text();
    expect(logContent).toContain("stderr output");
  });
});

describe("generateSessionId", () => {
  test("returns a valid UUID", async () => {
    const id = await generateSessionId();

    // UUID format: 8-4-4-4-12
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("returns unique IDs", async () => {
    const id1 = await generateSessionId();
    const id2 = await generateSessionId();

    expect(id1).not.toBe(id2);
  });
});
