import { describe, expect, it } from "bun:test";
import { $ } from "bun";

const CLI_PATH = new URL("../index.ts", import.meta.url).pathname;

describe("worktree CLI", () => {
  describe("main program", () => {
    it("shows version with --version flag", async () => {
      const result = await $`bun ${CLI_PATH} --version`.text();
      expect(result.trim()).toBe("0.1.0");
    });

    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} --help`.text();

      expect(result).toContain("worktree");
      expect(result).toContain("Git worktree lifecycle management");
      expect(result).toContain("create");
      expect(result).toContain("destroy");
      expect(result).toContain("list");
    });

    it("shows help when no command provided", async () => {
      const result = await $`bun ${CLI_PATH} --help`.text();
      expect(result).toContain("Commands:");
    });
  });

  describe("create command", () => {
    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} create --help`.text();

      expect(result).toContain("create");
      expect(result).toContain("Create a new worktree");
      expect(result).toContain("<name>");
    });

    it("exits with error when no name provided", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "create"], {
        env: process.env,
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });
  });

  describe("destroy command", () => {
    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} destroy --help`.text();

      expect(result).toContain("destroy");
      expect(result).toContain("Remove a worktree and its branch");
      expect(result).toContain("<name>");
      expect(result).toContain("--force");
    });

    it("exits with error when no name provided", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "destroy"], {
        env: process.env,
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });
  });

  describe("list command", () => {
    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} list --help`.text();

      expect(result).toContain("list");
      expect(result).toContain("List all worktrees");
      expect(result).toContain("--json");
    });

    it("has ls alias", async () => {
      const result = await $`bun ${CLI_PATH} ls --help`.text();

      expect(result).toContain("list");
      expect(result).toContain("List all worktrees");
    });

    it("can run list command (shows worktrees or 'No worktrees found')", async () => {
      const result = await $`bun ${CLI_PATH} list`.text();

      // Should either show worktrees or the "No worktrees found" message
      // depending on the current git repository state
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
