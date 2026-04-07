import { describe, test, expect, afterEach } from "bun:test";
import { rmSync } from "fs";
import { join } from "path";

/**
 * Tests for the tip system core module and CLI.
 *
 * All tests are marked test.failing because the implementation doesn't
 * exist yet (Red phase of TDD).
 *
 * Part of: ENG-4579
 */

// ---------------------------------------------------------------------------
// Lazy imports — modules don't exist yet, so we defer to test body
// ---------------------------------------------------------------------------

async function getCore() {
  return await import("../src/core");
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

/** Path to the seed tips directory shipped with this tool. */
const SEED_TIPS_DIR = join(import.meta.dir, "..", "tips");

const VALID_TIP_ALL_FIELDS = `---
title: Query local traces from terminal
handle: spotlight-traces
tags: [debugging, sentry, performance]
context: When investigating slow requests or errors locally
---

\`spotlight-dev traces --slow\` shows slow spans without opening a browser.
Add \`--transaction /api/v1/chat\` to filter by route.
`;

const VALID_TIP_REQUIRED_ONLY = `---
title: Daily cross-reference digest
handle: daybook
tags: [daily, digest, sessions, git]
---

\`daybook\` generates yesterday's cross-reference digest.
`;

const INVALID_TIP_MISSING_HANDLE = `---
title: A tip without a handle
tags: [oops]
---

This tip is missing the required handle field.
`;

const INVALID_TIP_EMPTY_TAGS = `---
title: A tip with empty tags
handle: empty-tags
tags: []
---

This tip has an empty tags array.
`;

const INVALID_TIP_MISSING_TITLE = `---
handle: no-title
tags: [oops]
---

This tip has no title field.
`;

const INVALID_TIP_MISSING_TAGS = `---
title: A tip without tags
handle: no-tags
---

This tip is missing the tags field entirely.
`;

// =============================================================================
// parseTipFrontmatter
// =============================================================================

describe("parseTipFrontmatter", () => {
  test.failing(
    "ENG-4579: parses valid tip with all fields",
    async () => {
      const { parseTipFrontmatter } = await getCore();

      const tip = parseTipFrontmatter(VALID_TIP_ALL_FIELDS);

      expect(tip).not.toBeNull();
      expect(tip!.title).toBe("Query local traces from terminal");
      expect(tip!.handle).toBe("spotlight-traces");
      expect(tip!.tags).toEqual(["debugging", "sentry", "performance"]);
      expect(tip!.context).toBe(
        "When investigating slow requests or errors locally",
      );
      expect(tip!.body).toContain("spotlight-dev traces --slow");
    },
  );

  test.failing(
    "ENG-4579: parses valid tip with only required fields (no context)",
    async () => {
      const { parseTipFrontmatter } = await getCore();

      const tip = parseTipFrontmatter(VALID_TIP_REQUIRED_ONLY);

      expect(tip).not.toBeNull();
      expect(tip!.title).toBe("Daily cross-reference digest");
      expect(tip!.handle).toBe("daybook");
      expect(tip!.tags).toEqual(["daily", "digest", "sessions", "git"]);
      expect(tip!.context).toBeUndefined();
      expect(tip!.body).toContain("daybook");
    },
  );

  test.failing(
    "ENG-4579: returns null for tip missing required field (no handle)",
    async () => {
      const { parseTipFrontmatter } = await getCore();

      const tip = parseTipFrontmatter(INVALID_TIP_MISSING_HANDLE);

      expect(tip).toBeNull();
    },
  );

  test.failing(
    "ENG-4579: returns null for tip with empty tags array",
    async () => {
      const { parseTipFrontmatter } = await getCore();

      const tip = parseTipFrontmatter(INVALID_TIP_EMPTY_TAGS);

      expect(tip).toBeNull();
    },
  );

  test.failing(
    "ENG-4579: returns null for tip missing title",
    async () => {
      const { parseTipFrontmatter } = await getCore();

      const tip = parseTipFrontmatter(INVALID_TIP_MISSING_TITLE);

      expect(tip).toBeNull();
    },
  );

  test.failing(
    "ENG-4579: returns null for tip missing tags entirely",
    async () => {
      const { parseTipFrontmatter } = await getCore();

      const tip = parseTipFrontmatter(INVALID_TIP_MISSING_TAGS);

      expect(tip).toBeNull();
    },
  );
});

// =============================================================================
// loadTips
// =============================================================================

describe("loadTips", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true });
      } catch {
        // ignore cleanup errors
      }
    }
    tempDirs.length = 0;
  });

  test.failing(
    "ENG-4579: loads all seed tips from directory",
    async () => {
      const { loadTips } = await getCore();

      const tips = await loadTips(SEED_TIPS_DIR);

      expect(tips.length).toBeGreaterThanOrEqual(3);
      // Verify each tip has the required shape
      for (const tip of tips) {
        expect(tip.title).toBeDefined();
        expect(tip.handle).toBeDefined();
        expect(tip.tags.length).toBeGreaterThan(0);
        expect(tip.body.length).toBeGreaterThan(0);
      }
    },
  );

  test.failing(
    "ENG-4579: returns only valid tips when directory has mix of valid and invalid files",
    async () => {
      const { loadTips } = await getCore();
      const { mkdtempSync, writeFileSync } = await import("fs");
      const { tmpdir } = await import("os");

      // Create a temp dir with one valid and one invalid tip
      const tempDir = mkdtempSync(join(tmpdir(), "tips-test-"));
      tempDirs.push(tempDir);
      writeFileSync(
        join(tempDir, "valid.md"),
        VALID_TIP_ALL_FIELDS,
      );
      writeFileSync(
        join(tempDir, "invalid.md"),
        INVALID_TIP_MISSING_HANDLE,
      );

      const tips = await loadTips(tempDir);

      expect(tips).toHaveLength(1);
      expect(tips[0]!.handle).toBe("spotlight-traces");
    },
  );

  test.failing(
    "ENG-4579: returns empty array for nonexistent directory",
    async () => {
      const { loadTips } = await getCore();

      const tips = await loadTips("/nonexistent/path/that/does/not/exist");

      expect(tips).toEqual([]);
    },
  );

  test.failing(
    "ENG-4579: ignores non-markdown files in tips directory",
    async () => {
      const { loadTips } = await getCore();
      const { mkdtempSync, writeFileSync } = await import("fs");
      const { tmpdir } = await import("os");

      const tempDir = mkdtempSync(join(tmpdir(), "tips-test-"));
      tempDirs.push(tempDir);
      writeFileSync(join(tempDir, "valid.md"), VALID_TIP_ALL_FIELDS);
      writeFileSync(join(tempDir, "notes.txt"), "This is not a tip file");

      const tips = await loadTips(tempDir);

      expect(tips).toHaveLength(1);
      expect(tips[0]!.handle).toBe("spotlight-traces");
    },
  );
});

// =============================================================================
// pickRandom
// =============================================================================

describe("pickRandom", () => {
  test.failing(
    "ENG-4579: returns one of the tips from a non-empty array",
    async () => {
      const { pickRandom, parseTipFrontmatter } = await getCore();

      const tip1 = parseTipFrontmatter(VALID_TIP_ALL_FIELDS)!;
      const tip2 = parseTipFrontmatter(VALID_TIP_REQUIRED_ONLY)!;
      const tips = [tip1, tip2];

      // Call 20 times and verify randomness — at least 2 distinct results
      const handles = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const picked = pickRandom(tips);
        expect(picked).not.toBeNull();
        expect(tips).toContainEqual(picked);
        handles.add(picked!.handle);
      }
      expect(handles.size).toBeGreaterThanOrEqual(2);
    },
  );

  test.failing(
    "ENG-4579: returns null for empty array",
    async () => {
      const { pickRandom } = await getCore();

      const picked = pickRandom([]);

      expect(picked).toBeNull();
    },
  );
});

// =============================================================================
// formatTipForTerminal
// =============================================================================

describe("formatTipForTerminal", () => {
  test.failing(
    "ENG-4579: includes title, body, and tags in output",
    async () => {
      const { formatTipForTerminal, parseTipFrontmatter } = await getCore();

      const tip = parseTipFrontmatter(VALID_TIP_ALL_FIELDS)!;
      const output = formatTipForTerminal(tip);

      // Strip ANSI codes for content assertions
      const stripped = output.replace(
        // eslint-disable-next-line no-control-regex
        /\x1b\[[0-9;]*m/g,
        "",
      );

      expect(stripped).toContain("Query local traces from terminal");
      expect(stripped).toContain("spotlight-dev traces --slow");
      expect(stripped).toContain("debugging");
    },
  );

  test.failing(
    "ENG-4579: includes context when present",
    async () => {
      const { formatTipForTerminal, parseTipFrontmatter } = await getCore();

      const tip = parseTipFrontmatter(VALID_TIP_ALL_FIELDS)!;
      const output = formatTipForTerminal(tip);

      const stripped = output.replace(
        // eslint-disable-next-line no-control-regex
        /\x1b\[[0-9;]*m/g,
        "",
      );

      expect(stripped).toContain(
        "When investigating slow requests or errors locally",
      );
    },
  );
});

// =============================================================================
// CLI smoke test
// =============================================================================

describe("CLI", () => {
  test.failing(
    "ENG-4579: running cli.ts with no args exits 0 and produces output",
    async () => {
      const result = Bun.spawnSync({
        cmd: ["bun", join(import.meta.dir, "..", "src", "cli.ts")],
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(result.exitCode).toBe(0);
      // stdout should have content (a random tip or help text)
      const stdout = result.stdout.toString();
      expect(stdout.length).toBeGreaterThan(0);
      // stderr should not contain errors
      const stderr = result.stderr.toString();
      expect(stderr).not.toContain("Error");
    },
  );
});
