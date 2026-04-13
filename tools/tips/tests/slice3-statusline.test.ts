import { describe, test, expect } from "bun:test";
import {
  parseTipFrontmatter,
  parseDuration,
  resolveStatusline,
  formatTipStatusline,
} from "../src/core";
import type { Tip, StatuslineState } from "../src/core";
import { runCli } from "./helpers";

// Strip ANSI escape codes for assertions on formatted output.
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

/**
 * Tests for Slice 3: `tip statusline` command + dx timing params.
 *
 * Part of: ENG-4581
 */

// ---------------------------------------------------------------------------
// Fixture tips for deterministic testing
// ---------------------------------------------------------------------------

const TIP_SPOTLIGHT = parseTipFrontmatter(`---
title: Query local traces from terminal
handle: spotlight-traces
tags: [debugging, sentry, performance]
context: When investigating slow requests or errors locally
---

\`spotlight-dev traces --slow\` shows slow spans without opening a browser.
Add \`--transaction /api/v1/chat\` to filter by route.
`)!;

const TIP_SESSION = parseTipFrontmatter(`---
title: Browse past sessions interactively
handle: session-find
tags: [sessions, browsing, fzf]
context: When you need to find a previous conversation
---

\`session find\` opens an interactive fzf browser of all past Claude sessions.
`)!;

const TIP_DAYBOOK = parseTipFrontmatter(`---
title: Daily cross-reference digest
handle: daybook
tags: [daily, digest, sessions, git]
---

\`daybook\` generates yesterday's cross-reference digest.
`)!;

const ALL_TIPS: Tip[] = [TIP_SPOTLIGHT, TIP_SESSION, TIP_DAYBOOK];

// =============================================================================
// parseDuration
// =============================================================================

describe("parseDuration", () => {
  test("ENG-4581: parses minutes — 10m to 600000ms", () => {
    expect(parseDuration("10m")).toBe(600_000);
  });

  test("ENG-4581: parses hours — 2h to 7200000ms", () => {
    expect(parseDuration("2h")).toBe(7_200_000);
  });

  test("ENG-4581: parses minutes — 30m to 1800000ms", () => {
    expect(parseDuration("30m")).toBe(1_800_000);
  });

  test("ENG-4581: returns null for invalid input", () => {
    expect(parseDuration("invalid")).toBeNull();
  });

  test("ENG-4581: parses zero minutes — 0m to 0", () => {
    expect(parseDuration("0m")).toBe(0);
  });
});

// =============================================================================
// resolveStatusline — state machine
// =============================================================================

describe("resolveStatusline", () => {
  const NOW = 1_700_000_000_000; // arbitrary fixed epoch ms
  const SHOW_DURATION = 600_000; // 10m
  const REST_DURATION = 7_200_000; // 2h

  test(
    "ENG-4581: first call (no prior state) returns a tip, state = SHOWING",
    () => {
      const result = resolveStatusline({
        now: NOW,
        state: null,
        tips: ALL_TIPS,
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: true,
      });

      // Should return a non-null tip from the pool
      expect(result.tip).not.toBeNull();
      expect(ALL_TIPS.map((t) => t.handle)).toContain(result.tip!.handle);
      // New state should be SHOWING
      expect(result.newState.state).toBe("showing");
      // The tip handle in state should match the returned tip
      expect(result.newState.tip_handle).toBe(result.tip!.handle);
      // transitioned_at should be now
      expect(result.newState.transitioned_at).toBe(NOW);
    },
  );

  test(
    "ENG-4581: during show window returns same tip",
    () => {
      const currentState: StatuslineState = {
        state: "showing",
        tip_handle: "spotlight-traces",
        transitioned_at: NOW,
      };

      // 5 minutes into the 10-minute show window
      const result = resolveStatusline({
        now: NOW + 300_000,
        state: currentState,
        tips: ALL_TIPS,
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: true,
      });

      // Should return the same tip
      expect(result.tip).not.toBeNull();
      expect(result.tip!.handle).toBe("spotlight-traces");
      expect(result.newState.state).toBe("showing");
      expect(result.newState.tip_handle).toBe("spotlight-traces");
      // transitioned_at should not change (still in the same show window)
      expect(result.newState.transitioned_at).toBe(NOW);
    },
  );

  test(
    "ENG-4581: show window expired transitions to RESTING, returns null tip",
    () => {
      const currentState: StatuslineState = {
        state: "showing",
        tip_handle: "spotlight-traces",
        transitioned_at: NOW,
      };

      // Exactly at the show duration boundary
      const result = resolveStatusline({
        now: NOW + SHOW_DURATION,
        state: currentState,
        tips: ALL_TIPS,
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: true,
      });

      // Should return null tip (resting now)
      expect(result.tip).toBeNull();
      expect(result.newState.state).toBe("resting");
      expect(result.newState.transitioned_at).toBe(NOW + SHOW_DURATION);
    },
  );

  test(
    "ENG-4581: during rest window returns null tip",
    () => {
      const restStart = NOW;
      const currentState: StatuslineState = {
        state: "resting",
        tip_handle: "spotlight-traces",
        transitioned_at: restStart,
      };

      // 1 hour into the 2-hour rest window
      const result = resolveStatusline({
        now: restStart + 3_600_000,
        state: currentState,
        tips: ALL_TIPS,
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: true,
      });

      expect(result.tip).toBeNull();
      expect(result.newState.state).toBe("resting");
      expect(result.newState.transitioned_at).toBe(restStart);
    },
  );

  test(
    "ENG-4581: rest window expired transitions to SHOWING with new tip",
    () => {
      const restStart = NOW;
      const currentState: StatuslineState = {
        state: "resting",
        tip_handle: "spotlight-traces",
        transitioned_at: restStart,
      };

      // Exactly at the rest duration boundary
      const result = resolveStatusline({
        now: restStart + REST_DURATION,
        state: currentState,
        tips: ALL_TIPS,
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: true,
      });

      // Should be showing a tip again
      expect(result.tip).not.toBeNull();
      expect(ALL_TIPS.map((t) => t.handle)).toContain(result.tip!.handle);
      expect(result.newState.state).toBe("showing");
      expect(result.newState.tip_handle).toBe(result.tip!.handle);
      expect(result.newState.transitioned_at).toBe(restStart + REST_DURATION);
    },
  );

  test(
    "ENG-4581: disabled returns null tip regardless of state",
    () => {
      // Even with a valid showing state, disabled should return null
      const result = resolveStatusline({
        now: NOW,
        state: {
          state: "showing",
          tip_handle: "spotlight-traces",
          transitioned_at: NOW,
        },
        tips: ALL_TIPS,
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: false,
      });

      expect(result.tip).toBeNull();
    },
  );

  test(
    "ENG-4581: empty tips array returns null tip",
    () => {
      const result = resolveStatusline({
        now: NOW,
        state: null,
        tips: [],
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: true,
      });

      expect(result.tip).toBeNull();
    },
  );

  test(
    "ENG-4894: showing state with a deleted tip handle returns null tip",
    () => {
      // If the tip referenced by state was deleted from disk since last run,
      // the resolver should gracefully return null rather than crashing.
      const currentState: StatuslineState = {
        state: "showing",
        tip_handle: "tip-that-no-longer-exists",
        transitioned_at: NOW,
      };

      const result = resolveStatusline({
        now: NOW + 60_000,
        state: currentState,
        tips: ALL_TIPS,
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: true,
      });

      expect(result.tip).toBeNull();
      // State unchanged — we're still within the show window
      expect(result.newState).toEqual(currentState);
    },
  );
});

// =============================================================================
// formatTipStatusline — the dedicated second-row renderer
// =============================================================================

describe("formatTipStatusline", () => {
  test("ENG-4894: includes 💡 emoji, title, context, and 'tip show <handle>'", () => {
    const line = stripAnsi(formatTipStatusline(TIP_SPOTLIGHT));

    expect(line.startsWith("💡 ")).toBe(true);
    expect(line).toContain("Query local traces from terminal");
    expect(line).toContain("When investigating slow requests or errors locally");
    expect(line).toContain("tip show spotlight-traces");
  });

  test("ENG-4894: separates segments with ' · '", () => {
    const line = stripAnsi(formatTipStatusline(TIP_SPOTLIGHT));
    // title · context · command → at least two separators
    const separators = line.split(" · ").length - 1;
    expect(separators).toBeGreaterThanOrEqual(2);
  });

  test("ENG-4894: omits context segment when tip has no context", () => {
    // TIP_DAYBOOK has no context field
    expect(TIP_DAYBOOK.context).toBeUndefined();
    const line = stripAnsi(formatTipStatusline(TIP_DAYBOOK));

    expect(line).toContain("Daily cross-reference digest");
    expect(line).toContain("tip show daybook");
    // Only one separator: title · command
    const separators = line.split(" · ").length - 1;
    expect(separators).toBe(1);
  });

  test("ENG-4894: renders as a single line (no embedded newlines)", () => {
    // The Claude Code status line treats each \n as a new row, so the
    // formatter must produce exactly one line per tip.
    const line = formatTipStatusline(TIP_SPOTLIGHT);
    expect(line).not.toContain("\n");
  });

  test("ENG-4894: 'tip show <handle>' is rendered as inline code (bg color)", () => {
    // The command should pop visually as a copy-paste-able snippet, not blend
    // in with the surrounding dim text. We enforce that by requiring a
    // 256-color background escape (`\x1b[48;5;<n>m`) in the raw output, which
    // distinguishes the command segment from the dim-wrapped context segment.
    const raw = formatTipStatusline(TIP_SPOTLIGHT);
    expect(raw).toMatch(/\x1b\[48;5;\d+/);

    // And the command text itself must still be present after ANSI stripping.
    const stripped = stripAnsi(raw);
    expect(stripped).toContain("tip show spotlight-traces");
  });
});

// =============================================================================
// CLI: tip statusline — smoke test
// =============================================================================

describe("CLI: tip statusline", () => {
  test("ENG-4581: tip statusline exits 0 and returns one-liner or empty", () => {
    const { stdout, stderr, exitCode } = runCli("statusline");

    expect(exitCode).toBe(0);
    // Must NOT be the default-action fallback ("No tips found for" / tag filter).
    // A proper statusline command returns either a one-liner tip or empty string.
    expect(stdout).not.toContain("No tips found for");
    expect(stdout).not.toContain("Available tags:");
    expect(stdout).not.toContain("Try: tip list");
    // Output should be at most one line (the tip one-liner) or empty
    const lines = stdout.trim().split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBeLessThanOrEqual(1);
  });

  test("ENG-4581: tip statusline is not routed to the default topic action", () => {
    // Regression test: ensure Commander routes `statusline` to the statusline
    // subcommand, not the default topic action. The topic action would output
    // either a full multi-line formatted tip or a "No tips found" message.
    const { stdout, stderr, exitCode } = runCli("statusline");

    expect(exitCode).toBe(0);
    // The default topic action includes "Tags:" in its formatted output.
    // The statusline command returns only a bare one-liner (title) or empty.
    expect(stdout).not.toContain("Tags:");
    // Stderr should be clean
    expect(stderr).toBe("");
  });
});
