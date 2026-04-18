/**
 * In-process tests for `decorateCommitWithLinear` (slice 5 —
 * ENG-5044).
 *
 * These tests stub `DecorateLinearDeps` so they can pin:
 *   - Happy path: extract → fetch returns {id,title,status} → commit.linear populated.
 *   - No ENG ref: fetch NOT called, commit.linear stays absent, NO warning.
 *   - Fetch returns null (the one-way-to-fail contract, per G4):
 *     commit.linear stays absent, AC-18 warning fired.
 *
 * Subprocess-level integration tests in `../code-history.test.ts`
 * exercise the same pipeline end-to-end through the CLI for the
 * timeout / malformed-JSON / nonzero-exit / missing-`plan`-CLI
 * failure flavors. This file focuses on the decorator's
 * "any-null-from-fetch collapses to warning + omit" contract
 * without the subprocess cost.
 *
 * The `test.failing` marks are the Red-phase pins.
 */

import { describe, test, expect } from "bun:test";

import {
  decorateCommitWithLinear,
  formatLinearWarning,
  type DecorateLinearDeps,
} from "./linear-decorate";
import type { DecoratedCommit } from "./types";
import type { LinearIssue } from "./linear";
import {
  LINEAR_FIXTURE_ID,
  LINEAR_FIXTURE_TITLE,
  LINEAR_FIXTURE_STATUS,
} from "./__fixtures__/linear";

const FIXTURE_COMMIT_SHA = "4fff467fb48a632519c742358505e9a0a739d525";

function makeCommit(overrides: Partial<DecoratedCommit> = {}): DecoratedCommit {
  return {
    sha: FIXTURE_COMMIT_SHA,
    date: "2026-04-18",
    committedAt: "2026-04-18T08:43:00+00:00",
    subject: "feat: wire the linear line",
    body: `Implements ${LINEAR_FIXTURE_ID}.\n\nPart of: ${LINEAR_FIXTURE_ID}`,
    ...overrides,
  };
}

/**
 * Compose a `DecorateLinearDeps` from overrides. Defaults:
 *   - `fetchLinearIssue` returns the canonical fixture issue.
 *   - `warn` is a no-op (tests that care about warn pass their own
 *     spy).
 */
function makeDeps(
  overrides: Partial<DecorateLinearDeps> = {},
): DecorateLinearDeps {
  return {
    fetchLinearIssue:
      overrides.fetchLinearIssue ??
      (async () => ({
        id: LINEAR_FIXTURE_ID,
        title: LINEAR_FIXTURE_TITLE,
        status: LINEAR_FIXTURE_STATUS,
      })),
    warn: overrides.warn ?? (() => {}),
  };
}

// =============================================================================
// decorateCommitWithLinear — in-process (ENG-5044)
// =============================================================================

describe("decorateCommitWithLinear (ENG-5044)", () => {
  test.failing(
    "ENG-5044 (P1): ENG ref in body + fetch returns issue → commit.linear populated with {id,title,status}",
    async () => {
      const commit = makeCommit();
      const decorated = await decorateCommitWithLinear(commit, makeDeps());

      expect(decorated.linear).toBeDefined();
      expect(decorated.linear!.id).toBe(LINEAR_FIXTURE_ID);
      expect(decorated.linear!.title).toBe(LINEAR_FIXTURE_TITLE);
      expect(decorated.linear!.status).toBe(LINEAR_FIXTURE_STATUS);
    },
  );

  test.failing(
    "ENG-5044: decorator calls fetchLinearIssue with the ENG id extracted from the body",
    async () => {
      const commit = makeCommit({
        body: "This commit touches ENG-1234.\n\nPart of: ENG-1234",
      });
      let fetchedWith: string | null = null;
      const deps = makeDeps({
        fetchLinearIssue: async (id) => {
          fetchedWith = id;
          return {
            id,
            title: "Mock title",
            status: "Todo",
          };
        },
      });
      await decorateCommitWithLinear(commit, deps);
      expect(fetchedWith).toBe("ENG-1234");
    },
  );

  test.failing(
    "ENG-5044 (G2): multiple ENG refs in body → decorator fetches the FIRST match only",
    async () => {
      const commit = makeCommit({
        body: [
          "Touches ENG-100 and also ENG-200.",
          "",
          "Part of: ENG-300",
        ].join("\n"),
      });
      let fetchedWith: string | null = null;
      const deps = makeDeps({
        fetchLinearIssue: async (id) => {
          fetchedWith = id;
          return { id, title: "t", status: "s" };
        },
      });
      await decorateCommitWithLinear(commit, deps);
      expect(fetchedWith).toBe("ENG-100");
    },
  );

  test(
    "ENG-5044 (N1 / AC 9): no ENG ref in body → fetchLinearIssue NOT called, commit.linear absent, NO warning fired",
    async () => {
      // Plain `test` (not `test.failing`) — the Red stub returns the
      // commit unchanged without calling fetch or warn, which is
      // also exactly what Green does when `extractLinearRef` returns
      // null. Regression-guard for the AC 9 missing-layer invariant
      // at BOTH phases: "no ENG ref" is the normal case, not a
      // failure — no subprocess, no stderr noise.
      const commit = makeCommit({
        body: "Just a plain body with no issue ref.",
      });
      let fetchCalled = false;
      let warnCalled = false;
      const deps: DecorateLinearDeps = {
        fetchLinearIssue: async () => {
          fetchCalled = true;
          return null;
        },
        warn: () => {
          warnCalled = true;
        },
      };
      const decorated = await decorateCommitWithLinear(commit, deps);

      expect(decorated.linear).toBeUndefined();
      expect(fetchCalled).toBe(false);
      expect(warnCalled).toBe(false);
    },
  );

  test.failing(
    "ENG-5044 (AC 18): ENG ref present but fetchLinearIssue returns null → commit.linear absent, warn fired with id-naming message",
    async () => {
      // Collapses all subprocess failure flavors (timeout, nonzero
      // exit, malformed JSON, missing `plan` CLI) — the decorator
      // doesn't distinguish; fetch returning null IS the signal.
      const commit = makeCommit();
      const warnings: string[] = [];
      const deps: DecorateLinearDeps = {
        fetchLinearIssue: async () => null,
        warn: (msg) => warnings.push(msg),
      };
      const decorated = await decorateCommitWithLinear(commit, deps);

      expect(decorated.linear).toBeUndefined();
      expect(warnings).toHaveLength(1);
      // Warning must name the id so users / log-greppers know which
      // issue failed. Pin the canonical shape via `formatLinearWarning`
      // so this assertion and the subprocess-level tests stay in sync.
      expect(warnings[0]).toBe(formatLinearWarning(LINEAR_FIXTURE_ID));
      expect(warnings[0]).toContain(LINEAR_FIXTURE_ID);
      // Single-line only — no embedded newlines (AC 18 "one line").
      expect(warnings[0]).not.toContain("\n");
    },
  );

  test.failing(
    "ENG-5044 (AC 18): warning identifies the EXTRACTED ENG id, not a hardcoded template placeholder",
    async () => {
      // Regression guard: an implementation that formatted the
      // warning with a wrong id (e.g. uses the commit body literal
      // instead of the extracted id, or swaps the template
      // parameter) would pass the previous test when the body
      // happens to mention the canonical fixture id. This test
      // uses a non-canonical id.
      const commit = makeCommit({
        body: "Fixes ENG-424242.\n\nPart of: ENG-424242",
      });
      const warnings: string[] = [];
      const deps: DecorateLinearDeps = {
        fetchLinearIssue: async () => null,
        warn: (msg) => warnings.push(msg),
      };
      await decorateCommitWithLinear(commit, deps);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("ENG-424242");
      expect(warnings[0]).not.toContain(LINEAR_FIXTURE_ID);
    },
  );

  test.failing(
    "ENG-5044: decorator returns a NEW object on the happy path (no mutation of the input commit)",
    async () => {
      // Mirrors `decorateCommitWithSession`'s immutability contract.
      // Guards against an implementation that mutates `commit` in
      // place — future callers relying on referential equality to
      // detect "decoration happened" would silently break.
      const commit = makeCommit();
      const decorated = await decorateCommitWithLinear(commit, makeDeps());
      expect(decorated).not.toBe(commit);
      expect(commit.linear).toBeUndefined(); // input unchanged
    },
  );
});

// =============================================================================
// formatLinearWarning — unit (ENG-5044)
// =============================================================================
//
// The canonical AC-18 warning shape is pinned here so the decorator,
// the integration tests, and any future grep-friendly tooling share
// one format. Plain `test` — this is a pure-data assertion against a
// helper that already works at Red, not a behavior test.

describe("formatLinearWarning (ENG-5044)", () => {
  test("ENG-5044 (AC 18): canonical shape for a known id", () => {
    expect(formatLinearWarning("ENG-5044")).toBe(
      "warning: plan show ENG-5044 failed; linear context skipped",
    );
  });

  test("ENG-5044 (AC 18): single line — contains no newline", () => {
    // Guards against a future template change that embeds `\n` (e.g.
    // appending a "try running … manually" hint). AC 18 explicitly
    // pins "one line".
    expect(formatLinearWarning("ENG-1")).not.toContain("\n");
  });
});
