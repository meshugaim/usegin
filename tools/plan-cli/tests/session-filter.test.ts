import { describe, test, expect } from "bun:test";
import { $ } from "bun";
import { attachMeta } from "../src/lib/plan-meta";
import type { PlanMeta } from "../src/lib/plan-meta";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

/**
 * Lazy-load the filterBySession function that doesn't exist yet.
 * This forces the import error to surface inside test.failing assertions.
 */
async function getFilterBySession(): Promise<
  <T extends { description: string }>(issues: T[], sessionQuery: string) => T[]
> {
  const mod = await import("../src/lib/session-filter");
  return (mod as any).filterBySession;
}

/**
 * Build a realistic issue description with a plan:meta block containing
 * the given sessions array.
 */
function issueWithSessions(
  body: string,
  sessions: string[],
  extraMeta: Partial<PlanMeta> = {},
): { description: string } {
  const meta: PlanMeta = {
    created_by_session: sessions[0] ?? "unknown",
    created_by_actor: "claude:test1234",
    created_at: "2026-04-01T10:00:00.000Z",
    last_session: sessions[sessions.length - 1] ?? "unknown",
    last_actor: "claude:test1234",
    updated_at: "2026-04-01T14:00:00.000Z",
    sessions,
    ...extraMeta,
  };
  return { description: attachMeta(body, meta) };
}

/**
 * Build an issue description with NO plan:meta block at all.
 */
function issueWithoutMeta(body: string): { description: string } {
  return { description: body };
}

// ===========================================================================
// ENG-4390: filterBySession — unit tests
// ===========================================================================

describe("filterBySession", () => {
  // -------------------------------------------------------------------------
  // 1. Exact match
  // -------------------------------------------------------------------------
  test.failing(
    "ENG-4390: exact match — filters to issues whose meta.sessions contains the full session ID",
    async () => {
      const filterBySession = await getFilterBySession();

      const targetSession = "a4c28f13-1111-2222-3333-444444444444";
      const otherSession = "bbbb0000-5555-6666-7777-888888888888";

      const issues = [
        issueWithSessions("Issue touched by target session", [targetSession]),
        issueWithSessions("Issue touched by other session", [otherSession]),
        issueWithSessions("Issue touched by both", [otherSession, targetSession]),
      ];

      const result = filterBySession(issues, targetSession);

      expect(result).toHaveLength(2);
      expect(result[0].description).toContain("Issue touched by target session");
      expect(result[1].description).toContain("Issue touched by both");
    },
  );

  // -------------------------------------------------------------------------
  // 2. Prefix match (8+ chars)
  // -------------------------------------------------------------------------
  test.failing(
    "ENG-4390: prefix match — short prefix (8+ chars) matches via startsWith on sessions entries",
    async () => {
      const filterBySession = await getFilterBySession();

      const fullSession = "a4c28f13-1111-2222-3333-444444444444";
      const shortPrefix = "a4c28f13"; // first 8 chars

      const issues = [
        issueWithSessions("Matched issue", [fullSession]),
        issueWithSessions("Unmatched issue", ["bbbb0000-5555-6666-7777-888888888888"]),
      ];

      const result = filterBySession(issues, shortPrefix);

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain("Matched issue");
    },
  );

  // -------------------------------------------------------------------------
  // 3. False positive rejection
  // -------------------------------------------------------------------------
  test.failing(
    "ENG-4390: false positive rejection — session ID mentioned in prose but NOT in meta.sessions is filtered out",
    async () => {
      const filterBySession = await getFilterBySession();

      const targetSession = "a4c28f13-1111-2222-3333-444444444444";
      const differentSession = "cccc9999-aaaa-bbbb-cccc-dddddddddddd";

      // This issue mentions the target session in its prose description but
      // its meta.sessions array contains a DIFFERENT session.
      const falsePositive = issueWithSessions(
        `Investigating session a4c28f13-1111-2222-3333-444444444444 for debugging`,
        [differentSession],
      );

      // This issue actually has the target session in its meta.sessions.
      const truePositive = issueWithSessions("Real match", [targetSession]);

      const result = filterBySession([falsePositive, truePositive], targetSession);

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain("Real match");
    },
  );

  // -------------------------------------------------------------------------
  // 4. No meta block
  // -------------------------------------------------------------------------
  test.failing(
    "ENG-4390: no meta block — issue without <!-- plan:meta --> is filtered out",
    async () => {
      const filterBySession = await getFilterBySession();

      const targetSession = "a4c28f13-1111-2222-3333-444444444444";

      const issues = [
        issueWithoutMeta("An old issue with no metadata at all"),
        issueWithSessions("Has the session", [targetSession]),
      ];

      const result = filterBySession(issues, targetSession);

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain("Has the session");
    },
  );

  // -------------------------------------------------------------------------
  // 5. Empty sessions array
  // -------------------------------------------------------------------------
  test.failing(
    "ENG-4390: empty sessions — issue with meta but empty sessions array is filtered out",
    async () => {
      const filterBySession = await getFilterBySession();

      const targetSession = "a4c28f13-1111-2222-3333-444444444444";

      // Build an issue with meta that has an empty sessions array.
      // We construct this manually since issueWithSessions would set sessions.
      const emptySessionsIssue = {
        description: attachMeta("Issue with empty sessions", {
          created_by_session: "unknown",
          created_by_actor: "claude:test1234",
          created_at: "2026-04-01T10:00:00.000Z",
          last_session: "unknown",
          last_actor: "claude:test1234",
          updated_at: "2026-04-01T14:00:00.000Z",
          sessions: [],
        }),
      };

      const matchingIssue = issueWithSessions("Has the session", [targetSession]);

      const result = filterBySession([emptySessionsIssue, matchingIssue], targetSession);

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain("Has the session");
    },
  );

  // -------------------------------------------------------------------------
  // 6. Multiple matches
  // -------------------------------------------------------------------------
  test.failing(
    "ENG-4390: multiple matches — all matching issues are returned",
    async () => {
      const filterBySession = await getFilterBySession();

      const targetSession = "a4c28f13-1111-2222-3333-444444444444";

      const issues = [
        issueWithSessions("First matching issue", [targetSession]),
        issueWithSessions("Non-matching issue", ["bbbb0000-5555-6666-7777-888888888888"]),
        issueWithSessions("Second matching issue", [targetSession, "cccc1111-2222-3333-4444-555555555555"]),
        issueWithSessions("Third matching issue", ["dddd2222-3333-4444-5555-666666666666", targetSession]),
      ];

      const result = filterBySession(issues, targetSession);

      // filterBySession is a pure filter — it preserves input order.
      expect(result).toHaveLength(3);
      expect(result[0].description).toContain("First matching issue");
      expect(result[1].description).toContain("Second matching issue");
      expect(result[2].description).toContain("Third matching issue");
    },
  );

  // -------------------------------------------------------------------------
  // 7. Prefix ambiguity — same 8-char prefix, different sessions
  // -------------------------------------------------------------------------
  test.failing(
    "ENG-4390: prefix ambiguity — two sessions sharing the same 8-char prefix both match",
    async () => {
      const filterBySession = await getFilterBySession();

      const sessionA = "a4c28f13-AAAA-1111-2222-333333333333";
      const sessionB = "a4c28f13-BBBB-4444-5555-666666666666";
      const sharedPrefix = "a4c28f13"; // first 8 chars, shared by both

      const issues = [
        issueWithSessions("Issue from session A", [sessionA]),
        issueWithSessions("Issue from session B", [sessionB]),
        issueWithSessions("Issue from unrelated session", ["deadbeef-0000-1111-2222-333333333333"]),
      ];

      // Prefix match is a convenience that can return multiple sessions.
      const result = filterBySession(issues, sharedPrefix);

      expect(result).toHaveLength(2);
      expect(result[0].description).toContain("Issue from session A");
      expect(result[1].description).toContain("Issue from session B");
    },
  );

  // -------------------------------------------------------------------------
  // 8. Short prefix rejection — fewer than 8 chars returns empty
  // -------------------------------------------------------------------------
  test.failing(
    "ENG-4390: short prefix rejection — prefix shorter than 8 chars returns empty results",
    async () => {
      const filterBySession = await getFilterBySession();

      const fullSession = "a4c28f13-1111-2222-3333-444444444444";
      const tooShortPrefix = "a4c2"; // only 4 chars — below the 8-char minimum

      const issues = [
        issueWithSessions("Should not match with short prefix", [fullSession]),
      ];

      // Design intent: 8+ chars are needed for meaningful prefix matching.
      const result = filterBySession(issues, tooShortPrefix);

      expect(result).toHaveLength(0);
    },
  );

  // -------------------------------------------------------------------------
  // 9. Null/undefined description — does not throw
  // -------------------------------------------------------------------------
  test.failing(
    "ENG-4390: null/undefined description — issues with missing descriptions are skipped, not thrown",
    async () => {
      const filterBySession = await getFilterBySession();

      const targetSession = "a4c28f13-1111-2222-3333-444444444444";

      const issues = [
        { description: null as unknown as string },
        { description: undefined as unknown as string },
        issueWithSessions("Valid issue with session", [targetSession]),
        { description: null as unknown as string },
      ];

      // Should not throw — null/undefined descriptions are skipped gracefully.
      const result = filterBySession(issues, targetSession);

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain("Valid issue with session");
    },
  );
});

// ===========================================================================
// ENG-4390: CLI --session option exists in `plan list --help`
// ===========================================================================

describe("plan list --session CLI option", () => {
  test.failing(
    "ENG-4390: --session appears in plan list --help output",
    async () => {
      const result = await $`bun ${CLI_PATH} list --help`.text();

      expect(result).toContain("--session");
    },
  );
});
