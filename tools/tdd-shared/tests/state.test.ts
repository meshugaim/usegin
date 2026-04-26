import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  readState,
  readStateRaw,
  writeState,
  writeStateRaw,
  StateSchema,
  WorkerReviewerStateSchema,
  climbToWorkspace,
  climbToStateJson,
  type State,
} from "../src/state";

let TMP: string;

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), "tdd-shared-state-"));
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

const validState: State = {
  plan: "impl-plan.md",
  step_index: 3,
  phase: "green",
  current_target_test_id: "T2",
  cycle_attempts: 1,
  cycle_index: 17,
};

describe("StateSchema", () => {
  it("accepts a valid tdd-execute state", () => {
    const r = StateSchema.safeParse(validState);
    expect(r.ok).toBe(true);
    expect(r.data).toEqual(validState);
  });

  it("accepts optional last_test_run and red_commit", () => {
    const r = StateSchema.safeParse({
      ...validState,
      red_commit: "abc123",
      last_test_run: {
        ts: "2026-04-26T00:00:00Z",
        passed: 17,
        failed: 1,
        failing_tests: ["foo.test.ts:42"],
      },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects an invalid phase", () => {
    const r = StateSchema.safeParse({ ...validState, phase: "impl:working" });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.path === "phase")).toBe(true);
  });

  it("rejects missing required fields", () => {
    const r = StateSchema.safeParse({ phase: "green" });
    expect(r.ok).toBe(false);
    const paths = r.issues.map((i) => i.path);
    expect(paths).toContain("plan");
    expect(paths).toContain("step_index");
    expect(paths).toContain("current_target_test_id");
  });

  it("rejects non-object input", () => {
    expect(StateSchema.safeParse(null).ok).toBe(false);
    expect(StateSchema.safeParse("hello").ok).toBe(false);
    expect(StateSchema.safeParse([validState]).ok).toBe(false);
  });

  it("validates last_test_run substructure", () => {
    const r = StateSchema.safeParse({
      ...validState,
      last_test_run: { ts: "x", passed: "wrong", failed: 0, failing_tests: [] },
    });
    expect(r.ok).toBe(false);
    expect(
      r.issues.some((i) => i.path === "last_test_run.passed"),
    ).toBe(true);
  });
});

describe("WorkerReviewerStateSchema", () => {
  it("accepts the legacy shape", () => {
    const r = WorkerReviewerStateSchema.safeParse({
      phase: "plan:draft",
      currentTestIndex: null,
      totalTests: null,
      startedAt: "2026-04-26T00:00:00Z",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a tdd-execute phase value", () => {
    const r = WorkerReviewerStateSchema.safeParse({
      phase: "green",
      currentTestIndex: null,
      totalTests: null,
      startedAt: null,
    });
    expect(r.ok).toBe(false);
  });
});

describe("readState / writeState", () => {
  it("round-trips a valid state through disk", () => {
    writeState(TMP, validState);
    const loaded = readState(TMP);
    expect(loaded).toEqual(validState);
  });

  it("readState throws on missing file", () => {
    expect(() => readState(TMP)).toThrow(/not found/);
  });

  it("readState throws on schema violation", () => {
    writeFileSync(join(TMP, "state.json"), JSON.stringify({ phase: "garbage" }));
    expect(() => readState(TMP)).toThrow(/State validation failed/);
  });

  it("readStateRaw returns null for missing file", () => {
    expect(readStateRaw(TMP)).toBeNull();
  });

  it("readStateRaw returns parsed JSON regardless of schema", () => {
    const legacy = {
      phase: "plan:draft",
      currentTestIndex: null,
      totalTests: null,
      startedAt: null,
    };
    writeStateRaw(TMP, legacy);
    expect(readStateRaw(TMP)).toEqual(legacy);
  });

  it("writeState refuses to write garbage", () => {
    expect(() =>
      writeState(TMP, { ...validState, phase: "nonsense" } as unknown as State),
    ).toThrow();
  });

  it("writeState creates the workspace dir if missing", () => {
    const nested = join(TMP, "deep", "nested");
    expect(existsSync(nested)).toBe(false);
    writeState(nested, validState);
    expect(existsSync(join(nested, "state.json"))).toBe(true);
  });
});

describe("climbToWorkspace", () => {
  it("finds .tdd-execute/<slice>/state.json from a nested file path", () => {
    const slice = join(TMP, ".tdd-execute", "ENG-1234-1");
    mkdirSync(slice, { recursive: true });
    writeFileSync(join(slice, "state.json"), JSON.stringify(validState));

    const deepFile = join(TMP, "src", "feature", "thing.ts");
    mkdirSync(join(TMP, "src", "feature"), { recursive: true });
    writeFileSync(deepFile, "// stub");

    const found = climbToWorkspace(deepFile);
    expect(found).toBe(join(slice, "state.json"));
  });

  it("returns null when no .tdd-execute is reachable", () => {
    const lonely = join(TMP, "no", "tdd", "here", "thing.ts");
    mkdirSync(join(TMP, "no", "tdd", "here"), { recursive: true });
    writeFileSync(lonely, "// stub");
    expect(climbToWorkspace(lonely)).toBeNull();
  });

  it("walks up multiple levels", () => {
    const slice = join(TMP, ".tdd-execute", "ENG-1234-2");
    mkdirSync(slice, { recursive: true });
    writeFileSync(join(slice, "state.json"), JSON.stringify(validState));

    const veryDeep = join(TMP, "a", "b", "c", "d", "e", "thing.ts");
    mkdirSync(join(TMP, "a", "b", "c", "d", "e"), { recursive: true });
    writeFileSync(veryDeep, "// stub");

    expect(climbToWorkspace(veryDeep)).toBe(join(slice, "state.json"));
  });

  it("works when startPath is itself the workspace dir", () => {
    const slice = join(TMP, ".tdd-execute", "S1");
    mkdirSync(slice, { recursive: true });
    writeFileSync(join(slice, "state.json"), JSON.stringify(validState));
    expect(climbToWorkspace(TMP)).toBe(join(slice, "state.json"));
  });

  it("works when the file path doesn't exist on disk", () => {
    const slice = join(TMP, ".tdd-execute", "S1");
    mkdirSync(slice, { recursive: true });
    writeFileSync(join(slice, "state.json"), JSON.stringify(validState));
    const nonexistent = join(TMP, "src", "ghost", "ghost.ts");
    expect(climbToWorkspace(nonexistent)).toBe(join(slice, "state.json"));
  });
});

describe("climbToStateJson (worker-reviewer back-compat)", () => {
  it("finds the directory containing state.json", () => {
    writeFileSync(join(TMP, "state.json"), JSON.stringify({ phase: "plan:draft" }));
    const childFile = join(TMP, "src", "thing.ts");
    mkdirSync(join(TMP, "src"), { recursive: true });
    writeFileSync(childFile, "// stub");
    expect(climbToStateJson(childFile)).toBe(TMP);
  });

  it("returns null when no state.json is found", () => {
    const childFile = join(TMP, "src", "thing.ts");
    mkdirSync(join(TMP, "src"), { recursive: true });
    writeFileSync(childFile, "// stub");
    expect(climbToStateJson(childFile)).toBeNull();
  });
});
