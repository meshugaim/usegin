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

  test("file with content outputs correct word count", async () => {
    const tempFile = "/tmp/content-test-file.txt";
    await Bun.write(tempFile, "hello world foo bar");

    const proc = Bun.spawn(["bun", "run", "./src/word-count.ts", tempFile], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output.trim()).toBe("4 words");
    expect(proc.exitCode).toBe(0);
  });

  test("missing argument exits with error", async () => {
    const proc = Bun.spawn(["bun", "run", "./src/word-count.ts"], {
      cwd: import.meta.dir + "/..",
      stderr: "pipe",
    });
    const errorOutput = await new Response(proc.stderr).text();
    await proc.exited;

    expect(errorOutput).toContain("Error: No file specified");
    expect(proc.exitCode).toBe(1);
  });

  test("nonexistent file exits with error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "./src/word-count.ts", "/nonexistent/path/file.txt"],
      {
        cwd: import.meta.dir + "/..",
        stderr: "pipe",
      }
    );
    const errorOutput = await new Response(proc.stderr).text();
    await proc.exited;

    expect(errorOutput).toContain(
      "Error: File not found: /nonexistent/path/file.txt"
    );
    expect(proc.exitCode).toBe(1);
  });
});
