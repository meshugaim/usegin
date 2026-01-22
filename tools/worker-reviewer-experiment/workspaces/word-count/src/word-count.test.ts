import { describe, test, expect } from "bun:test";
import { spawn } from "bun";

describe("word-count", () => {
  test("missing file argument exits with error", async () => {
    const proc = spawn(["bun", "run", "./src/word-count.ts"], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Error");
  });

  test("file not found exits with error", async () => {
    const proc = spawn(["bun", "run", "./src/word-count.ts", "nonexistent-file.txt"], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Error");
    expect(stderr).toContain("not found");
  });

  test("help flag shows usage", async () => {
    const proc = spawn(["bun", "run", "./src/word-count.ts", "--help"], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage: word-count <file>");
  });

  test("empty file outputs zero words", async () => {
    // Create a temporary empty file
    const tmpDir = import.meta.dir + "/..";
    const tmpFile = `${tmpDir}/test-empty-${Date.now()}.txt`;
    await Bun.write(tmpFile, "");

    try {
      const proc = spawn(["bun", "run", "./src/word-count.ts", tmpFile], {
        cwd: tmpDir,
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe("0 words");
    } finally {
      // Clean up temp file
      await Bun.file(tmpFile).exists() && (await Bun.$`rm ${tmpFile}`);
    }
  });
});
