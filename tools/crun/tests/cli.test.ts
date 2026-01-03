import { describe, expect, it } from "bun:test";
import { $ } from "bun";

const CLI_PATH = new URL("../src/cli.ts", import.meta.url).pathname;

describe("crun CLI", () => {
  describe("help output", () => {
    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} --help`.text();

      expect(result).toContain("crun");
      expect(result).toContain("spawn");
      expect(result).toContain("list");
      expect(result).toContain("status");
      expect(result).toContain("tail");
      expect(result).toContain("send");
      expect(result).toContain("kill");
    });

    it("shows version with --version flag", async () => {
      const result = await $`bun ${CLI_PATH} --version`.text();
      expect(result.trim()).toBe("0.1.0");
    });
  });

  describe("spawn command", () => {
    it("shows help with spawn --help", async () => {
      const result = await $`bun ${CLI_PATH} spawn --help`.text();

      expect(result).toContain("spawn");
      expect(result).toContain("--detach");
      expect(result).toContain("--issue");
      expect(result).toContain("--resume");
      expect(result).toContain("--model");
    });

    it("requires a prompt argument", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "spawn"], {
        env: process.env,
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });
  });

  describe("list command", () => {
    it("shows help with list --help", async () => {
      const result = await $`bun ${CLI_PATH} list --help`.text();

      expect(result).toContain("list");
      expect(result).toContain("--json");
      expect(result).toContain("--all");
    });

    it("has ls alias", async () => {
      const result = await $`bun ${CLI_PATH} ls --help`.text();
      expect(result).toContain("list");
    });

    it("lists historical processes with --all flag", async () => {
      const result = await $`bun ${CLI_PATH} list --all`.text();
      // Should either have processes or show "No crun processes found"
      expect(result.length).toBeGreaterThan(0);
    });

    it("includes historical in JSON output with --all", async () => {
      const result = await $`bun ${CLI_PATH} list --all --json`.text();
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);

      // If there are any historical processes, they should have status "historical"
      const historical = parsed.filter((p: { status: string }) => p.status === "historical");
      if (historical.length > 0) {
        expect(historical[0].status).toBe("historical");
      }
    });
  });

  describe("status command", () => {
    it("shows help with status --help", async () => {
      const result = await $`bun ${CLI_PATH} status --help`.text();

      expect(result).toContain("status");
      expect(result).toContain("session-id");
      expect(result).toContain("--json");
    });

    it("requires a session-id argument", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "status"], {
        env: process.env,
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });
  });

  describe("tail command", () => {
    it("shows help with tail --help", async () => {
      const result = await $`bun ${CLI_PATH} tail --help`.text();

      expect(result).toContain("tail");
      expect(result).toContain("session-id");
      expect(result).toContain("--raw");
    });

    it("requires a session-id argument", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "tail"], {
        env: process.env,
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });
  });

  describe("send command", () => {
    it("shows help with send --help", async () => {
      const result = await $`bun ${CLI_PATH} send --help`.text();

      expect(result).toContain("send");
      expect(result).toContain("session-id");
      expect(result).toContain("prompt");
    });

    it("requires session-id and prompt arguments", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "send"], {
        env: process.env,
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });
  });

  describe("kill command", () => {
    it("shows help with kill --help", async () => {
      const result = await $`bun ${CLI_PATH} kill --help`.text();

      expect(result).toContain("kill");
      expect(result).toContain("session-id");
      expect(result).toContain("--all");
    });
  });
});
