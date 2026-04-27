import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, listScoresForSubmission, listSessions, listSubmissions, recordSubmission } from "./db";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "dx-his-db-"));
  process.env.DX_HIS_DB = join(tmpDir, "test.db");
});

afterEach(() => {
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DX_HIS_DB;
});

describe("recordSubmission", () => {
  it("creates session, submission, and aspect_scores in one transaction", () => {
    const id = recordSubmission({
      sessionId: "s1",
      cwd: "/tmp",
      turnIndex: 0,
      actor: "human",
      trigger: "manual",
      ts: "2026-04-27T12:00:00Z",
      note: "first take",
      raw: "raw",
      scores: [
        { aspect: "vibe", score: 80 },
        { aspect: "accuracy", score: 92 },
      ],
    });
    expect(id).toBeGreaterThan(0);

    const subs = listSubmissions("s1");
    expect(subs).toHaveLength(1);
    expect(subs[0].actor).toBe("human");
    expect(subs[0].note).toBe("first take");

    const scores = listScoresForSubmission(id);
    expect(scores).toHaveLength(2);
    expect(scores.find((s) => s.aspect === "vibe")?.score).toBe(80);
  });

  it("accumulates submissions for the same session — does not overwrite", () => {
    recordSubmission({
      sessionId: "s2",
      cwd: "/tmp",
      actor: "human",
      trigger: "manual",
      ts: "2026-04-27T12:00:00Z",
      scores: [{ aspect: "vibe", score: 50 }],
    });
    recordSubmission({
      sessionId: "s2",
      cwd: "/tmp",
      actor: "claude",
      trigger: "stop-hook",
      ts: "2026-04-27T12:05:00Z",
      note: "later read",
      scores: [{ aspect: "vibe", score: 80 }],
    });
    const subs = listSubmissions("s2");
    expect(subs).toHaveLength(2);
    expect(subs[0].actor).toBe("human");
    expect(subs[1].actor).toBe("claude");
  });

  it("supports schemaless aspect strings — adding a new aspect requires no migration", () => {
    recordSubmission({
      sessionId: "s3",
      cwd: "/tmp",
      actor: "human",
      trigger: "manual",
      ts: "2026-04-27T12:00:00Z",
      scores: [{ aspect: "brand_new_aspect_invented_today", score: 42 }],
    });
    const subs = listSubmissions("s3");
    const scores = listScoresForSubmission(subs[0].id);
    expect(scores[0].aspect).toBe("brand_new_aspect_invented_today");
    expect(scores[0].score).toBe(42);
  });

  it("listSessions returns sessions ordered by last_seen desc", () => {
    recordSubmission({
      sessionId: "s-old",
      cwd: "/tmp",
      actor: "human",
      trigger: "manual",
      ts: "2026-04-27T10:00:00Z",
      scores: [{ aspect: "vibe", score: 1 }],
    });
    recordSubmission({
      sessionId: "s-new",
      cwd: "/tmp",
      actor: "human",
      trigger: "manual",
      ts: "2026-04-27T13:00:00Z",
      scores: [{ aspect: "vibe", score: 2 }],
    });
    const sessions = listSessions();
    expect(sessions[0].id).toBe("s-new");
    expect(sessions[1].id).toBe("s-old");
  });
});
