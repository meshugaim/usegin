import { describe, test, expect, afterAll } from "bun:test";
import { spawn } from "bun";
import { join } from "path";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";

const CLI_PATH = join(import.meta.dir, "word-count.ts");

// Create temp directory for test files
const tempDir = mkdtempSync(join(tmpdir(), "word-count-test-"));

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("word-count CLI", () => {
  test("missing argument exits with error", async () => {
    const proc = spawn({
      cmd: ["bun", "run", CLI_PATH],
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr.trim()).toBe("Error: No file specified");
  });

  test("nonexistent file exits with error", async () => {
    const proc = spawn({
      cmd: ["bun", "run", CLI_PATH, "/nonexistent/file.txt"],
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr.trim()).toBe("Error: File not found: /nonexistent/file.txt");
  });

  test("empty file outputs zero words", async () => {
    const emptyFile = join(tempDir, "empty.txt");
    writeFileSync(emptyFile, "");

    const proc = spawn({
      cmd: ["bun", "run", CLI_PATH, emptyFile],
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("0 words");
  });

  test("file with content outputs correct word count", async () => {
    const contentFile = join(tempDir, "content.txt");
    writeFileSync(contentFile, "hello world foo bar");

    const proc = spawn({
      cmd: ["bun", "run", CLI_PATH, contentFile],
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("4 words");
  });
});
