/**
 * Tests for incremental read support (--since-turn, --last)
 *
 * These test the turn slicing logic and position header formatting
 * as pure functions, independent of CLI I/O.
 */

import { describe, it, expect } from "bun:test";
import {
  makeSession,
  userTurn,
  assistantTurn,
} from "./testing";
import { sliceTurns, formatPositionHeader } from "./incremental";

/**
 * Helper to create a 10-turn session (alternating user/assistant, turns 0-9)
 */
function makeTenTurnSession() {
  return makeSession({
    turns: [
      userTurn("u0", "Message 0"),
      assistantTurn("a0", "Response 0"),
      userTurn("u1", "Message 1"),
      assistantTurn("a1", "Response 1"),
      userTurn("u2", "Message 2"),
      assistantTurn("a2", "Response 2"),
      userTurn("u3", "Message 3"),
      assistantTurn("a3", "Response 3"),
      userTurn("u4", "Message 4"),
      assistantTurn("a4", "Response 4"),
    ],
  });
}

describe("sliceTurns", () => {
  describe("--since-turn", () => {
    it("returns turns from index N onward", () => {
      const session = makeTenTurnSession();
      const result = sliceTurns(session.turns, { sinceTurn: 5 });
      expect(result.turns).toHaveLength(5);
      expect(result.turns[0]).toBe(session.turns[5]);
      expect(result.turns[4]).toBe(session.turns[9]);
      expect(result.windowStart).toBe(5);
      expect(result.totalTurns).toBe(10);
    });

    it("returns all turns when sinceTurn is 0 (no-op)", () => {
      const session = makeTenTurnSession();
      const result = sliceTurns(session.turns, { sinceTurn: 0 });
      expect(result.turns).toHaveLength(10);
      expect(result.windowStart).toBe(0);
      expect(result.totalTurns).toBe(10);
    });

    it("returns empty when sinceTurn is beyond total", () => {
      const session = makeTenTurnSession();
      const result = sliceTurns(session.turns, { sinceTurn: 15 });
      expect(result.turns).toHaveLength(0);
      expect(result.windowStart).toBe(15);
      expect(result.totalTurns).toBe(10);
    });
  });

  describe("--last", () => {
    it("returns the last N turns", () => {
      const session = makeTenTurnSession();
      const result = sliceTurns(session.turns, { last: 3 });
      expect(result.turns).toHaveLength(3);
      expect(result.turns[0]).toBe(session.turns[7]);
      expect(result.turns[2]).toBe(session.turns[9]);
      expect(result.windowStart).toBe(7);
      expect(result.totalTurns).toBe(10);
    });

    it("returns all turns when last is larger than total", () => {
      const session = makeTenTurnSession();
      const result = sliceTurns(session.turns, { last: 20 });
      expect(result.turns).toHaveLength(10);
      expect(result.windowStart).toBe(0);
      expect(result.totalTurns).toBe(10);
    });
  });

  describe("no windowing", () => {
    it("returns all turns when neither flag is set", () => {
      const session = makeTenTurnSession();
      const result = sliceTurns(session.turns, {});
      expect(result.turns).toHaveLength(10);
      expect(result.windowStart).toBe(0);
      expect(result.totalTurns).toBe(10);
    });
  });
});

describe("formatPositionHeader", () => {
  it("shows correct range for --since-turn 5 on 10 turns", () => {
    const header = formatPositionHeader({ windowStart: 5, turnCount: 5, totalTurns: 10 });
    expect(header).toBe("[Showing turns 5\u20139 of 10]");
  });

  it("shows correct range for --last 3 on 10 turns", () => {
    const header = formatPositionHeader({ windowStart: 7, turnCount: 3, totalTurns: 10 });
    expect(header).toBe("[Showing turns 7\u20139 of 10]");
  });

  it("returns null when windowing is not active (windowStart=0, turnCount=totalTurns)", () => {
    const header = formatPositionHeader({ windowStart: 0, turnCount: 10, totalTurns: 10 });
    expect(header).toBeNull();
  });

  it("shows empty range message when no turns in window", () => {
    const header = formatPositionHeader({ windowStart: 15, turnCount: 0, totalTurns: 10 });
    expect(header).toBe("[No turns in range (total: 10)]");
  });
});
