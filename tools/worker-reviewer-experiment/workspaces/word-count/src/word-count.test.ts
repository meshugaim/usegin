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
});
