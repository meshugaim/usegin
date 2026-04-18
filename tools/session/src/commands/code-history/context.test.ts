/**
 * Tests for `context.ts` — session-context extractors (ENG-5050).
 * Covers the Tier-1 acceptance criteria plus whitespace-collapse /
 * boundary pins added during Refactor.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  CONTEXT_ELLIPSIS,
  CONTEXT_MAX_LEN,
  extractIntent,
  extractOutcome,
  extractTrigger,
  isCommandOrCaveat,
  truncate,
} from "./context";
import {
  makeAssistantTurn,
  makeBashTurn,
  makeUserTurn,
} from "./__fixtures__/turns";

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

  // AC 15: truncate is applied at the extractor's return boundary so
  // downstream consumers receive a ready-to-render string. These two
  // tests pin that boundary — they would fail against a raw-return impl.
  test("long intent is truncated per AC 15 at extractor boundary", () => {
    const turns = [makeUserTurn("a".repeat(CONTEXT_MAX_LEN + 100))];
    const result = extractIntent(turns);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(CONTEXT_MAX_LEN);
    expect(result!.endsWith(CONTEXT_ELLIPSIS)).toBe(true);
    expect(result!.slice(0, CONTEXT_MAX_LEN - 1)).toBe("a".repeat(CONTEXT_MAX_LEN - 1));
  });

  test("intent with embedded \\n\\t is collapsed per AC 15", () => {
    const turns = [makeUserTurn("line1\nline2\tline3")];
    expect(extractIntent(turns)).toBe("line1 line2 line3");
  });

  // Empty-text guard: a pure tool-result user turn (no prose) must be
  // skipped rather than returned as the intent. Kept separate from the
  // command/caveat skip rule because the two questions are distinct.
  test("empty-text user turns are skipped (e.g. pure tool-result)", () => {
    const turns = [makeUserTurn(""), makeUserTurn("hello")];
    expect(extractIntent(turns)).toBe("hello");
  });

  test("all empty or command/caveat user turns → null", () => {
    const turns = [
      makeUserTurn(""),
      makeUserTurn("<caveat>noise</caveat>"),
    ];
    expect(extractIntent(turns)).toBeNull();
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

  // Plain prose input — the real impl must not flag ordinary text as
  // command-or-caveat. True regression guard.
  test("returns false for plain user prose", () => {
    expect(isCommandOrCaveat("fix the build")).toBe(false);
  });
});

// ============================================================================
// truncate (AC 15)
// ============================================================================

describe("truncate", () => {
  test("value ≤ cap (post-collapse) → unchanged", () => {
    const short = "a".repeat(50);
    expect(truncate(short)).toBe(short);
  });

  test("value > cap (post-collapse) → truncated with ellipsis, total length = cap", () => {
    const long = "a".repeat(CONTEXT_MAX_LEN + 100);
    const result = truncate(long);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(CONTEXT_MAX_LEN);
    expect(result!.endsWith(CONTEXT_ELLIPSIS)).toBe(true);
    expect(result!.slice(0, CONTEXT_MAX_LEN - 1)).toBe("a".repeat(CONTEXT_MAX_LEN - 1));
  });

  // Boundary pins — exactly-at-cap stays untouched, one-over truncates.
  test("value exactly at cap (post-collapse) → unchanged, no ellipsis", () => {
    const exact = "a".repeat(CONTEXT_MAX_LEN);
    expect(truncate(exact)).toBe(exact);
  });

  test("value exactly cap+1 (post-collapse) → truncates to cap with ellipsis", () => {
    const oneOver = "a".repeat(CONTEXT_MAX_LEN + 1);
    const result = truncate(oneOver);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(CONTEXT_MAX_LEN);
    expect(result!.endsWith(CONTEXT_ELLIPSIS)).toBe(true);
  });

  test("null → null", () => {
    expect(truncate(null)).toBeNull();
  });

  test("empty string → empty string", () => {
    expect(truncate("")).toBe("");
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
    // exceed the cap, so truncation must still fire. Pins the rule in the
    // opposite direction: collapse happens first, then the length check,
    // and the cap still applies when the collapsed value is long.
    const raw = "\n\n" + "a".repeat(250);
    expect(raw.length).toBe(252);
    const result = truncate(raw);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(CONTEXT_MAX_LEN);
    expect(result!.endsWith(CONTEXT_ELLIPSIS)).toBe(true);
    // After collapse: " " + 250 a's (251 chars). Truncate to cap:
    // first (cap - 1) chars of collapsed value + ellipsis.
    expect(result!).toBe(" " + "a".repeat(CONTEXT_MAX_LEN - 2) + CONTEXT_ELLIPSIS);
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

// ============================================================================
// extractTrigger (AC 11) — ENG-5051
// ============================================================================
//
// Positive cases (P1–P8) and negative cases (N1–N8) mirror the pre-committed
// test list from ENG-5051's Linear description. Each `test.failing` fails at
// assertion level against the stub return of "<unimplemented>" — not at
// import or function-missing level.

describe("extractTrigger", () => {
  describe("positive cases", () => {
    test.failing(
      "P1: basic `git commit -m` with SHA in tool result → preceding user msg",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "fix: something"',
          "[main abc1234] fix: something\n 1 file changed",
        );
        const turns = [
          makeUserTurn("fix the bug please"),
          makeAssistantTurn({ text: "on it" }),
          bashA,
          bashUser,
        ];
        expect(extractTrigger(turns, "abc1234")).toBe("fix the bug please");
      },
    );

    test.failing(
      "P2: heredoc `git commit -m \"$(cat <<EOF...EOF)\"` detected as git commit",
      () => {
        const heredoc =
          'git commit -m "$(cat <<\'EOF\'\nfix: multiline commit body\n\nBody line here.\nEOF\n)"';
        const [bashA, bashUser] = makeBashTurn(
          heredoc,
          "[main def5678] fix: multiline commit body",
        );
        const turns = [
          makeUserTurn("please commit with a heredoc"),
          bashA,
          bashUser,
        ];
        expect(extractTrigger(turns, "def5678")).toBe(
          "please commit with a heredoc",
        );
      },
    );

    test.failing(
      "P3: leading whitespace / parens before `git commit` → detected after trim",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          "  git commit -m \"chore: indented\"",
          "[main 1111111] chore: indented",
        );
        const turns = [makeUserTurn("go ahead and commit"), bashA, bashUser];
        expect(extractTrigger(turns, "1111111")).toBe("go ahead and commit");
      },
    );

    test.failing("P4: `git commit --amend` is detected", () => {
      const [bashA, bashUser] = makeBashTurn(
        "git commit --amend --no-edit",
        "[main 2222222] fix: amended",
      );
      const turns = [makeUserTurn("amend the last commit"), bashA, bashUser];
      expect(extractTrigger(turns, "2222222")).toBe("amend the last commit");
    });

    test.failing("P4b: `git commit --no-verify` is detected", () => {
      // Spec P4 lists `--amend` AND `--no-verify` as flagged variants of
      // `git commit` that still qualify. Sibling to the `--amend` case above.
      const [bashA, bashUser] = makeBashTurn(
        'git commit --no-verify -m "chore: bypass hooks"',
        "[main 2222223] chore: bypass hooks",
      );
      const turns = [
        makeUserTurn("commit without running hooks"),
        bashA,
        bashUser,
      ];
      expect(extractTrigger(turns, "2222223")).toBe(
        "commit without running hooks",
      );
    });

    test.failing(
      "P5: multi-commit session — call with SHA_B returns commit_B's preceding user msg",
      () => {
        const [bashA_A, bashA_User] = makeBashTurn(
          'git commit -m "first"',
          "[main aaaaaaa] first",
        );
        const [bashB_A, bashB_User] = makeBashTurn(
          'git commit -m "second"',
          "[main bbbbbbb] second",
        );
        const turns = [
          makeUserTurn("do the first change"),
          bashA_A,
          bashA_User,
          makeUserTurn("now do the second change"),
          bashB_A,
          bashB_User,
        ];
        // Critical correctness: SHA_B's trigger is the second user ask,
        // NOT the first one.
        expect(extractTrigger(turns, "bbbbbbb")).toBe(
          "now do the second change",
        );
      },
    );

    test.failing(
      "P6: backward walk skips <command-name> / caveat user turns",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "chore"',
          "[main 3333333] chore",
        );
        const turns = [
          makeUserTurn("real user request"),
          makeUserTurn("<command-name>/retro</command-name>"),
          makeUserTurn("<local-command-stdout>noise</local-command-stdout>"),
          makeUserTurn("Caveat: a system preamble"),
          bashA,
          bashUser,
        ];
        // Backward walk must skip the three wrapper turns and land on
        // "real user request".
        expect(extractTrigger(turns, "3333333")).toBe("real user request");
      },
    );

    test.failing(
      "P7: tool-result body carries leading noise before the [branch sha] line — detector extracts SHA tokens from the [branch sha] pattern, then matches via bidirectional startsWith (same rule as P8)",
      () => {
        const noisyOutput =
          "warning: CRLF will be replaced by LF\nhint: foo\n[main 4444444] fix: noisy";
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "fix: noisy"',
          noisyOutput,
        );
        const turns = [makeUserTurn("commit the noisy one"), bashA, bashUser];
        expect(extractTrigger(turns, "4444444")).toBe("commit the noisy one");
      },
    );

    test.failing(
      "P8: SHA format variance — query with full 40-char SHA matches short SHA in result via bidirectional startsWith",
      () => {
        // Tool result carries the short 7-char SHA (as git prints it).
        // Caller passes the full 40-char SHA. Rule: match succeeds when
        // either string startsWith the other.
        const shortSha = "5555555";
        const fullSha = "5555555" + "f".repeat(33); // 40 chars, startsWith shortSha
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "fix: sha variance"',
          `[main ${shortSha}] fix: sha variance`,
        );
        const turns = [makeUserTurn("commit with sha variance"), bashA, bashUser];
        expect(extractTrigger(turns, fullSha)).toBe("commit with sha variance");
      },
    );
  });

  describe("negative cases", () => {
    test.failing(
      "N1: `git commits` (command name lacks word boundary after 'commit') → NOT detected (spec: `^git commit\\b`)",
      () => {
        // Bash command starts with "git commits" (plural) — the command name
        // "commits" lacks a word boundary after "commit", so the spec rule
        // `^git commit\b` does NOT match. Even though the tool result contains
        // the SHA, the command string is not a `git commit` invocation.
        const [bashA, bashUser] = makeBashTurn(
          "git commits --list",
          "[main 6666666] fake: should not match",
        );
        const turns = [makeUserTurn("list my commits"), bashA, bashUser];
        expect(extractTrigger(turns, "6666666")).toBeNull();
      },
    );

    test.failing(
      "N2: `git  commit` (double space) → NOT detected (literal-prefix semantics)",
      () => {
        // Judgment call per companion: spec says "starts with `git commit`",
        // literal prefix. Double-space between tokens breaks that prefix.
        // Kept as a negative; revisit if a real-user case surfaces.
        const [bashA, bashUser] = makeBashTurn(
          'git  commit -m "double space"',
          "[main 7777777] double space",
        );
        const turns = [makeUserTurn("commit with double space"), bashA, bashUser];
        expect(extractTrigger(turns, "7777777")).toBeNull();
      },
    );

    test.failing(
      "N3: `git checkout` / `git cherry-pick` → NOT detected",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          "git checkout -b new-branch",
          "[main 8888888] wrong command",
        );
        const turns = [makeUserTurn("checkout a branch"), bashA, bashUser];
        expect(extractTrigger(turns, "8888888")).toBeNull();
      },
    );

    test.failing(
      "N4: plain text mentioning `git commit` (not a Bash tool_use) → NOT detected",
      () => {
        // An assistant text turn that *says* "git commit" in prose but
        // never runs a Bash tool. No Bash tool_use → no commit-authoring
        // turn → null.
        const turns = [
          makeUserTurn("how do I commit?"),
          makeAssistantTurn({
            text: "You can run `git commit -m \"...\"` to commit changes.",
          }),
        ];
        expect(extractTrigger(turns, "9999999")).toBeNull();
      },
    );

    test.failing(
      "N5: Bash tool_use exists but SHA not in any tool result → null",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "something"',
          "[main aaaaaaa] something",
        );
        const turns = [makeUserTurn("commit please"), bashA, bashUser];
        // Query a SHA that doesn't appear anywhere in tool results.
        expect(extractTrigger(turns, "deadbee")).toBeNull();
      },
    );

    test.failing("N6: no Bash tool_use at all → null", () => {
      const turns = [
        makeUserTurn("hi"),
        makeAssistantTurn({ text: "hello back" }),
      ];
      expect(extractTrigger(turns, "abcdef0")).toBeNull();
    });

    test.failing(
      "N7: aliased `gc -m` → NOT detected (literal check, no alias resolution)",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          'gc -m "fix via alias"',
          "[main bbbbbbc] fix via alias",
        );
        const turns = [makeUserTurn("commit via alias"), bashA, bashUser];
        expect(extractTrigger(turns, "bbbbbbc")).toBeNull();
      },
    );

    test.failing(
      "N8: commit-authoring Bash turn with no preceding real user turn → null",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "no user"',
          "[main ccccccd] no user",
        );
        // All preceding user turns are wrappers — no real user ask.
        const turns = [
          makeUserTurn("<command-name>/auto-commit</command-name>"),
          makeUserTurn("Caveat: system preamble"),
          bashA,
          bashUser,
        ];
        expect(extractTrigger(turns, "ccccccd")).toBeNull();
      },
    );
  });
});

// ============================================================================
// extractOutcome (AC 12) — ENG-5051
// ============================================================================

describe("extractOutcome", () => {
  describe("positive cases", () => {
    test.failing(
      "P1: assistant text turn immediately after commit-authoring → returns its text",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "done"',
          "[main e111111] done",
        );
        const turns = [
          makeUserTurn("commit it"),
          bashA,
          bashUser,
          makeAssistantTurn({ text: "Committed as e111111." }),
        ];
        expect(extractOutcome(turns, "e111111")).toBe("Committed as e111111.");
      },
    );

    test.failing(
      "P2: tool-only assistant turn between commit and text → skip tool-only, return later text",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "done"',
          "[main e222222] done",
        );
        const turns = [
          makeUserTurn("commit it"),
          bashA,
          bashUser,
          // Tool-only assistant turn (empty text, a Bash tool_use).
          makeAssistantTurn({ bash: "git log -1" }),
          // Matching result turn.
          makeUserTurn(""),
          // Finally, the text-bearing assistant turn that reports outcome.
          makeAssistantTurn({ text: "Commit landed." }),
        ];
        expect(extractOutcome(turns, "e222222")).toBe("Commit landed.");
      },
    );

    test.failing(
      "P3: distant outcome — text-bearing assistant many turns after commit → returned (no window)",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "done"',
          "[main e333333] done",
        );
        // Fill with tool-only assistant turns and matching empty-text user
        // turns between the commit and the eventual outcome. The spec says
        // no hidden window — the first text-bearing assistant turn wins.
        const filler: ReturnType<typeof makeAssistantTurn>[] = [];
        for (let i = 0; i < 10; i += 1) {
          filler.push(makeAssistantTurn({ bash: `echo ${i}` }));
        }
        const turns = [
          makeUserTurn("commit it"),
          bashA,
          bashUser,
          ...filler,
          makeAssistantTurn({ text: "Commit landed, eventually." }),
        ];
        expect(extractOutcome(turns, "e333333")).toBe(
          "Commit landed, eventually.",
        );
      },
    );
  });

  describe("negative cases", () => {
    test.failing("N1: whitespace-only text after commit → skipped, null if no other text", () => {
      const [bashA, bashUser] = makeBashTurn(
        'git commit -m "done"',
        "[main f111111] done",
      );
      const turns = [
        makeUserTurn("commit it"),
        bashA,
        bashUser,
        // Only whitespace — must be skipped.
        makeAssistantTurn({ text: "   \n\t  " }),
      ];
      expect(extractOutcome(turns, "f111111")).toBeNull();
    });

    test.failing("N2: no following text-bearing assistant turn → null", () => {
      const [bashA, bashUser] = makeBashTurn(
        'git commit -m "done"',
        "[main f222222] done",
      );
      const turns = [
        makeUserTurn("commit it"),
        bashA,
        bashUser,
        // Only tool-only assistant turns after — no text to report.
        makeAssistantTurn({ bash: "echo after" }),
      ];
      expect(extractOutcome(turns, "f222222")).toBeNull();
    });

    test.failing(
      "N3: commit-authoring turn not found (SHA mismatch) → null",
      () => {
        const [bashA, bashUser] = makeBashTurn(
          'git commit -m "done"',
          "[main f333333] done",
        );
        const turns = [
          makeUserTurn("commit it"),
          bashA,
          bashUser,
          makeAssistantTurn({ text: "Commit landed." }),
        ];
        // Query an unrelated SHA — no authoring turn to anchor from.
        expect(extractOutcome(turns, "deadbee")).toBeNull();
      },
    );
  });
});

// ============================================================================
// extractTrigger + extractOutcome — AC 14 combined
// ============================================================================
//
// When the query SHA appears in no tool_result, BOTH trigger and outcome
// return null (the commit-authoring anchor is missing). extractIntent is
// unaffected because it doesn't take a SHA — it returns the first real
// user turn regardless.

describe("extractTrigger + extractOutcome (AC 14 combined)", () => {
  test.failing(
    "SHA not in any tool result → trigger + outcome both null; extractIntent unaffected",
    () => {
      const [bashA, bashUser] = makeBashTurn(
        'git commit -m "real commit"',
        "[main aaaaaab] real commit",
      );
      const turns = [
        makeUserTurn("do the thing"),
        bashA,
        bashUser,
        makeAssistantTurn({ text: "Committed." }),
      ];
      const missingSha = "deadbee";
      expect(extractTrigger(turns, missingSha)).toBeNull();
      expect(extractOutcome(turns, missingSha)).toBeNull();
      // Intent is SHA-independent and must still find the first real user.
      expect(extractIntent(turns)).toBe("do the thing");
    },
  );
});

// ============================================================================
// G3 pathological — same-SHA duplicate (non-crash guarantee)
// ============================================================================
//
// Impossible in real git (SHAs are content-addressed), but hand-crafted
// fixtures can produce two tool_results with the SAME full SHA. The
// extractor must not crash and must return deterministically — any
// implementation choice is fine as long as it's stable across runs.
//
// Plain `test` (not `test.failing`): the stubs don't crash on this input
// (they return "<unimplemented>" / null without traversing), so the
// non-crash assertion passes today and will keep passing through Green.
// The purpose is to pin the invariant in place BEFORE the real impl
// lands — so Green can't regress it.

describe("G3 pathological — same-SHA duplicate", () => {
  test("two tool_results with same SHA: both extractors run without crashing", () => {
    const sha = "ffffffff"; // 8 chars, same in both results
    const [bashA_1, bashUser_1] = makeBashTurn(
      'git commit -m "first"',
      `[main ${sha}] first`,
    );
    const [bashA_2, bashUser_2] = makeBashTurn(
      'git commit -m "second"',
      `[main ${sha}] second`,
    );
    const turns = [
      makeUserTurn("first ask"),
      bashA_1,
      bashUser_1,
      makeAssistantTurn({ text: "First done." }),
      makeUserTurn("second ask"),
      bashA_2,
      bashUser_2,
      makeAssistantTurn({ text: "Second done." }),
    ];
    // Non-crash guarantee — the actual return is not pinned here
    // (deterministic, but implementation-defined; once Green lands,
    // a follow-up test can pin "first match wins" or similar).
    expect(() => extractTrigger(turns, sha)).not.toThrow();
    expect(() => extractOutcome(turns, sha)).not.toThrow();
    // TODO(ENG-5051 Green): once first-match-wins is deterministic, add:
    //   expect(extractTrigger(turns, sha)).toBe("first ask")
    // to promote this from a non-crash guarantee to a behavior pin.
  });
});

// ============================================================================
// idempotence meta-tests — extractTrigger + extractOutcome
// ============================================================================
//
// Mirror of the `extractIntent` idempotence meta-test: same input twice
// → same result, input unchanged. Guards against input mutation and
// stateful impls.
//
// Plain `test` (not `test.failing`): idempotence is a pure invariant that
// any sane implementation — including today's stub that returns the same
// "<unimplemented>" sentinel without touching `turns` — must satisfy, so
// this passes today and keeps passing through Green. Same pattern as G3
// (non-crash guarantee): pin the invariant in place BEFORE the real impl
// lands so Green can't regress it.
//
// These tests intentionally do NOT pin a specific return value — value
// pins belong in P-cases (P1 pins "fix the bug please", P-cases for
// extractOutcome pin "Committed as …"). Keeping these tests single-purpose
// means a future change to a return-value pin touches the P-case it
// belongs to, not a meta-test pretending to be two tests in one.

describe("idempotence meta-tests", () => {
  test("extractTrigger: deterministic + input-unchanged on repeat", () => {
    const [bashA, bashUser] = makeBashTurn(
      'git commit -m "x"',
      "[main 1234abc] x",
    );
    const turns = [makeUserTurn("trigger user"), bashA, bashUser];
    const snapshot = JSON.parse(JSON.stringify(turns));
    const first = extractTrigger(turns, "1234abc");
    const second = extractTrigger(turns, "1234abc");
    expect(second).toBe(first);
    expect(turns).toEqual(snapshot);
  });

  test("extractOutcome: deterministic + input-unchanged on repeat", () => {
    const [bashA, bashUser] = makeBashTurn(
      'git commit -m "x"',
      "[main 5678def] x",
    );
    const turns = [
      makeUserTurn("trigger user"),
      bashA,
      bashUser,
      makeAssistantTurn({ text: "outcome here" }),
    ];
    const snapshot = JSON.parse(JSON.stringify(turns));
    const first = extractOutcome(turns, "5678def");
    const second = extractOutcome(turns, "5678def");
    expect(second).toBe(first);
    expect(turns).toEqual(snapshot);
  });
});
