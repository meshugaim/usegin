import { afterAll, describe, expect, test } from "bun:test";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { LinearClient as LinearSDK } from "@linear/sdk";
import { parseMeta, attachMeta, serializeMeta } from "../src/lib/plan-meta";
import type { PlanMeta } from "../src/lib/plan-meta";
import { formatShowHuman, formatShowJson } from "../src/lib/output";
import type { PlanIssueDetail } from "../src/types";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

// Helper to strip ANSI color codes from output for testing
function stripAnsi(str: string): string {
  return str.replace(/\u001B\[[0-9;]*m/g, "");
}

// ---------------------------------------------------------------------------
// Integration test helpers (same pattern as plan-meta-lifecycle.test.ts)
// ---------------------------------------------------------------------------

const createdIdentifiers: string[] = [];

/**
 * Helper: spawn the plan CLI with given args and env overrides.
 * Returns { stdout, stderr, exitCode }.
 */
async function runPlan(
  args: string[],
  envOverrides: Record<string, string | undefined> = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI_PATH, ...args], {
    env: { ...process.env, ...envOverrides },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}

/**
 * Helper: fetch an issue's raw description via the Linear SDK.
 * Uses the SDK directly (not plan show) to get the actual raw description
 * including any meta block, regardless of whether show strips it.
 */
async function fetchRawDescription(identifier: string): Promise<string> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("LINEAR_API_KEY is required");
  const sdk = new LinearSDK({ apiKey });
  const issue = await sdk.issue(identifier);
  return issue.description ?? "";
}

afterAll(async () => {
  // Clean up created Linear issues
  if (createdIdentifiers.length > 0 && process.env.LINEAR_API_KEY) {
    const sdk = new LinearSDK({ apiKey: process.env.LINEAR_API_KEY });
    console.log(`Cleaning up ${createdIdentifiers.length} update/show test issues...`);
    for (const identifier of createdIdentifiers) {
      try {
        const issue = await sdk.issue(identifier);
        if (issue.id) {
          await sdk.deleteIssue(issue.id);
          console.log(`  Cleaned up ${identifier}`);
        }
      } catch (e) {
        console.warn(`  Failed to clean up ${identifier}:`, e);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Update tests (AC-7, AC-8, AC-9, AC-15) — Integration tests
// ---------------------------------------------------------------------------

describe("plan-meta update: --description preserves meta (AC-7)", () => {
  test(
    "AC-7: update --description preserves existing created_by_session, updates last_session and sessions",
    async () => {
      // Step 1: Create an issue with meta from session-A
      const { stdout: createOut, exitCode: createExit } = await runPlan(
        ["create", "test: meta update --description AC-7", "--parent", "ENG-3758", "--quiet"],
        { CLAUDE_SESSION_ID: "session-A" }
      );
      expect(createExit).toBe(0);

      const identifier = createOut.trim();
      expect(identifier).toMatch(/^ENG-\d+$/);
      createdIdentifiers.push(identifier);

      // Verify the issue was created with meta from session-A
      const descBefore = await fetchRawDescription(identifier);
      const { meta: metaBefore } = parseMeta(descBefore);
      expect(metaBefore).not.toBeNull();
      expect(metaBefore!.created_by_session).toBe("session-A");

      // Step 2: Update the issue's description with a different session
      const { exitCode: updateExit } = await runPlan(
        ["update", identifier, "--description", "new content"],
        { CLAUDE_SESSION_ID: "session-B" }
      );
      expect(updateExit).toBe(0);

      // Step 3: Fetch and verify meta
      const descAfter = await fetchRawDescription(identifier);
      const { description: cleanDesc, meta: metaAfter } = parseMeta(descAfter);

      // Meta should exist
      expect(metaAfter).not.toBeNull();

      // created_by_session should be preserved from original creation
      expect(metaAfter!.created_by_session).toBe("session-A");

      // last_session should be updated to the new session
      expect(metaAfter!.last_session).toBe("session-B");

      // sessions should contain both A and B
      expect(metaAfter!.sessions).toContain("session-A");
      expect(metaAfter!.sessions).toContain("session-B");

      // Description content should be the new content (no meta block)
      expect(cleanDesc).toBe("new content");
    },
    { timeout: 45_000 }
  );
});

describe("plan-meta update: --append-description preserves meta (AC-8)", () => {
  test(
    "AC-8: update --append-description strips meta before appending, then reattaches updated meta",
    async () => {
      // Step 1: Create an issue with meta and a description
      const { stdout: createOut, exitCode: createExit } = await runPlan(
        [
          "create",
          "test: meta update --append-description AC-8",
          "--parent",
          "ENG-3758",
          "--quiet",
        ],
        { CLAUDE_SESSION_ID: "session-append-1" }
      );
      expect(createExit).toBe(0);

      const identifier = createOut.trim();
      expect(identifier).toMatch(/^ENG-\d+$/);
      createdIdentifiers.push(identifier);

      // Set an initial description with "Hello" via update --description
      // (This also sets meta since we have CLAUDE_SESSION_ID)
      const { exitCode: setDescExit } = await runPlan(
        ["update", identifier, "--description", "Hello"],
        { CLAUDE_SESSION_ID: "session-append-1" }
      );
      expect(setDescExit).toBe(0);

      // Step 2: Append "World" with a different session
      const { exitCode: appendExit } = await runPlan(
        ["update", identifier, "--append-description", "World"],
        { CLAUDE_SESSION_ID: "session-append-2" }
      );
      expect(appendExit).toBe(0);

      // Step 3: Fetch and verify
      const descAfter = await fetchRawDescription(identifier);
      const { description: cleanDesc, meta: metaAfter } = parseMeta(descAfter);

      // Description should contain both "Hello" and "World"
      expect(cleanDesc).toContain("Hello");
      expect(cleanDesc).toContain("World");

      // Meta should exist and be updated
      expect(metaAfter).not.toBeNull();

      // last_session should be the append session
      expect(metaAfter!.last_session).toBe("session-append-2");

      // created_by_session should be preserved from original creation
      expect(metaAfter!.created_by_session).toBe("session-append-1");

      // sessions should contain the append session
      expect(metaAfter!.sessions).toContain("session-append-2");
    },
    { timeout: 45_000 }
  );
});

describe("plan-meta update: --description-file preserves meta (AC-9)", () => {
  test(
    "AC-9: update --description-file behaves the same as --description for meta handling",
    async () => {
      // Step 1: Create an issue with meta from session-D-create
      const { stdout: createOut, exitCode: createExit } = await runPlan(
        [
          "create",
          "test: meta update --description-file AC-9",
          "--parent",
          "ENG-3758",
          "--quiet",
        ],
        { CLAUDE_SESSION_ID: "session-D-create" }
      );
      expect(createExit).toBe(0);

      const identifier = createOut.trim();
      expect(identifier).toMatch(/^ENG-\d+$/);
      createdIdentifiers.push(identifier);

      // Verify the issue has meta from session-D-create
      const descBefore = await fetchRawDescription(identifier);
      const { meta: metaBefore } = parseMeta(descBefore);
      expect(metaBefore).not.toBeNull();
      expect(metaBefore!.created_by_session).toBe("session-D-create");

      // Step 2: Write "file content" to a temp file
      const tmpDir = `/tmp/plan-meta-test-${Date.now()}`;
      mkdirSync(tmpDir, { recursive: true });
      const tmpFile = join(tmpDir, "test-description.md");
      writeFileSync(tmpFile, "file content");

      // Step 3: Update using --description-file with a new session
      const { exitCode: updateExit } = await runPlan(
        ["update", identifier, "--description-file", tmpFile],
        { CLAUDE_SESSION_ID: "session-D-update" }
      );
      expect(updateExit).toBe(0);

      // Step 4: Fetch and verify meta
      const descAfter = await fetchRawDescription(identifier);
      const { description: cleanDesc, meta: metaAfter } = parseMeta(descAfter);

      // Meta should exist
      expect(metaAfter).not.toBeNull();

      // created_by_session should be preserved from original creation
      expect(metaAfter!.created_by_session).toBe("session-D-create");

      // last_session should be updated to the file-update session
      expect(metaAfter!.last_session).toBe("session-D-update");

      // sessions should contain both sessions
      expect(metaAfter!.sessions).toContain("session-D-create");
      expect(metaAfter!.sessions).toContain("session-D-update");

      // Description content should be "file content"
      expect(cleanDesc).toBe("file content");
    },
    { timeout: 45_000 }
  );
});

describe("plan-meta update: no CLAUDE_SESSION_ID preserves meta (AC-15)", () => {
  test(
    "AC-15: update without CLAUDE_SESSION_ID still preserves any existing meta block",
    async () => {
      // Step 1: Create an issue with meta from session-E
      const { stdout: createOut, exitCode: createExit } = await runPlan(
        [
          "create",
          "test: meta update no-session AC-15",
          "--parent",
          "ENG-3758",
          "--quiet",
        ],
        { CLAUDE_SESSION_ID: "session-E" }
      );
      expect(createExit).toBe(0);

      const identifier = createOut.trim();
      expect(identifier).toMatch(/^ENG-\d+$/);
      createdIdentifiers.push(identifier);

      // Verify the issue has meta from session-E
      const descBefore = await fetchRawDescription(identifier);
      const { meta: metaBefore } = parseMeta(descBefore);
      expect(metaBefore).not.toBeNull();
      expect(metaBefore!.created_by_session).toBe("session-E");
      expect(metaBefore!.last_session).toBe("session-E");

      // Step 2: Update the description WITHOUT CLAUDE_SESSION_ID
      const { exitCode: updateExit } = await runPlan(
        ["update", identifier, "--description", "updated without session"],
        { CLAUDE_SESSION_ID: undefined }
      );
      expect(updateExit).toBe(0);

      // Step 3: Fetch and verify meta is still present and unchanged
      const descAfter = await fetchRawDescription(identifier);
      const { description: cleanDesc, meta: metaAfter } = parseMeta(descAfter);

      // Meta should still be present
      expect(metaAfter).not.toBeNull();

      // All meta fields should be unchanged — passthrough
      expect(metaAfter!.created_by_session).toBe("session-E");
      expect(metaAfter!.last_session).toBe("session-E");
      expect(metaAfter!.sessions).toContain("session-E");

      // Description content should be the updated content
      expect(cleanDesc).toBe("updated without session");
    },
    { timeout: 45_000 }
  );
});

// ---------------------------------------------------------------------------
// Show tests (AC-12, AC-13) — Unit tests
// ---------------------------------------------------------------------------

describe("plan-meta show: human output displays session ID (AC-12)", () => {
  const sampleMeta: PlanMeta = {
    created_by_session: "abc12345-6789-0abc-def0-123456789abc",
    created_at: "2026-03-30T12:00:00.000Z",
    last_session: "abc12345-6789-0abc-def0-123456789abc",
    updated_at: "2026-03-30T14:30:00.000Z",
    sessions: ["abc12345-6789-0abc-def0-123456789abc"],
  };

  const metaBlock = serializeMeta(sampleMeta);

  const mockIssueWithMeta: PlanIssueDetail = {
    id: "issue-meta-1",
    identifier: "ENG-100",
    title: "Issue with meta",
    description: `Some description content\n\n${metaBlock}`,
    status: "In Progress",
    sortOrder: 1.0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    url: "https://linear.app/team/issue/ENG-100",
    position: 1,
    assignee: { id: "user-1", name: "nitsan", displayName: "Nitsan" },
    labels: [],
    children: [],
    blockedBy: [],
    blocks: [],
  };

  test("AC-12: formatShowHuman displays session ID line when meta is present", () => {
    const output = formatShowHuman(mockIssueWithMeta);
    const plain = stripAnsi(output);

    // Should display a session ID line (truncated or full UUID)
    // The spec says "e.g. Session: add7985c" — look for a Session: line
    expect(plain).toMatch(/Session:\s+\S+/);

    // The session ID should be visible somewhere (at least a prefix)
    expect(plain).toContain("abc12345");
  });

  test("AC-12: formatShowHuman strips meta block from rendered description", () => {
    const output = formatShowHuman(mockIssueWithMeta);
    const plain = stripAnsi(output);

    // The meta block itself should NOT appear in the rendered output
    expect(plain).not.toContain("<!-- plan:meta");
    expect(plain).not.toContain("created_by_session");

    // But the clean description content should be present
    expect(plain).toContain("Some description content");
  });
});

describe("plan-meta show: JSON output includes meta field (AC-13)", () => {
  const sampleMeta: PlanMeta = {
    created_by_session: "session-json-1",
    created_at: "2026-03-30T12:00:00.000Z",
    last_session: "session-json-2",
    updated_at: "2026-03-30T14:30:00.000Z",
    sessions: ["session-json-1", "session-json-2"],
  };

  const metaBlock = serializeMeta(sampleMeta);

  const mockIssueWithMeta: PlanIssueDetail = {
    id: "issue-meta-2",
    identifier: "ENG-200",
    title: "Issue with meta for JSON",
    description: `Clean description here\n\n${metaBlock}`,
    status: "Backlog",
    sortOrder: 2.0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    url: "https://linear.app/team/issue/ENG-200",
    position: 2,
    assignee: { id: "user-1", name: "nitsan", displayName: "Nitsan" },
    labels: [],
    children: [],
    blockedBy: [],
    blocks: [],
  };

  test("AC-13: formatShowJson includes parsed meta as a separate field", () => {
    const output = formatShowJson(mockIssueWithMeta);
    const parsed = JSON.parse(output);

    // Should have a `meta` field with the parsed metadata
    expect(parsed.meta).toBeDefined();
    expect(parsed.meta.created_by_session).toBe("session-json-1");
    expect(parsed.meta.last_session).toBe("session-json-2");
    expect(parsed.meta.created_at).toBe("2026-03-30T12:00:00.000Z");
    expect(parsed.meta.updated_at).toBe("2026-03-30T14:30:00.000Z");
    expect(parsed.meta.sessions).toContain("session-json-1");
    expect(parsed.meta.sessions).toContain("session-json-2");
  });

  test("AC-13: formatShowJson description field is clean (no meta block)", () => {
    const output = formatShowJson(mockIssueWithMeta);
    const parsed = JSON.parse(output);

    // The description field should be the CLEAN content (no meta block)
    expect(parsed.description).toBe("Clean description here");
    expect(parsed.description).not.toContain("<!-- plan:meta");
  });

  // Not test.failing: the baseline no-meta behavior already works —
  // formatShowJson returns the raw description, and meta field is absent.
  test("AC-13: formatShowJson with no meta block returns meta as null or undefined", () => {
    const mockIssueNoMeta: PlanIssueDetail = {
      id: "issue-no-meta",
      identifier: "ENG-300",
      title: "Issue without meta",
      description: "Just a plain description",
      status: "Backlog",
      sortOrder: 3.0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      url: "https://linear.app/team/issue/ENG-300",
      position: 3,
      assignee: { id: "user-1", name: "nitsan", displayName: "Nitsan" },
      labels: [],
      children: [],
      blockedBy: [],
      blocks: [],
    };

    const output = formatShowJson(mockIssueNoMeta);
    const parsed = JSON.parse(output);

    // meta should be null or undefined when no meta block present
    expect(parsed.meta ?? null).toBeNull();

    // Description should be unchanged
    expect(parsed.description).toBe("Just a plain description");
  });
});
