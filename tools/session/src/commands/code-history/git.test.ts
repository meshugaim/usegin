/**
 * Unit tests for the git layer of `session code-history`.
 *
 * These exercise `getMostRecentCommit` directly — not through the CLI —
 * so slices 2+ can keep adding git-layer tests alongside feature tests
 * without paying E2E subprocess cost every time.
 *
 * Each test uses `makeFixtureRepo` (shared with the E2E suite) so the
 * shape of "what a real repo looks like" stays consistent between
 * levels of testing.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getMostRecentCommit } from "./git";
import { makeFixtureRepo, type FixtureRepo } from "./__fixtures__/helpers";

describe("getMostRecentCommit (unit)", () => {
  let fixture: FixtureRepo;

  beforeAll(() => {
    fixture = makeFixtureRepo();
  });

  afterAll(() => {
    rmSync(fixture.dir, { recursive: true, force: true });
  });

  test(
    "ENG-5040: happy path — returns a DecoratedCommit for a line that has committed history",
    async () => {
      // Line 2 is touched by every commit in the fixture — the final one
      // should surface as the most recent.
      const commit = await getMostRecentCommit(fixture.file, 2, {
        cwd: fixture.dir,
      });

      expect(commit).not.toBeNull();
      expect(commit!.sha.startsWith(fixture.expectedSha)).toBe(true);
      expect(commit!.sha).toHaveLength(40); // full SHA
      expect(commit!.subject).toBe(fixture.expectedSubject);
      expect(commit!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof commit!.body).toBe("string"); // may be "" but always string
    },
  );

  test(
    "ENG-5040: line with no committed history (uncommitted 4th line) → null",
    async () => {
      // `fixture.uncommittedLine` exists in the working tree but was
      // never committed — git emits `fatal: file X has only N lines`,
      // which we classify as "no history" and return `null`.
      const commit = await getMostRecentCommit(
        fixture.file,
        fixture.uncommittedLine,
        { cwd: fixture.dir },
      );
      expect(commit).toBeNull();
    },
  );

  test(
    "ENG-5040: nonexistent file path in a real repo → null (treated as no history)",
    async () => {
      // Git responds with `fatal: There is no path <file> in the commit`
      // which matches the "no history" classification. (The command layer
      // separately blocks this at upfront validation via `statSync`, so
      // this case doesn't reach the git layer in practice — but the git
      // layer still needs to be total for callers that bypass validation.)
      const commit = await getMostRecentCommit(
        "src/definitely-not-there.ts",
        1,
        { cwd: fixture.dir },
      );
      expect(commit).toBeNull();
    },
  );

  test(
    "ENG-5040: running outside a git repo → throws with a clear message",
    async () => {
      // This is the Issue-1 regression: previously, any nonzero git exit
      // was silently classified as "no history" → null. That misled the
      // user when git actually failed (e.g. not a repo). Now: throws.
      const noRepoDir = mkdtempSync(join(tmpdir(), "code-history-git-unit-"));
      try {
        // Create a real file so we exercise the git-layer failure path
        // (not "file doesn't exist", which isn't this layer's concern).
        writeFileSync(join(noRepoDir, "target.ts"), "a\nb\n");

        await expect(
          getMostRecentCommit("target.ts", 1, { cwd: noRepoDir }),
        ).rejects.toThrow(/git log failed|not a git repository/i);
      } finally {
        rmSync(noRepoDir, { recursive: true, force: true });
      }
    },
  );

  test(
    "ENG-5040: respects the `cwd` option (doesn't rely on process.cwd)",
    async () => {
      // Actually verify cwd-switching: point `cwd` at a directory that is
      // NOT a git repo, and confirm the git layer throws (rather than
      // silently running in `process.cwd()`, which — since the test runner
      // itself lives inside this monorepo — is a real repo and would
      // falsely succeed). This is the only test that pins the `cwd` option
      // as load-bearing; every other test passes `cwd: fixture.dir`
      // implicitly exercising the happy path.
      const foreignCwd = mkdtempSync(join(tmpdir(), "code-history-foreign-"));
      try {
        writeFileSync(join(foreignCwd, "target.ts"), "a\nb\n");
        await expect(
          getMostRecentCommit("target.ts", 1, { cwd: foreignCwd }),
        ).rejects.toThrow(/git log failed|not a git repository/i);
      } finally {
        rmSync(foreignCwd, { recursive: true, force: true });
      }
    },
  );
});
