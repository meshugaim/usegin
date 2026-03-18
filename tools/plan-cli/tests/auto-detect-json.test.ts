/**
 * Wiring tests for auto-detect JSON output across commands.
 *
 * shouldDefaultToJson is already thoroughly tested (16 tests in list.test.ts).
 * These tests verify that show, search, history, and labels import it from
 * the shared output-mode module and use the resolved value instead of opts.json.
 *
 * Approach: read command source files and verify they:
 * 1. Import shouldDefaultToJson from the shared module
 * 2. Call shouldDefaultToJson (not just use opts.json for output branching)
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

const COMMANDS_DIR = resolve(import.meta.dir, "../src/commands");

function readCommandSource(name: string): string {
  return readFileSync(resolve(COMMANDS_DIR, `${name}.ts`), "utf-8");
}

describe("auto-detect JSON wiring", () => {
  for (const command of ["show", "search", "history", "labels"]) {
    describe(command, () => {
      it(`imports shouldDefaultToJson from shared output-mode module`, () => {
        const source = readCommandSource(command);
        expect(source).toContain(
          'import { shouldDefaultToJson } from "../lib/output-mode"'
        );
      });

      it(`calls shouldDefaultToJson to resolve output mode`, () => {
        const source = readCommandSource(command);
        expect(source).toContain("shouldDefaultToJson(");
      });

      it(`uses resolved useJson variable (not opts.json) for output branching`, () => {
        const source = readCommandSource(command);
        // After the shouldDefaultToJson call, the command should branch on useJson,
        // not on opts.json. Verify useJson is used in a conditional.
        expect(source).toMatch(/if\s*\(\s*useJson\s*\)/);
      });
    });
  }

  // Mutation commands: create, update, close, start
  for (const command of ["create", "update", "close", "start"]) {
    describe(command, () => {
      it(`imports shouldDefaultToJson from shared output-mode module`, () => {
        const source = readCommandSource(command);
        expect(source).toContain(
          'import { shouldDefaultToJson } from "../lib/output-mode"'
        );
      });

      it(`calls shouldDefaultToJson to resolve output mode`, () => {
        const source = readCommandSource(command);
        expect(source).toContain("shouldDefaultToJson(");
      });

      it(`uses resolved useJson variable (not opts.json) for output branching`, () => {
        const source = readCommandSource(command);
        // After the shouldDefaultToJson call, the command should branch on useJson,
        // not on opts.json. Verify useJson is used in a conditional.
        expect(source).toMatch(/if\s*\(\s*useJson\s*\)/);
      });

      it(`does not use opts.json for output branching`, () => {
        const source = readCommandSource(command);
        // After wiring, opts.json should only appear in the shouldDefaultToJson call,
        // not in any if-conditions for output branching.
        // Extract lines that use opts.json in a conditional (excluding the shouldDefaultToJson call).
        const lines = source.split("\n");
        const offendingLines = lines.filter(
          (line) =>
            /opts\.json/.test(line) &&
            !line.includes("shouldDefaultToJson") &&
            // Allow opts.json in type annotations and parameter destructuring
            !line.trim().startsWith("json?:") &&
            !line.trim().startsWith("*")
        );
        expect(offendingLines).toEqual([]);
      });
    });
  }

  // Also verify list.ts still has proper wiring (regression guard)
  describe("list (regression)", () => {
    it("imports shouldDefaultToJson from shared output-mode module", () => {
      const source = readCommandSource("list");
      expect(source).toContain(
        'import { shouldDefaultToJson } from "../lib/output-mode"'
      );
    });
  });
});
