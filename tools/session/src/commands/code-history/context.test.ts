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

import { extractIntent, isCommandOrCaveat, truncate } from "./context";
import { makeAssistantTurn, makeUserTurn } from "./__fixtures__/turns";

// ============================================================================
// Pure-module invariant (AC 16) — plain test, passes today
// ============================================================================

describe("context.ts pure-module invariant", () => {
  // Known limits: the comment-stripping pass below is intentionally naive —
  // it removes block/line comments but does NOT remove string literals,
  // template literals, or regex literals. A string/template/regex containing
  // the substring `async function` or `from "fs"` would false-positive this
  // test. Today `context.ts` contains none of those, so the grep is reliable.
  // If a legitimate future edit to `context.ts` trips this test (e.g. a
  // string literal that mentions `async function` in user-facing text),
  // extend the strip to remove string/regex literals first rather than
  // weakening the forbidden-token list.
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
  test("P1: skips caveat + command-name, returns first real msg", () => {
    const turns = [
      makeUserTurn("<caveat>system noise</caveat>"),
      makeUserTurn("<command-name>/retro</command-name>"),
      makeUserTurn("fix the build"),
    ];
    expect(extractIntent(turns)).toBe("fix the build");
  });

  test("P2: returns first real msg when it is the first turn", () => {
    // Insert an assistant turn between the two user turns so the fixture
    // mirrors real-session alternation (user → assistant → user).
    // `extractIntent` behavior is unchanged — it still finds "hello claude"
    // as the first real user turn.
    const turns = [
      makeUserTurn("hello claude"),
      makeAssistantTurn({}),
      makeUserTurn("follow-up message"),
    ];
    expect(extractIntent(turns)).toBe("hello claude");
  });

  test("N1: all user turns are wrappers → null", () => {
    const turns = [
      makeUserTurn("<caveat>...</caveat>"),
      makeUserTurn("<command-name>/foo</command-name>"),
      makeUserTurn("<command-message>bar</command-message>"),
    ];
    expect(extractIntent(turns)).toBeNull();
  });

  test("N2: no user turns → null", () => {
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
  test("returns true for <command-name> wrapper text", () => {
    expect(isCommandOrCaveat("<command-name>/retro</command-name>")).toBe(true);
  });

  test("returns true for <command-message> wrapper text", () => {
    expect(isCommandOrCaveat("<command-message>retro</command-message>")).toBe(true);
  });

  test("returns true for Caveat:-prefixed text", () => {
    expect(isCommandOrCaveat("Caveat: system noise goes here")).toBe(true);
  });

  // Negative case: plain user prose → false. The stub returns `false` for
  // everything, so this passes today. Kept as plain `test` (not `.failing`)
  // because it's a true regression guard once Green lands — the real impl
  // must not flag ordinary text as command-or-caveat.
  test("returns false for plain user prose", () => {
    expect(isCommandOrCaveat("fix the build")).toBe(false);
  });
});

// ============================================================================
// truncate (AC 15)
// ============================================================================

describe("truncate", () => {
  test("value ≤ 200 chars (post-collapse) → unchanged", () => {
    const short = "a".repeat(50);
    expect(truncate(short)).toBe(short);
  });

  test("value > 200 chars (post-collapse) → truncated with ellipsis, total length 200", () => {
    const long = "a".repeat(300);
    const result = truncate(long);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(200);
    expect(result!.endsWith("…")).toBe(true);
    expect(result!.slice(0, 199)).toBe("a".repeat(199));
  });

  test("null → null", () => {
    expect(truncate(null)).toBeNull();
  });

  test("collapses single \\n to space", () => {
    expect(truncate("a\nb")).toBe("a b");
  });

  test("collapses single \\t to space", () => {
    expect(truncate("a\tb")).toBe("a b");
  });

  test("run-collapses consecutive \\n/\\t mix to single space", () => {
    expect(truncate("a\n\n\tb")).toBe("a b");
  });

  test("truncation is applied AFTER whitespace collapse", () => {
    // Raw length 255, but consecutive `\n`s collapse into a single run
    // → collapsed value is far under the 200-char cap and must NOT be
    // truncated. A naive "truncate-then-collapse" impl would chop the
    // raw string first and fail this test.
    const raw = "\n".repeat(250) + "hello";
    expect(raw.length).toBe(255);
    const result = truncate(raw);
    // Exact expected shape: the leading \n-run collapses to one space,
    // then "hello". Total length 6, no ellipsis.
    expect(result).toBe(" hello");
  });

  test("collapse-then-truncate when BOTH raw and collapsed exceed cap", () => {
    // Mirror of the above: raw length 252 AND collapsed length 251 — both
    // exceed the 200-char cap, so truncation must still fire. Pins the
    // rule in the opposite direction: collapse happens first, then the
    // length check, and the 200-char cap still applies when the
    // collapsed value is long.
    const raw = "\n\n" + "a".repeat(250);
    expect(raw.length).toBe(252);
    const result = truncate(raw);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(200);
    expect(result!.endsWith("…")).toBe(true);
    // After collapse: " " + 250 a's (251 chars). Truncate to 200:
    // first 199 chars of collapsed value + ellipsis = " " + 198 a's + "…".
    expect(result!).toBe(" " + "a".repeat(198) + "…");
  });

  // Meta-test — plain test, mutation guard
  test("idempotence: same string twice → same result", () => {
    const input = "hello\nworld";
    const first = truncate(input);
    const second = truncate(input);
    expect(second).toBe(first);
    // Input string is primitive so can't be mutated, but assert reference
    // equality as a sanity check.
    expect(input).toBe("hello\nworld");
  });
});
