/**
 * Incremental read support for session turns.
 *
 * Provides pure functions for slicing turns by index (--since-turn),
 * by count from the end (--last), or both combined, plus formatting
 * the position header that tells the reader where they are in the full session.
 */

import type { Turn } from "./types";

export interface SliceOptions {
  sinceTurn?: number;
  last?: number;
}

export interface SliceResult {
  turns: Turn[];
  windowStart: number;
  totalTurns: number;
}

/**
 * Slice a session's turns based on --since-turn and/or --last options.
 *
 * - `sinceTurn: N` returns turns from index N onward (0-based)
 * - `last: N` returns the last N turns
 * - Both: starts at sinceTurn, then takes at most N turns
 * - Neither: returns all turns unchanged
 *
 * Returns the sliced turns, the starting index of the window,
 * and the total turn count for position header formatting.
 */
export function sliceTurns(turns: Turn[], options: SliceOptions): SliceResult {
  const totalTurns = turns.length;

  if (options.sinceTurn != null && options.last != null) {
    // Combined: start at sinceTurn, then take at most `last` turns
    const sliced = turns.slice(options.sinceTurn, options.sinceTurn + options.last);
    return {
      turns: sliced,
      windowStart: options.sinceTurn,
      totalTurns,
    };
  }

  if (options.sinceTurn != null) {
    return {
      turns: turns.slice(options.sinceTurn),
      windowStart: options.sinceTurn,
      totalTurns,
    };
  }

  if (options.last != null) {
    const windowStart = Math.max(0, totalTurns - options.last);
    return {
      turns: turns.slice(-options.last),
      windowStart,
      totalTurns,
    };
  }

  return {
    turns,
    windowStart: 0,
    totalTurns,
  };
}

export interface PositionHeaderOptions {
  windowStart: number;
  turnCount: number;
  totalTurns: number;
}

/**
 * Format a position header string for windowed output.
 *
 * Returns null when no windowing is active (all turns shown).
 * Returns a bracketed range string like `[Showing turns 5\u20139 of 10]`
 * or `[No turns in range (total: 10)]` when the window is empty.
 */
export function formatPositionHeader(options: PositionHeaderOptions): string | null {
  const { windowStart, turnCount, totalTurns } = options;

  // No windowing active: start is 0 and we're showing everything
  if (windowStart === 0 && turnCount === totalTurns) {
    return null;
  }

  if (turnCount === 0) {
    return `[No turns in range (total: ${totalTurns})]`;
  }

  const windowEnd = windowStart + turnCount - 1;
  return `[Showing turns ${windowStart}\u2013${windowEnd} of ${totalTurns}]`;
}
