/**
 * Tests for `context.ts` — session-context extractors.
 *
 * Landed in the Red phase of ENG-5050. All `test.failing` entries are
 * the pre-committed Tier-1 bar from the Linear issue; they flip to
 * plain `test` when Green lands the real implementations.
 *
 * The pure-module-invariant test (grep-style) is a plain `test` — it
 * passes today (stubs don't import `fs`/`node:*`/`Bun`, no `async`)
 * and acts as a regression guard once real code lands.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { extractIntent, isCommandOrCaveat } from "./context";
import { makeUserTurn } from "./__fixtures__/turns";

// ============================================================================
// Pure-module invariant (AC 16) — plain test, passes today
// ============================================================================

describe("context.ts pure-module invariant", () => {
  test("source contains no fs/node:/Bun/async imports or calls", () => {
    const raw = readFileSync(
      join(import.meta.dir, "context.ts"),
      "utf8",
    );

    // Strip block comments (`/* ... */`) and line comments (`// ...`) so
    // that the forbidden-token checks only see real code. Comments may
    // legitimately mention `Bun.` or `async` in prose (e.g. a docstring
    // explaining the invariant), and we don't want the grep to flag them.
    const stripped = raw
      // block comments, including JSDoc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // line comments
      .replace(/\/\/[^\n]*/g, "");

    // Forbidden value-imports. `import type { ... } from "..."` is allowed
    // (type-only, erased at compile time), so skip lines that declare a
    // type-only import.
    const lines = stripped.split("\n");
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes("import type")) continue;
      expect(lower).not.toContain('from "fs"');
      expect(lower).not.toContain('from "node:');
      expect(lower).not.toContain('from "bun"');
    }

    // Runtime `Bun.` calls and `async ` function keyword are forbidden
    // in real code. The comment strip above removes docstring mentions.
    expect(stripped).not.toContain("Bun.");
    // Match `async ` as a keyword (followed by function/paren/identifier)
    // so we don't false-positive on e.g. "asynchrony".
    expect(stripped).not.toMatch(/\basync\s+(function|\(|\w)/);
  });
});

// ============================================================================
// extractIntent (AC 10)
// ============================================================================

describe("extractIntent", () => {
  test.failing("P1: skips caveat + command-name, returns first real msg", () => {
    const turns = [
      makeUserTurn("<caveat>system noise</caveat>"),
      makeUserTurn("<command-name>/retro</command-name>"),
      makeUserTurn("fix the build"),
    ];
    expect(extractIntent(turns)).toBe("fix the build");
  });

  test.failing("P2: returns first real msg when it is the first turn", () => {
    const turns = [
      makeUserTurn("hello claude"),
      makeUserTurn("follow-up message"),
    ];
    expect(extractIntent(turns)).toBe("hello claude");
  });

  test.failing("N1: all user turns are wrappers → null", () => {
    const turns = [
      makeUserTurn("<caveat>...</caveat>"),
      makeUserTurn("<command-name>/foo</command-name>"),
      makeUserTurn("<command-message>bar</command-message>"),
    ];
    expect(extractIntent(turns)).toBeNull();
  });

  test.failing("N2: no user turns → null", () => {
    expect(extractIntent([])).toBeNull();
  });

  // Meta-test — plain test, guards against input mutation / stateful impls.
  test("idempotence: same input twice → same result, input unchanged", () => {
    const turns = [makeUserTurn("hello")];
    const snapshot = JSON.parse(JSON.stringify(turns));
    const first = extractIntent(turns);
    const second = extractIntent(turns);
    expect(second).toBe(first);
    expect(turns).toEqual(snapshot);
  });
});

// ============================================================================
// isCommandOrCaveat — optional single sanity test (not in Tier-1 bar)
// ============================================================================
//
// Exhaustive behavior is covered through `extractIntent`'s Tier-1 tests
// above, where `isCommandOrCaveat` is the underlying skip rule. One
// direct test here documents that the predicate is exported and
// reusable by Part B (ENG-5051's trigger walk).

describe("isCommandOrCaveat", () => {
  test.failing("returns true for <command-name> wrapper text", () => {
    expect(isCommandOrCaveat("<command-name>/retro</command-name>")).toBe(true);
  });
});
