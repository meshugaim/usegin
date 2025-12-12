import { describe, expect, it } from "bun:test";
import { $ } from "bun";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

describe("plan update command", () => {
  describe("CLI parsing", () => {
    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} update --help`.text();

      expect(result).toContain("update");
      expect(result).toContain("--title");
      expect(result).toContain("--status");
      expect(result).toContain("--assignee");
      expect(result).toContain("--blocked-by");
      expect(result).toContain("--blocking");
      expect(result).toContain("--related-to");
      expect(result).toContain("--duplicate-of");
    });

    it("requires an issue identifier", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "update"], {
        env: process.env,
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });

    it("requires at least one update option", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "update", "ENG-999"], {
        env: process.env,
        stderr: "pipe",
      });

      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No updates specified");
    });
  });

  describe("error handling", () => {
    it("exits with code 2 on missing API key", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "update", "ENG-1", "--title", "new"], {
        env: { ...process.env, LINEAR_API_KEY: undefined },
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(2);
    });
  });
});
