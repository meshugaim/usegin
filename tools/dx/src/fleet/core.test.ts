import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyFleetFilters,
  countByState,
  formatHumanTable,
  formatJson,
  formatSnapshotMarkdown,
  joinFleet,
  readJobsRegistry,
  readSessionsRegistry,
  relativeAge,
  type JobState,
  type SessionState,
} from "./core";

function seedHome(): string {
  const home = mkdtempSync(join(tmpdir(), "dx-fleet-"));
  mkdirSync(join(home, ".claude", "jobs"), { recursive: true });
  mkdirSync(join(home, ".claude", "sessions"), { recursive: true });
  return home;
}

function writeJob(home: string, jobId: string, body: Record<string, unknown>) {
  const dir = join(home, ".claude", "jobs", jobId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "state.json"), JSON.stringify(body));
}

function writeSession(
  home: string,
  pid: string,
  body: Record<string, unknown>,
) {
  writeFileSync(
    join(home, ".claude", "sessions", `${pid}.json`),
    JSON.stringify(body),
  );
}

describe("relativeAge", () => {
  test("formats seconds", () => {
    expect(relativeAge(30)).toBe("30s");
  });
  test("formats minutes", () => {
    expect(relativeAge(90)).toBe("1m");
  });
  test("formats hours", () => {
    expect(relativeAge(5400)).toBe("1h");
  });
  test("formats days", () => {
    expect(relativeAge(90000)).toBe("1d");
  });
  test("clamps negative", () => {
    expect(relativeAge(-5)).toBe("0s");
  });
});

describe("readJobsRegistry", () => {
  test("returns empty when directory missing", () => {
    const home = mkdtempSync(join(tmpdir(), "dx-fleet-"));
    expect(readJobsRegistry(home)).toEqual([]);
  });

  test("parses well-formed state.json", () => {
    const home = seedHome();
    writeJob(home, "aaaa1111", {
      state: "blocked",
      tempo: "blocked",
      intent: "do stuff\nsecond line",
      needs: "clarify X",
      sessionId: "aaaa1111-full",
      cwd: "/somewhere",
      updatedAt: "2026-05-15T14:00:00.000Z",
      createdAt: "2026-05-15T13:00:00.000Z",
    });
    const rows = readJobsRegistry(home);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      jobId: "aaaa1111",
      state: "blocked",
      tempo: "blocked",
      intent: "do stuff\nsecond line",
      needs: "clarify X",
      sessionId: "aaaa1111-full",
      cwd: "/somewhere",
      updatedAt: "2026-05-15T14:00:00.000Z",
      createdAt: "2026-05-15T13:00:00.000Z",
    });
  });

  test("skips folders without state.json and survives malformed json", () => {
    const home = seedHome();
    mkdirSync(join(home, ".claude", "jobs", "emptyfolder"), {
      recursive: true,
    });
    const badDir = join(home, ".claude", "jobs", "malformed");
    mkdirSync(badDir, { recursive: true });
    writeFileSync(join(badDir, "state.json"), "not json");
    writeJob(home, "good0001", {
      state: "working",
      intent: "x",
      cwd: "/y",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });
    const rows = readJobsRegistry(home);
    expect(rows).toHaveLength(1);
    expect(rows[0].jobId).toBe("good0001");
  });
});

describe("readSessionsRegistry", () => {
  test("ignores pins.json and non-json", () => {
    const home = seedHome();
    writeFileSync(join(home, ".claude", "sessions", "pins.json"), "{}");
    writeFileSync(join(home, ".claude", "sessions", "README"), "hi");
    writeSession(home, "11252", {
      pid: 11252,
      sessionId: "aaaa1111-full",
      cwd: "/somewhere",
      jobId: "aaaa1111",
      updatedAt: 1778855786601,
      status: "idle",
      name: "the name",
    });
    const rows = readSessionsRegistry(home);
    expect(rows).toHaveLength(1);
    expect(rows[0].jobId).toBe("aaaa1111");
    expect(rows[0].pid).toBe(11252);
  });
});

describe("joinFleet", () => {
  const now = new Date("2026-05-15T15:00:00.000Z");

  test("job-without-session marks live=false", () => {
    const jobs: JobState[] = [
      {
        jobId: "aaaa1111",
        state: "blocked",
        tempo: "blocked",
        intent: "i1",
        needs: "n1",
        sessionId: "aaaa1111-full",
        cwd: "/c",
        updatedAt: "2026-05-15T14:00:00.000Z",
        createdAt: null,
      },
    ];
    const rows = joinFleet(jobs, [], now);
    expect(rows).toHaveLength(1);
    expect(rows[0].live).toBe(false);
    expect(rows[0].sessionIdShort).toBe("aaaa1111");
    expect(rows[0].ageSeconds).toBe(3600);
    expect(rows[0].ageHuman).toBe("1h");
  });

  test("session-without-job synthesizes a row", () => {
    const sessions: SessionState[] = [
      {
        jobId: "orphan22",
        sessionId: "orphan22-full",
        cwd: "/o",
        updatedAtMs: now.getTime() - 60_000,
        status: "busy",
        name: "did things",
        pid: 1,
      },
    ];
    const rows = joinFleet([], sessions, now);
    expect(rows).toHaveLength(1);
    expect(rows[0].live).toBe(true);
    expect(rows[0].state).toBe("unknown");
    expect(rows[0].jobIdShort).toBe("orphan22");
  });

  test("sort order: blocked > working > done; newest first within bucket", () => {
    const mk = (id: string, state: string, ts: string): JobState => ({
      jobId: id,
      state,
      tempo: null,
      intent: id,
      needs: null,
      sessionId: id,
      cwd: "/x",
      updatedAt: ts,
      createdAt: null,
    });
    const jobs: JobState[] = [
      mk("done01", "done", "2026-05-15T14:00:00Z"),
      mk("done02", "done", "2026-05-15T14:30:00Z"),
      mk("work01", "working", "2026-05-15T14:00:00Z"),
      mk("blok01", "blocked", "2026-05-15T13:00:00Z"),
      mk("blok02", "blocked", "2026-05-15T14:00:00Z"),
    ];
    const rows = joinFleet(jobs, [], now);
    expect(rows.map((r) => r.jobId)).toEqual([
      "blok02",
      "blok01",
      "work01",
      "done02",
      "done01",
    ]);
  });

  test("live flag flips when session is present for same jobId", () => {
    const jobs: JobState[] = [
      {
        jobId: "aaaa1111",
        state: "working",
        tempo: "active",
        intent: "i",
        needs: null,
        sessionId: "aaaa1111-full",
        cwd: "/c",
        updatedAt: "2026-05-15T14:00:00.000Z",
        createdAt: null,
      },
    ];
    const sessions: SessionState[] = [
      {
        jobId: "aaaa1111",
        sessionId: "aaaa1111-full",
        cwd: "/c",
        updatedAtMs: now.getTime() - 60_000,
        status: "busy",
        name: "x",
        pid: 1,
      },
    ];
    const rows = joinFleet(jobs, sessions, now);
    expect(rows[0].live).toBe(true);
  });
});

describe("countByState", () => {
  test("counts buckets correctly", () => {
    const rows = joinFleet(
      [
        {
          jobId: "a",
          state: "blocked",
          tempo: null,
          intent: "",
          needs: null,
          sessionId: "a",
          cwd: "",
          updatedAt: "2026-05-15T14:00:00Z",
          createdAt: null,
        },
        {
          jobId: "b",
          state: "working",
          tempo: null,
          intent: "",
          needs: null,
          sessionId: "b",
          cwd: "",
          updatedAt: "2026-05-15T14:00:00Z",
          createdAt: null,
        },
        {
          jobId: "c",
          state: "done",
          tempo: null,
          intent: "",
          needs: null,
          sessionId: "c",
          cwd: "",
          updatedAt: "2026-05-15T14:00:00Z",
          createdAt: null,
        },
        {
          jobId: "d",
          state: "done",
          tempo: null,
          intent: "",
          needs: null,
          sessionId: "d",
          cwd: "",
          updatedAt: "2026-05-15T14:00:00Z",
          createdAt: null,
        },
      ],
      [],
      new Date("2026-05-15T15:00:00Z"),
    );
    expect(countByState(rows)).toEqual({
      total: 4,
      blocked: 1,
      working: 1,
      done: 2,
    });
  });
});

describe("formatJson", () => {
  test("includes snapshotAt, counts, and all eight row columns", () => {
    const rows = joinFleet(
      [
        {
          jobId: "a1b2c3d4",
          state: "blocked",
          tempo: "blocked",
          intent: "hello",
          needs: "ask Guy",
          sessionId: "a1b2c3d4-full",
          cwd: "/cwd",
          updatedAt: "2026-05-15T14:00:00.000Z",
          createdAt: null,
        },
      ],
      [],
      new Date("2026-05-15T15:00:00.000Z"),
    );
    const obj = JSON.parse(
      formatJson(rows, new Date("2026-05-15T15:00:00.000Z")),
    );
    expect(obj.snapshotAt).toBe("2026-05-15T15:00:00.000Z");
    expect(obj.counts.total).toBe(1);
    const j = obj.jobs[0];
    for (const k of [
      "jobId",
      "jobIdShort",
      "sessionId",
      "sessionIdShort",
      "live",
      "state",
      "ageSeconds",
      "ageHuman",
      "updatedAt",
      "needs",
      "intent",
      "cwd",
    ]) {
      expect(j).toHaveProperty(k);
    }
  });
});

describe("formatHumanTable", () => {
  test("every row fits within 120 chars; header present; footer counts", () => {
    const rows = joinFleet(
      [
        {
          jobId: "aaaa1111",
          state: "blocked",
          tempo: "blocked",
          intent:
            "this is a very long intent that should be truncated because it exceeds the column width by a lot and then some",
          needs:
            "very long needs string that goes on and on and on past the column limit",
          sessionId: "aaaa1111-full",
          cwd: "/c",
          updatedAt: "2026-05-15T14:00:00.000Z",
          createdAt: null,
        },
      ],
      [],
      new Date("2026-05-15T15:00:00.000Z"),
    );
    const out = formatHumanTable(rows);
    const lines = out.split("\n");
    expect(lines[0]).toContain("JOB");
    expect(lines[0]).toContain("STATE");
    expect(lines[0]).toContain("NEEDS");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(120);
    }
    expect(out).toContain("1 jobs: 1 blocked");
  });
});

describe("applyFleetFilters", () => {
  const now = new Date("2026-05-15T15:00:00.000Z");
  const mkJob = (id: string, state: string, cwd: string): JobState => ({
    jobId: id,
    state,
    tempo: null,
    intent: id,
    needs: null,
    sessionId: id,
    cwd,
    updatedAt: "2026-05-15T14:00:00Z",
    createdAt: null,
  });
  const rows = joinFleet(
    [
      mkJob("blok01", "blocked", "/workspaces/test-mvp"),
      mkJob("work01", "working", "/workspaces/test-mvp"),
      mkJob("blok02", "blocked", "/other"),
      mkJob("done01", "done", "/workspaces/test-mvp"),
    ],
    [],
    now,
  );

  test("--only-blocked filters to blocked rows", () => {
    const out = applyFleetFilters(rows, { onlyBlocked: true });
    expect(out.map((r) => r.jobId).sort()).toEqual(["blok01", "blok02"]);
  });

  test("--include-cwd filters by prefix", () => {
    const out = applyFleetFilters(rows, {
      includeCwd: "/workspaces/test-mvp",
    });
    expect(out.map((r) => r.jobId).sort()).toEqual([
      "blok01",
      "done01",
      "work01",
    ]);
  });

  test("filters compose with AND semantics", () => {
    const out = applyFleetFilters(rows, {
      onlyBlocked: true,
      includeCwd: "/workspaces/test-mvp",
    });
    expect(out.map((r) => r.jobId)).toEqual(["blok01"]);
  });

  test("empty options is identity", () => {
    const out = applyFleetFilters(rows, {});
    expect(out).toHaveLength(rows.length);
  });
});

describe("joinFleet sort — unknown state", () => {
  test("synthetic 'unknown' rows sort after done", () => {
    const now = new Date("2026-05-15T15:00:00.000Z");
    const jobs: JobState[] = [
      {
        jobId: "donejob1",
        state: "done",
        tempo: null,
        intent: "i",
        needs: null,
        sessionId: "donejob1",
        cwd: "/c",
        updatedAt: "2026-05-15T14:00:00Z",
        createdAt: null,
      },
    ];
    const sessions: SessionState[] = [
      {
        jobId: "orphanjob",
        sessionId: "orphanjob-s",
        cwd: "/c",
        updatedAtMs: now.getTime() - 60_000,
        status: "busy",
        name: "x",
        pid: 1,
      },
    ];
    const rows = joinFleet(jobs, sessions, now);
    // done before unknown (rank 2 < 99)
    expect(rows.map((r) => r.state)).toEqual(["done", "unknown"]);
  });
});

describe("formatSnapshotMarkdown", () => {
  test("has one ## heading per row plus footer", () => {
    const rows = joinFleet(
      [
        {
          jobId: "aaaa1111",
          state: "blocked",
          tempo: "blocked",
          intent: "intent A",
          needs: "ask Guy",
          sessionId: "aaaa1111-full",
          cwd: "/c",
          updatedAt: "2026-05-15T14:00:00.000Z",
          createdAt: null,
        },
        {
          jobId: "bbbb2222",
          state: "done",
          tempo: "idle",
          intent: "intent B",
          needs: null,
          sessionId: "bbbb2222-full",
          cwd: "/c2",
          updatedAt: "2026-05-15T13:00:00.000Z",
          createdAt: null,
        },
      ],
      [],
      new Date("2026-05-15T15:00:00.000Z"),
    );
    const md = formatSnapshotMarkdown(rows, "2026-05-15T15:00:00Z");
    const headingCount = (md.match(/^## /gm) ?? []).length;
    expect(headingCount).toBe(2);
    expect(md).toContain("# Fleet snapshot");
    expect(md).toContain("aaaa1111 · blocked");
    expect(md).toContain("Live read: `dx fleet`");
    expect(md).toContain("Re-render this snapshot");
  });
});
