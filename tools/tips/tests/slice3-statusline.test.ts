import { describe, test, expect } from "bun:test";
import type { Tip } from "../src/core";
import { parseTipFrontmatter } from "../src/core";
import { runCli } from "./helpers";

/**
 * Tests for Slice 3: `tip statusline` command + dx timing params.
 *
 * Part of: ENG-4581
 *
 * New functions under test (lazy-imported since they don't exist yet):
 *   - parseDuration(input: string): number | null
 *   - resolveStatusline(context: StatuslineContext): StatuslineResult
 */

// ---------------------------------------------------------------------------
// Lazy imports for not-yet-implemented functions
// ---------------------------------------------------------------------------

async function lazyParseDuration(): Promise<
  (input: string) => number | null
> {
  const mod = await import("../src/core");
  return (mod as any).parseDuration;
}

async function lazyResolveStatusline(): Promise<
  (context: StatuslineContext) => StatuslineResult
> {
  const mod = await import("../src/core");
  return (mod as any).resolveStatusline;
}

// ---------------------------------------------------------------------------
// Types for the statusline state machine
// ---------------------------------------------------------------------------

interface StatuslineState {
  state: "showing" | "resting";
  tip_handle: string;
  transitioned_at: number;
}

interface StatuslineContext {
  now: number;
  state: StatuslineState | null;
  tips: Tip[];
  showDuration: number;
  restDuration: number;
  enabled: boolean;
}

interface StatuslineResult {
  output: string;
  newState: StatuslineState;
}

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
  test("ENG-4581: parses minutes — 10m to 600000ms", async () => {
    const parseDuration = await lazyParseDuration();
    expect(parseDuration("10m")).toBe(600_000);
  });

  test("ENG-4581: parses hours — 2h to 7200000ms", async () => {
    const parseDuration = await lazyParseDuration();
    expect(parseDuration("2h")).toBe(7_200_000);
  });

  test("ENG-4581: parses minutes — 30m to 1800000ms", async () => {
    const parseDuration = await lazyParseDuration();
    expect(parseDuration("30m")).toBe(1_800_000);
  });

  test("ENG-4581: returns null for invalid input", async () => {
    const parseDuration = await lazyParseDuration();
    expect(parseDuration("invalid")).toBeNull();
  });

  test("ENG-4581: parses zero minutes — 0m to 0", async () => {
    const parseDuration = await lazyParseDuration();
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
    "ENG-4581: first call (no prior state) returns tip one-liner, state = SHOWING",
    async () => {
      const resolveStatusline = await lazyResolveStatusline();
      const result = resolveStatusline({
        now: NOW,
        state: null,
        tips: ALL_TIPS,
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: true,
      });

      // Should output a non-empty one-liner (the tip title)
      expect(result.output.length).toBeGreaterThan(0);
      // New state should be SHOWING
      expect(result.newState.state).toBe("showing");
      // The tip handle should be one of the available tips
      expect(ALL_TIPS.map((t) => t.handle)).toContain(result.newState.tip_handle);
      // transitioned_at should be now
      expect(result.newState.transitioned_at).toBe(NOW);
    },
  );

  test(
    "ENG-4581: during show window returns same tip",
    async () => {
      const resolveStatusline = await lazyResolveStatusline();
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

      // Should return the same tip's content
      expect(result.output.length).toBeGreaterThan(0);
      expect(result.newState.state).toBe("showing");
      expect(result.newState.tip_handle).toBe("spotlight-traces");
      // transitioned_at should not change (still in the same show window)
      expect(result.newState.transitioned_at).toBe(NOW);
    },
  );

  test(
    "ENG-4581: show window expired transitions to RESTING, returns empty",
    async () => {
      const resolveStatusline = await lazyResolveStatusline();
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

      // Should return empty (resting now)
      expect(result.output).toBe("");
      expect(result.newState.state).toBe("resting");
      expect(result.newState.transitioned_at).toBe(NOW + SHOW_DURATION);
    },
  );

  test(
    "ENG-4581: during rest window returns empty string",
    async () => {
      const resolveStatusline = await lazyResolveStatusline();
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

      expect(result.output).toBe("");
      expect(result.newState.state).toBe("resting");
      expect(result.newState.transitioned_at).toBe(restStart);
    },
  );

  test(
    "ENG-4581: rest window expired transitions to SHOWING with new tip",
    async () => {
      const resolveStatusline = await lazyResolveStatusline();
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
      expect(result.output.length).toBeGreaterThan(0);
      expect(result.newState.state).toBe("showing");
      expect(ALL_TIPS.map((t) => t.handle)).toContain(result.newState.tip_handle);
      expect(result.newState.transitioned_at).toBe(restStart + REST_DURATION);
    },
  );

  test(
    "ENG-4581: disabled returns empty string regardless of state",
    async () => {
      const resolveStatusline = await lazyResolveStatusline();

      // Even with a valid showing state, disabled should return empty
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

      expect(result.output).toBe("");
    },
  );

  test(
    "ENG-4581: empty tips array returns empty string",
    async () => {
      const resolveStatusline = await lazyResolveStatusline();

      const result = resolveStatusline({
        now: NOW,
        state: null,
        tips: [],
        showDuration: SHOW_DURATION,
        restDuration: REST_DURATION,
        enabled: true,
      });

      expect(result.output).toBe("");
    },
  );
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
