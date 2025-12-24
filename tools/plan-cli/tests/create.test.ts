import { describe, expect, it } from "bun:test";
import { $ } from "bun";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

describe("plan create command", () => {
  describe("CLI parsing", () => {
    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} create --help`.text();

      expect(result).toContain("create");
      expect(result).toContain("--parent");
      expect(result).toContain("--quiet");
      expect(result).toContain("--start");
    });

    it("requires a title argument", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "create"], {
        env: process.env,
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });
  });

  describe("error handling", () => {
    it("exits with code 2 on missing API key", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "create", "Test issue"], {
        env: { ...process.env, LINEAR_API_KEY: undefined },
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(2);
    });
  });
});
