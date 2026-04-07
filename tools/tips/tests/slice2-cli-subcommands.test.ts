import { describe, test, expect } from "bun:test";
import {
  filterByTag,
  searchTips,
  findByRef,
  formatTipList,
  allTags,
  parseTipFrontmatter,
} from "../src/core";
import { stripAnsi, runCli } from "./helpers";

/**
 * Tests for Slice 2: CLI subcommands — list, show, search, topic filter, empty states.
 *
 * Part of: ENG-4580
 */

// ---------------------------------------------------------------------------
// Fixture tips for deterministic testing
// ---------------------------------------------------------------------------

const TIP_SPOTLIGHT = `---
title: Query local traces from terminal
handle: spotlight-traces
tags: [debugging, sentry, performance]
context: When investigating slow requests or errors locally
---

\`spotlight-dev traces --slow\` shows slow spans without opening a browser.
Add \`--transaction /api/v1/chat\` to filter by route.
`;

const TIP_SESSION = `---
title: Browse past sessions interactively
handle: session-find
tags: [sessions, browsing, fzf]
context: When you need to find a previous conversation or see what happened earlier
---

\`session find\` opens an interactive fzf browser of all past Claude sessions.
Use \`--since 7d\` to narrow to recent sessions, or \`--all-projects\` to search everywhere.
`;

const TIP_DAYBOOK = `---
title: Daily cross-reference digest
handle: daybook
tags: [daily, digest, sessions, git]
---

\`daybook\` generates yesterday's cross-reference digest: sessions, commits,
Linear issues, and PRs all in one view. Great for morning catch-up or
writing standups.

Run \`daybook --since 3d\` to look further back.
`;

// =============================================================================
// Core: parseTipFrontmatter — numeric handle rejection
// =============================================================================

describe("core: parseTipFrontmatter rejects numeric handles", () => {
  test("ENG-4580: returns null for purely numeric handle", () => {
    const content = `---
title: Some tip
handle: 42
tags: [testing]
---

Body content here.
`;
    expect(parseTipFrontmatter(content)).toBeNull();
  });

  test("ENG-4580: accepts handle that contains digits but is not purely numeric", () => {
    const content = `---
title: Some tip
handle: tip-42
tags: [testing]
---

Body content here.
`;
    const tip = parseTipFrontmatter(content);
    expect(tip).not.toBeNull();
    expect(tip!.handle).toBe("tip-42");
  });
});

// =============================================================================
// Core functions — new for Slice 2
// =============================================================================

describe("core: filterByTag", () => {
  const tips = [
    parseTipFrontmatter(TIP_SPOTLIGHT)!,
    parseTipFrontmatter(TIP_SESSION)!,
    parseTipFrontmatter(TIP_DAYBOOK)!,
  ];

  test("ENG-4580: filters tips by matching tag", () => {
    const matches = filterByTag(tips, "debugging");

    expect(matches).toHaveLength(1);
    expect(matches[0]!.handle).toBe("spotlight-traces");
  });

  test("ENG-4580: tag matching is case-insensitive", () => {
    const matches = filterByTag(tips, "DEBUGGING");

    expect(matches).toHaveLength(1);
    expect(matches[0]!.handle).toBe("spotlight-traces");
  });

  test("ENG-4580: returns multiple tips when tag matches several", () => {
    const matches = filterByTag(tips, "sessions");

    expect(matches).toHaveLength(2);
    const handles = matches.map((t) => t.handle).sort();
    expect(handles).toEqual(["daybook", "session-find"]);
  });

  test("ENG-4580: returns empty array when no tag matches", () => {
    const matches = filterByTag(tips, "nonexistent-tag");

    expect(matches).toHaveLength(0);
  });
});

describe("core: searchTips", () => {
  const tips = [
    parseTipFrontmatter(TIP_SPOTLIGHT)!,
    parseTipFrontmatter(TIP_SESSION)!,
    parseTipFrontmatter(TIP_DAYBOOK)!,
  ];

  test("ENG-4580: finds tip by title match", () => {
    const matches = searchTips(tips, "traces");

    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((t) => t.handle === "spotlight-traces")).toBe(true);
  });

  test("ENG-4580: finds tip by tag match", () => {
    const matches = searchTips(tips, "fzf");

    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((t) => t.handle === "session-find")).toBe(true);
  });

  test("ENG-4580: finds tip by body content match", () => {
    const matches = searchTips(tips, "daybook --since 3d");

    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((t) => t.handle === "daybook")).toBe(true);
  });

  test("ENG-4580: search is case-insensitive", () => {
    const matches = searchTips(tips, "SPOTLIGHT-DEV");

    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((t) => t.handle === "spotlight-traces")).toBe(true);
  });

  test("ENG-4580: returns empty array when nothing matches", () => {
    const matches = searchTips(tips, "xyzzy-nothing-matches-this");

    expect(matches).toHaveLength(0);
  });
});

describe("core: findByRef", () => {
  const tips = [
    parseTipFrontmatter(TIP_SPOTLIGHT)!,
    parseTipFrontmatter(TIP_SESSION)!,
    parseTipFrontmatter(TIP_DAYBOOK)!,
  ];

  test("ENG-4580: finds tip by handle", () => {
    const tip = findByRef(tips, "daybook");

    expect(tip).toBeDefined();
    expect(tip!.handle).toBe("daybook");
  });

  test("ENG-4580: finds tip by 1-indexed number", () => {
    const tip = findByRef(tips, "2");

    expect(tip).toBeDefined();
    expect(tip!.handle).toBe("session-find");
  });

  test("ENG-4580: returns undefined for unknown handle", () => {
    const tip = findByRef(tips, "nonexistent-handle");

    expect(tip).toBeUndefined();
  });

  test("ENG-4580: returns undefined for out-of-range number", () => {
    const tip = findByRef(tips, "99");

    expect(tip).toBeUndefined();
  });

  test("ENG-4580: returns undefined for zero", () => {
    const tip = findByRef(tips, "0");

    expect(tip).toBeUndefined();
  });
});

// =============================================================================
// CLI: tip list
// =============================================================================

describe("CLI: tip list", () => {
  test("ENG-4580: shows numbered list of all tips", () => {
    const { stdout, exitCode } = runCli("list");
    const output = stripAnsi(stdout);

    expect(exitCode).toBe(0);
    // Should contain tip titles from seed tips
    expect(output).toContain("Query local traces from terminal");
    expect(output).toContain("Browse past sessions interactively");
    expect(output).toContain("Daily cross-reference digest");
  });

  test("ENG-4580: list output includes tags", () => {
    const { stdout } = runCli("list");
    const output = stripAnsi(stdout);

    // At least some tags should appear
    expect(output).toContain("debugging");
    expect(output).toContain("sessions");
  });

  test("ENG-4580: list output includes context when present", () => {
    const { stdout } = runCli("list");
    const output = stripAnsi(stdout);

    // spotlight-traces has a context field
    expect(output).toContain("When investigating slow requests");
  });

  test("ENG-4580: list output numbers tips", () => {
    const { stdout } = runCli("list");
    const output = stripAnsi(stdout);

    // Should have numbered entries like "1" or " 1"
    expect(output).toMatch(/\d\s+\S/);
    // At least 3 tips exist, so we should see at least "1", "2", "3"
    expect(output).toContain("1");
    expect(output).toContain("2");
    expect(output).toContain("3");
  });
});

// =============================================================================
// CLI: tip show <handle>
// =============================================================================

describe("CLI: tip show <handle>", () => {
  test("ENG-4580: shows full tip for known handle", () => {
    const { stdout, exitCode } = runCli("show", "spotlight-traces");
    const output = stripAnsi(stdout);

    expect(exitCode).toBe(0);
    expect(output).toContain("Query local traces from terminal");
    expect(output).toContain("spotlight-dev traces --slow");
    expect(output).toContain("debugging");
  });

  test("ENG-4580: shows 'not found' message for unknown handle", () => {
    const { stdout, stderr, exitCode } = runCli("show", "nonexistent-tip-handle");
    const combinedOutput = stripAnsi(stdout + stderr);

    // The show subcommand must exist and recognize the handle argument.
    // It should report that this specific handle was not found — not a generic
    // Commander "too many arguments" error from the default action.
    expect(combinedOutput.toLowerCase()).toContain("not found");
    // Should mention the handle the user tried
    expect(combinedOutput).toContain("nonexistent-tip-handle");
    expect(exitCode).not.toBe(0);
  });
});

// =============================================================================
// CLI: tip show <number>
// =============================================================================

describe("CLI: tip show <number>", () => {
  test("ENG-4580: shows tip by list number", () => {
    const { stdout, exitCode } = runCli("show", "1");
    const output = stripAnsi(stdout);

    expect(exitCode).toBe(0);
    // Should display a full tip (has a title and body content)
    expect(output.length).toBeGreaterThan(20);
    // The output should contain at least one tag
    expect(output).toMatch(/\w+/);
  });
});

// =============================================================================
// CLI: tip search <term>
// =============================================================================

describe("CLI: tip search", () => {
  test("ENG-4580: search matching title finds the tip", () => {
    const { stdout, exitCode } = runCli("search", "traces");
    const output = stripAnsi(stdout);

    expect(exitCode).toBe(0);
    expect(output).toContain("spotlight-traces");
  });

  test("ENG-4580: search matching tag finds the tip", () => {
    const { stdout, exitCode } = runCli("search", "fzf");
    const output = stripAnsi(stdout);

    expect(exitCode).toBe(0);
    expect(output).toContain("session-find");
  });

  test("ENG-4580: search matching body content finds the tip", () => {
    const { stdout, exitCode } = runCli("search", "daybook");
    const output = stripAnsi(stdout);

    expect(exitCode).toBe(0);
    expect(output).toContain("daybook");
  });

  test("ENG-4580: search with no matches shows helpful message", () => {
    const { stdout, exitCode } = runCli("search", "xyzzy-absolutely-nothing");
    const output = stripAnsi(stdout);

    expect(exitCode).toBe(0);
    // Should show a helpful "no results" message, not crash
    expect(output.toLowerCase()).toMatch(/no\s+(tips?|results?|match)/);
  });
});

// =============================================================================
// CLI: tip <topic> — filter by tag
// =============================================================================

describe("CLI: tip <topic>", () => {
  test("ENG-4580: known tag shows a matching tip with that tag", () => {
    const { stdout, exitCode } = runCli("debugging");
    const output = stripAnsi(stdout);

    expect(exitCode).toBe(0);
    // The shown tip should actually have the "debugging" tag
    // spotlight-traces is the only tip tagged "debugging" in seeds
    expect(output).toContain("spotlight-dev traces");
  });

  test("ENG-4580: unknown tag shows helpful message with available tags", () => {
    const { stdout, exitCode } = runCli("nonexistent-topic");
    const output = stripAnsi(stdout);

    expect(exitCode).toBe(0);
    // Should mention that no tips were found for this topic
    expect(output.toLowerCase()).toContain("nonexistent-topic");
    // Should suggest using tip list or show available tags
    expect(output.toLowerCase()).toMatch(/tip list|available|try/);
  });
});

// =============================================================================
// Core: formatTipList (new formatter for list output)
// =============================================================================

describe("core: formatTipList", () => {
  const tips = [
    parseTipFrontmatter(TIP_SPOTLIGHT)!,
    parseTipFrontmatter(TIP_SESSION)!,
    parseTipFrontmatter(TIP_DAYBOOK)!,
  ];

  test("ENG-4580: formats tips as numbered list", () => {
    const output = stripAnsi(formatTipList(tips));

    // Should contain numbering
    expect(output).toContain("1");
    expect(output).toContain("2");
    expect(output).toContain("3");
    // Should contain titles
    expect(output).toContain("Query local traces from terminal");
    expect(output).toContain("Browse past sessions interactively");
    expect(output).toContain("Daily cross-reference digest");
  });

  test("ENG-4580: includes tags in list output", () => {
    const output = stripAnsi(formatTipList(tips));

    expect(output).toContain("debugging");
    expect(output).toContain("fzf");
    expect(output).toContain("daily");
  });

  test("ENG-4580: includes context when present", () => {
    const output = stripAnsi(formatTipList(tips));

    expect(output).toContain("When investigating slow requests");
    expect(output).toContain("When you need to find a previous conversation");
  });
});

// =============================================================================
// Core: allTags (collect unique tags for empty-state help)
// =============================================================================

describe("core: allTags", () => {
  const tips = [
    parseTipFrontmatter(TIP_SPOTLIGHT)!,
    parseTipFrontmatter(TIP_SESSION)!,
    parseTipFrontmatter(TIP_DAYBOOK)!,
  ];

  test("ENG-4580: collects all unique tags sorted", () => {
    const tags = allTags(tips);

    // Should be sorted and unique
    expect(tags).toEqual([...new Set(tags)].sort());
    // Should contain known tags
    expect(tags).toContain("debugging");
    expect(tags).toContain("sessions");
    expect(tags).toContain("fzf");
    expect(tags).toContain("daily");
  });

  test("ENG-4580: returns empty array for empty tip list", () => {
    const tags = allTags([]);

    expect(tags).toEqual([]);
  });
});
