/**
 * In-process tests for `decorateCommitWithLinear` (slice 5 —
 * ENG-5044).
 *
 * These tests stub `DecorateLinearDeps` so they can pin:
 *   - Happy path: extract → fetch returns {id,title,status} → commit.linear populated.
 *   - No ENG ref: fetch NOT called, commit.linear stays absent, NO warning.
 *   - Fetch returns `{ ok: false }` (the one-way-to-fail contract, per G4):
 *     commit.linear stays absent, AC-18 warning fired.
 *
 * Subprocess-level integration tests in `../code-history.test.ts`
 * exercise the same pipeline end-to-end through the CLI for the
 * timeout / malformed-JSON / nonzero-exit / missing-`plan`-CLI
 * failure flavors. This file focuses on the decorator's
 * "any-failure-from-fetch collapses to warning + omit" contract
 * without the subprocess cost.
 *
 * All tests land as plain `test`. Green (ENG-5044) removed the Red-phase
 * `test.failing` marks once the real decorator + `fetchLinearIssue` started
 * satisfying each assertion.
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
  test(
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

  test(
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

  test(
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
      //
      // Red-phase trivial pass: the Red stub returns the commit
      // unchanged regardless of trailer presence, so this assertion
      // green-passes today without exercising any extractor. Lands as
      // a real regression guard once Green wires
      // extractLinearRef → null → skip-fetch path (the "fetch not
      // called, warn not called" shape then becomes a genuine
      // assertion about the skip branch, not an artifact of the
      // stub).
      const commit = makeCommit({
        body: "Just a plain body with no issue ref.",
      });
      let fetchCalled = false;
      let warnCalled = false;
      const deps: DecorateLinearDeps = {
        fetchLinearIssue: async () => {
          fetchCalled = true;
          return { ok: false };
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

  test(
    "ENG-5044 (AC 18): ENG ref present but fetchLinearIssue returns failure → commit.linear absent, warn fired with id-naming message",
    async () => {
      // Collapses all subprocess failure flavors (timeout, nonzero
      // exit, malformed JSON, missing `plan` CLI) — the decorator
      // doesn't distinguish; fetch returning `{ ok: false }` IS the
      // signal. Detail-less shape here; the detail-propagation path
      // is pinned separately (S-2 test below).
      const commit = makeCommit();
      const warnings: string[] = [];
      const deps: DecorateLinearDeps = {
        fetchLinearIssue: async () => ({ ok: false }),
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

  test(
    "ENG-5044 (S-2 / AC 18): fetch failure with `detail` → warn includes the stderr hint inline",
    async () => {
      // S-2 stderr-propagation pin. Without this, a `rate limited` or
      // `not authenticated` response from `plan` would get swallowed —
      // the user would see only "plan show ENG-5039 failed" with no
      // actionable signal. The decorator folds `detail` into the
      // single-line warning template.
      const commit = makeCommit();
      const warnings: string[] = [];
      const deps: DecorateLinearDeps = {
        fetchLinearIssue: async () => ({
          ok: false,
          detail: "rate limited",
        }),
        warn: (msg) => warnings.push(msg),
      };
      await decorateCommitWithLinear(commit, deps);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toBe(
        formatLinearWarning(LINEAR_FIXTURE_ID, "rate limited"),
      );
      expect(warnings[0]).toContain("rate limited");
      expect(warnings[0]).toContain(LINEAR_FIXTURE_ID);
      // Single-line invariant (AC 18) holds even with detail embedded.
      expect(warnings[0]).not.toContain("\n");
    },
  );

  test(
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
        fetchLinearIssue: async () => ({ ok: false }),
        warn: (msg) => warnings.push(msg),
      };
      await decorateCommitWithLinear(commit, deps);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("ENG-424242");
      expect(warnings[0]).not.toContain(LINEAR_FIXTURE_ID);
    },
  );

  test(
    "ENG-5044 (S-6): long title from fetch → `commit.linear.title` stays RAW (not truncated at decorator boundary)",
    async () => {
      // S-6 refactor pin: title truncation moved from fetch to
      // render. The decorator must thread the fetch result through
      // unchanged, so `DecoratedCommit.linear.title` carries the raw
      // upstream string for slice 6's JSON mode. Render-layer
      // truncation lives in `formatLinearLine` (see `linear.test.ts`).
      //
      // Regression guard: if a future refactor accidentally reintroduces
      // title truncation at this layer (for instance by wrapping the
      // fetch result through a "normalize" helper that calls truncate),
      // this test fires immediately without needing the fake-`plan`
      // subprocess fixture.
      const longTitle = "x".repeat(250);
      const commit = makeCommit();
      const deps = makeDeps({
        fetchLinearIssue: async (id) => ({
          id,
          title: longTitle,
          status: "Todo",
        }),
      });
      const decorated = await decorateCommitWithLinear(commit, deps);

      expect(decorated.linear).toBeDefined();
      // Raw title passes through verbatim — no collapse, no cap, no `…`.
      expect(decorated.linear!.title).toBe(longTitle);
      expect(decorated.linear!.title).not.toContain("…");
      expect(decorated.linear!.title.length).toBe(250);
    },
  );

  test(
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
  test("ENG-5044 (AC 18): canonical shape for a known id (no detail)", () => {
    expect(formatLinearWarning("ENG-5044")).toBe(
      "Warning: plan show ENG-5044 failed; linear context skipped",
    );
  });

  test("ENG-5044 (AC 18): single line — contains no newline", () => {
    // Guards against a future template change that embeds `\n` (e.g.
    // appending a "try running … manually" hint). AC 18 explicitly
    // pins "one line".
    expect(formatLinearWarning("ENG-1")).not.toContain("\n");
  });

  test("ENG-5044 (S-2 / AC 18): detail present → rendered inline in parens", () => {
    // S-2 stderr-propagation shape: when the failure carries a hint
    // (first line of `plan` stderr), the warning folds it into
    // `(detail)` between the id and the semicolon clause. Pinned
    // template so the decorator's warning and subprocess-level
    // integration assertions share one format.
    expect(formatLinearWarning("ENG-5044", "rate limited")).toBe(
      "Warning: plan show ENG-5044 failed (rate limited); linear context skipped",
    );
  });

  test("ENG-5044 (S-2 / AC 18): empty detail → rendered as if omitted", () => {
    // Defensive: a caller that accidentally passes `""` shouldn't
    // produce `failed (); linear context skipped`. Treat empty as
    // absent.
    expect(formatLinearWarning("ENG-5044", "")).toBe(
      "Warning: plan show ENG-5044 failed; linear context skipped",
    );
  });

  test("ENG-5044 (S-2 / AC 18): detail with embedded newline → collapsed to a space (single-line invariant)", () => {
    // Belt-and-suspenders: `fetchFailure` already takes the first
    // line of stderr, so this shouldn't fire in practice — but the
    // formatter defends the AC-18 one-line invariant regardless.
    const withNewline = formatLinearWarning("ENG-1", "line1\nline2");
    expect(withNewline).not.toContain("\n");
    expect(withNewline).toContain("line1 line2");
  });
});
