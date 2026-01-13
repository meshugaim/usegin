import { describe, expect, it } from "bun:test";
import { $ } from "bun";

describe("clone CLI", () => {
  it("shows help with --help flag", async () => {
    const result = await $`bun run src/index.ts --help`.text();

    expect(result).toContain("clone");
    expect(result).toContain("Git reference clone lifecycle management");
    expect(result).toContain("create");
    expect(result).toContain("destroy");
    expect(result).toContain("list");
    expect(result).toContain("path");
  });

  it("shows version with --version flag", async () => {
    const result = await $`bun run src/index.ts --version`.text();

    expect(result.trim()).toBe("0.1.0");
  });

  describe("create command", () => {
    it("shows help for create command", async () => {
      const result = await $`bun run src/index.ts create --help`.text();

      expect(result).toContain("Create a new reference clone");
      expect(result).toContain("<name>");
    });
  });

  describe("destroy command", () => {
    it("shows help for destroy command", async () => {
      const result = await $`bun run src/index.ts destroy --help`.text();

      expect(result).toContain("Remove a clone");
      expect(result).toContain("<name>");
      expect(result).toContain("--force");
    });
  });

  describe("list command", () => {
    it("shows help for list command", async () => {
      const result = await $`bun run src/index.ts list --help`.text();

      expect(result).toContain("List all clones");
      expect(result).toContain("--json");
    });

    it("has ls alias", async () => {
      const result = await $`bun run src/index.ts ls --help`.text();

      expect(result).toContain("List all clones");
    });
  });

  describe("path command", () => {
    it("shows help for path command", async () => {
      const result = await $`bun run src/index.ts path --help`.text();

      expect(result).toContain("Get the absolute path to a clone directory");
      expect(result).toContain("<name>");
    });
  });
});
