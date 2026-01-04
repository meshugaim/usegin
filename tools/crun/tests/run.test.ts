import { describe, test, expect, mock, beforeEach } from "bun:test";
import { run, type RunOptions, type RunDeps } from "../src/run";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Test fixtures
const TEST_SESSION_ID = "test-1234-5678-abcd-ef0123456789";
const TEST_LOG_DIR = join(tmpdir(), "crun-test-logs");

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
    claudeCommand: ["bun", "run", "--bun", "claude", "-p", "--dangerously-skip-permissions"],
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
