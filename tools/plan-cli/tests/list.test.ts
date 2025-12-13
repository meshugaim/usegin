import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { $ } from "bun";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

describe("plan list command", () => {
  describe("error handling", () => {
    it("exits with code 2 on missing API key", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "list"], {
        env: { ...process.env, LINEAR_API_KEY: undefined },
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(2);
    });

    it("shows helpful error message on missing API key", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "list"], {
        env: { ...process.env, LINEAR_API_KEY: undefined },
        stderr: "pipe",
      });

      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr.toLowerCase()).toContain("linear_api_key");
    });
  });

  describe("CLI parsing", () => {
    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} list --help`.text();

      expect(result).toContain("list");
      expect(result).toContain("--team");
      expect(result).toContain("--depth");
    });

    it("shows version with --version on main command", async () => {
      const result = await $`bun ${CLI_PATH} --version`.text();
      expect(result).toContain("0.1.0");
    });
  });

  // Note: Tests that require actual Linear API are in tests/e2e/
});
