import { describe, test, expect } from "bun:test";
import { spawn } from "bun";
import { join } from "path";

const CLI_PATH = join(import.meta.dir, "word-count.ts");

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
});
