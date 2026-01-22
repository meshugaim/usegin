import { describe, test, expect } from "bun:test";
import { spawn } from "bun";

describe("md2html CLI", () => {
  test("help flag shows usage", async () => {
    const proc = spawn(["bun", "run", "./src/md2html.ts", "--help"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("md2html");
  });
});
