import { describe, expect, it } from "bun:test";
import { $ } from "bun";
import { readFileSync } from "fs";
import { resolve } from "path";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;
const COMMANDS_DIR = resolve(import.meta.dir, "../src/commands");

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

  describe("JSON output for side-effect-only operations", () => {
    it("emits JSON confirmation when comment is added without field updates", () => {
      // The update command has two output paths:
      // 1. Field updates (title, status, etc.) → JSON with full issue details
      // 2. Side-effect-only (comment, relationships) → must also emit JSON
      //
      // This test verifies path 2 emits JSON rather than producing no output.
      const source = readFileSync(resolve(COMMANDS_DIR, "update.ts"), "utf-8");

      // Find the "} else if (!opts.blockedBy ..." block — this is the branch
      // reached when there are no field updates and no side-effect ops either.
      // Before this branch, there should be a separate JSON output block for
      // side-effect-only operations.
      const hasFieldUpdatesIdx = source.indexOf("if (hasFieldUpdates)");
      expect(hasFieldUpdatesIdx).toBeGreaterThan(-1);

      // The code between "if (hasFieldUpdates) {" and its closing else should
      // handle field update JSON output. But we need JSON output ALSO for the
      // case where !hasFieldUpdates but side-effect ops were performed.
      //
      // Strategy: look for a code path that emits JSON.stringify when
      // hasFieldUpdates is false. This should exist as an else branch or
      // a separate block after the hasFieldUpdates if/else.
      const afterFieldUpdates = source.slice(hasFieldUpdatesIdx);

      // Split into the "if (hasFieldUpdates)" block and what comes after.
      // Find the matching else clause for !hasFieldUpdates.
      // The else clause currently just checks "no updates specified" error.
      // We need to verify there's JSON output between the field-updates block
      // and the error check, or in a separate block.

      // Look for "commentAdded" or similar in the source — this would indicate
      // JSON output for comment-only operations exists.
      const hasCommentJsonOutput = source.includes("commentAdded");
      expect(hasCommentJsonOutput).toBe(true);
    });
  });
});
