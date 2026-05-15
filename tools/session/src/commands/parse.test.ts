/**
 * Tests for `resolveForParse` — the --remote branch selector for the main
 * parse command. Pins the contract that `--remote` delegates to
 * `fetchSession` (local → ~/agent-records/ → Supabase) and bare invocation
 * uses `resolveSessionPath` (local-only).
 *
 * Without this test, a regression that swapped the two calls would stay
 * green at every other layer — parseMainArgs returning `remote: true` is
 * tested separately in cli-args.test.ts, but the conditional that consumes
 * it had no coverage before. Ron S1.
 *
 * Linear: ENG-5956
 */

import { describe, expect, test } from "bun:test";
import { resolveForParse } from "./parse";

describe("resolveForParse — branch selection", () => {
  test("--remote → calls fetchSessionFn, returns its localPath", async () => {
    const fetchCalls: string[] = [];
    const resolveCalls: string[] = [];

    const filePath = await resolveForParse(
      { file: "abc12345", remote: true },
      {
        fetchSessionFn: async (input: string) => {
          fetchCalls.push(input);
          return {
            sessionId: "abc12345-full-uuid",
            shortId: "abc12345",
            localPath: "/home/dev/.claude/projects/x/abc12345-full-uuid.jsonl",
            alreadyLocal: false,
            source: "supabase" as const,
            subagentCount: 0,
          };
        },
        resolveSessionPathFn: async (input: string) => {
          resolveCalls.push(input);
          return "/should/not/be/called";
        },
      },
    );

    expect(fetchCalls).toEqual(["abc12345"]);
    expect(resolveCalls).toEqual([]);
    expect(filePath).toBe(
      "/home/dev/.claude/projects/x/abc12345-full-uuid.jsonl",
    );
  });

  test("no --remote → calls resolveSessionPathFn, returns the path verbatim", async () => {
    const fetchCalls: string[] = [];
    const resolveCalls: string[] = [];

    const filePath = await resolveForParse(
      { file: "abc12345", remote: false },
      {
        fetchSessionFn: async (input: string) => {
          fetchCalls.push(input);
          throw new Error("should not be called");
        },
        resolveSessionPathFn: async (input: string) => {
          resolveCalls.push(input);
          return "/home/dev/.claude/projects/x/local.jsonl";
        },
      },
    );

    expect(fetchCalls).toEqual([]);
    expect(resolveCalls).toEqual(["abc12345"]);
    expect(filePath).toBe("/home/dev/.claude/projects/x/local.jsonl");
  });

  test("--remote propagates errors from fetchSessionFn (e.g. AuthRequiredError)", async () => {
    const sentinel = new Error("auth expired");
    await expect(
      resolveForParse(
        { file: "abc12345", remote: true },
        {
          fetchSessionFn: async () => {
            throw sentinel;
          },
          resolveSessionPathFn: async () => "/unused",
        },
      ),
    ).rejects.toBe(sentinel);
  });

  test("--remote with a filesystem path short-circuits to resolveSessionPath (Ron N5)", async () => {
    // Without this guard, fetchSession would treat a path as a session ID
    // and produce a confusing "not found in any env" message with the full
    // path baked in. Paths should never trigger a Supabase lookup.
    const fetchCalls: string[] = [];
    const resolveCalls: string[] = [];

    const filePath = await resolveForParse(
      { file: "/some/absolute/path/session.jsonl", remote: true },
      {
        fetchSessionFn: async (input: string) => {
          fetchCalls.push(input);
          throw new Error("should not be called");
        },
        resolveSessionPathFn: async (input: string) => {
          resolveCalls.push(input);
          return input;
        },
      },
    );

    expect(fetchCalls).toEqual([]);
    expect(resolveCalls).toEqual(["/some/absolute/path/session.jsonl"]);
    expect(filePath).toBe("/some/absolute/path/session.jsonl");
  });

  test("--remote with bare .jsonl filename also short-circuits", async () => {
    const fetchCalls: string[] = [];
    const resolveCalls: string[] = [];

    await resolveForParse(
      { file: "session.jsonl", remote: true },
      {
        fetchSessionFn: async (input: string) => {
          fetchCalls.push(input);
          throw new Error("should not be called");
        },
        resolveSessionPathFn: async (input: string) => {
          resolveCalls.push(input);
          return input;
        },
      },
    );

    expect(fetchCalls).toEqual([]);
    expect(resolveCalls).toEqual(["session.jsonl"]);
  });
});
