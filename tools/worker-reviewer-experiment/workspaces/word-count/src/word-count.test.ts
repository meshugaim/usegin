import { describe, test, expect } from "bun:test";

describe("word-count CLI", () => {
  test("help flag shows usage", async () => {
    const proc = Bun.spawn(["bun", "run", "./src/word-count.ts", "--help"], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output).toContain("Usage:");
    expect(proc.exitCode).toBe(0);
  });

  test("empty file outputs zero words", async () => {
    const tempFile = "/tmp/empty-test-file.txt";
    await Bun.write(tempFile, "");

    const proc = Bun.spawn(["bun", "run", "./src/word-count.ts", tempFile], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output.trim()).toBe("0 words");
    expect(proc.exitCode).toBe(0);
  });
});
