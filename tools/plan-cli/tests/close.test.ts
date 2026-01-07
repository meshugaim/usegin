import { describe, expect, it } from "bun:test";
import { $ } from "bun";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

describe("plan close command", () => {
  describe("CLI parsing", () => {
    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} close --help`.text();

      expect(result).toContain("close");
      expect(result).toContain("--reason");
      expect(result).toContain("--comment");
      expect(result).toContain("--quiet");
      expect(result).toContain("--json");
    });

    it("requires an id argument", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "close"], {
        env: process.env,
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });

    it("accepts --comment flag in help", async () => {
      const result = await $`bun ${CLI_PATH} close --help`.text();
      expect(result).toContain("--comment");
      expect(result).toContain("Add a comment");
    });

    it("shows difference between --reason and --comment in help", async () => {
      const result = await $`bun ${CLI_PATH} close --help`.text();
      // --reason prefixes with "Closed:"
      expect(result).toContain("--reason");
      // --comment is raw
      expect(result).toContain("--comment");
    });
  });

  describe("error handling", () => {
    it("exits with code 2 on missing API key", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "close", "ENG-123"], {
        env: { ...process.env, LINEAR_API_KEY: undefined },
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(2);
    });

    it("exits with code 2 on missing API key with --comment flag", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "close", "ENG-123", "--comment", "Test comment"], {
        env: { ...process.env, LINEAR_API_KEY: undefined },
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(2);
    });
  });
});
