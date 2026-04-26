/**
 * tdd-shared/state — typed read/write/validate of state.json for TDD skills.
 *
 * Schema is the union of:
 *  - the design memo (99-design-memo.md §4c) — the canonical tdd-execute schema
 *    with phase ∈ {red,green,refactor,complete}
 *  - the worker-reviewer schema (PROTOCOL.md §"State Machine") — phase ∈
 *    {plan:draft, plan:review, impl:working, impl:review, complete}
 *
 * Both shapes are accepted by the StateSchema validator. Skill-specific code
 * narrows to its own subset (see TddExecuteState / WorkerReviewerState below).
 *
 * Workspace discovery: `climbToWorkspace` walks up the directory tree from a
 * file path looking for `.tdd-execute/<slice-id>/state.json` (the tdd-execute
 * convention). For worker-reviewer's looser convention (any parent dir with
 * state.json), use `climbToStateJson`.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "fs";
import { dirname, join } from "path";

// ---- Phase enums ---------------------------------------------------------

/**
 * tdd-execute phases per design memo §4c, extended per dry-run F-HOOK-2 / F-MUT-2:
 *
 *   pre-red        → walking-skeleton scaffolding window. Production-path
 *                    edits are gated by `pre_red.allowed_paths[]` in
 *                    state.json. Used to land zero-logic exports / type
 *                    signatures so the outer Red can fail for the right
 *                    reason (assertion error, not import error). Director
 *                    transitions out to `red` once the skeleton lands.
 *   red            → only test-file edits allowed.
 *   green          → only production-file edits allowed.
 *   refactor       → either, but only when the suite is green-and-fresh.
 *   mutation-pass  → mutation-pass epilogue. Production-path edits are
 *                    gated by `mutation_pass.allowed_paths[]` in state.json
 *                    (the files named in `mutations[*].target_file`). Used
 *                    by the mutation-applier sub-agent to apply single-line
 *                    breakages and verify they're caught by the suite.
 *   complete       → no further edits allowed (slice locked).
 */
export type Phase =
  | "pre-red"
  | "red"
  | "green"
  | "refactor"
  | "mutation-pass"
  | "complete";

/** Worker-reviewer phases per PROTOCOL.md. */
export type WorkerReviewerPhase =
  | "plan:draft"
  | "plan:review"
  | "impl:working"
  | "impl:review"
  | "complete";

/** Either schema's phase. */
export type AnyPhase = Phase | WorkerReviewerPhase;

const TDD_EXECUTE_PHASES: ReadonlySet<string> = new Set([
  "pre-red",
  "red",
  "green",
  "refactor",
  "mutation-pass",
  "complete",
]);

const WORKER_REVIEWER_PHASES: ReadonlySet<string> = new Set([
  "plan:draft",
  "plan:review",
  "impl:working",
  "impl:review",
  "complete",
]);

export function isTddExecutePhase(s: unknown): s is Phase {
  return typeof s === "string" && TDD_EXECUTE_PHASES.has(s);
}

export function isWorkerReviewerPhase(s: unknown): s is WorkerReviewerPhase {
  return typeof s === "string" && WORKER_REVIEWER_PHASES.has(s);
}

// ---- State shapes --------------------------------------------------------

/** tdd-execute state.json (design memo §4c, extended per dry-run §4 findings). */
export interface State {
  plan: string;
  step_index: number;
  phase: Phase;
  current_target_test_id: string;
  red_commit?: string;
  last_test_run?: {
    ts: string;
    passed: number;
    failed: number;
    failing_tests: string[];
  };
  cycle_attempts: number;
  cycle_index: number;
  /**
   * Per F-HOOK-2: paths the pre-red phase is allowed to mutate. The hook
   * denies any production-path edit during pre-red unless file_path matches
   * one of these (compared as a suffix / equality after normalization).
   */
  pre_red?: {
    allowed_paths: string[];
  };
  /**
   * Per F-MUT-2: paths the mutation-pass phase is allowed to mutate (the
   * union of `mutations[*].target_file`). The hook denies any production-
   * path edit during mutation-pass unless file_path matches.
   */
  mutation_pass?: {
    allowed_paths: string[];
    current_mutation_id?: string;
  };
  /**
   * Per F-HOOK-5: refactor freshness window override (ms). When unset the
   * hook uses the 5-minute default.
   */
  refactor_freshness_window_ms?: number;
}

/** Legacy worker-reviewer state.json (PROTOCOL.md §State Machine). */
export interface WorkerReviewerState {
  phase: WorkerReviewerPhase;
  currentTestIndex: number | null;
  totalTests: number | null;
  startedAt: string | null;
}

/** Discriminated union of any state we read. */
export type AnyState = State | WorkerReviewerState;

// ---- Hand-rolled validation ---------------------------------------------
//
// We avoid adding zod as a dep. Validators below mirror the shape of a zod
// schema's `safeParse` so callers can still write `if (!result.ok) ...`.

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  issues: ValidationIssue[];
}

function ok<T>(data: T): ValidationResult<T> {
  return { ok: true, data, issues: [] };
}

function fail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Validate the tdd-execute state.json shape. Returns ok+data on success or
 * a list of issues on failure. Does NOT throw — callers decide.
 */
export const StateSchema = {
  parse(raw: unknown): State {
    const r = StateSchema.safeParse(raw);
    if (!r.ok) {
      throw new Error(
        `State validation failed:\n${r.issues
          .map((i) => `  ${i.path}: ${i.message}`)
          .join("\n")}`,
      );
    }
    return r.data!;
  },

  safeParse(raw: unknown): ValidationResult<State> {
    const issues: ValidationIssue[] = [];
    if (!isObj(raw)) {
      return fail([{ path: "", message: "must be an object" }]);
    }
    if (typeof raw.plan !== "string" || !raw.plan) {
      issues.push({ path: "plan", message: "must be a non-empty string" });
    }
    if (typeof raw.step_index !== "number" || raw.step_index < 0) {
      issues.push({
        path: "step_index",
        message: "must be a non-negative number",
      });
    }
    if (!isTddExecutePhase(raw.phase)) {
      issues.push({
        path: "phase",
        message: `must be one of red|green|refactor|complete (got ${JSON.stringify(raw.phase)})`,
      });
    }
    if (
      typeof raw.current_target_test_id !== "string" ||
      !raw.current_target_test_id
    ) {
      issues.push({
        path: "current_target_test_id",
        message: "must be a non-empty string",
      });
    }
    if (raw.red_commit !== undefined && typeof raw.red_commit !== "string") {
      issues.push({
        path: "red_commit",
        message: "must be a string when present",
      });
    }
    if (raw.last_test_run !== undefined) {
      const ltr = raw.last_test_run;
      if (!isObj(ltr)) {
        issues.push({
          path: "last_test_run",
          message: "must be an object when present",
        });
      } else {
        if (typeof ltr.ts !== "string")
          issues.push({ path: "last_test_run.ts", message: "must be string" });
        if (typeof ltr.passed !== "number")
          issues.push({
            path: "last_test_run.passed",
            message: "must be number",
          });
        if (typeof ltr.failed !== "number")
          issues.push({
            path: "last_test_run.failed",
            message: "must be number",
          });
        if (
          !Array.isArray(ltr.failing_tests) ||
          !ltr.failing_tests.every((x) => typeof x === "string")
        ) {
          issues.push({
            path: "last_test_run.failing_tests",
            message: "must be string[]",
          });
        }
      }
    }
    if (typeof raw.cycle_attempts !== "number" || raw.cycle_attempts < 0) {
      issues.push({
        path: "cycle_attempts",
        message: "must be a non-negative number",
      });
    }
    if (typeof raw.cycle_index !== "number" || raw.cycle_index < 0) {
      issues.push({
        path: "cycle_index",
        message: "must be a non-negative number",
      });
    }
    if (raw.pre_red !== undefined) {
      const pr = raw.pre_red;
      if (!isObj(pr)) {
        issues.push({
          path: "pre_red",
          message: "must be an object when present",
        });
      } else if (
        !Array.isArray(pr.allowed_paths) ||
        !pr.allowed_paths.every((x) => typeof x === "string")
      ) {
        issues.push({
          path: "pre_red.allowed_paths",
          message: "must be string[]",
        });
      }
    }
    if (raw.mutation_pass !== undefined) {
      const mp = raw.mutation_pass;
      if (!isObj(mp)) {
        issues.push({
          path: "mutation_pass",
          message: "must be an object when present",
        });
      } else {
        if (
          !Array.isArray(mp.allowed_paths) ||
          !mp.allowed_paths.every((x) => typeof x === "string")
        ) {
          issues.push({
            path: "mutation_pass.allowed_paths",
            message: "must be string[]",
          });
        }
        if (
          mp.current_mutation_id !== undefined &&
          typeof mp.current_mutation_id !== "string"
        ) {
          issues.push({
            path: "mutation_pass.current_mutation_id",
            message: "must be a string when present",
          });
        }
      }
    }
    if (
      raw.refactor_freshness_window_ms !== undefined &&
      (typeof raw.refactor_freshness_window_ms !== "number" ||
        raw.refactor_freshness_window_ms <= 0)
    ) {
      issues.push({
        path: "refactor_freshness_window_ms",
        message: "must be a positive number when present",
      });
    }
    if (issues.length > 0) return fail(issues);
    return ok(raw as unknown as State);
  },
};

/**
 * Validate the worker-reviewer state.json shape. Carried for back-compat
 * with worker-reviewer; tdd-execute should use StateSchema.
 */
export const WorkerReviewerStateSchema = {
  safeParse(raw: unknown): ValidationResult<WorkerReviewerState> {
    if (!isObj(raw)) {
      return fail([{ path: "", message: "must be an object" }]);
    }
    const issues: ValidationIssue[] = [];
    if (!isWorkerReviewerPhase(raw.phase)) {
      issues.push({
        path: "phase",
        message: `must be one of plan:draft|plan:review|impl:working|impl:review|complete (got ${JSON.stringify(raw.phase)})`,
      });
    }
    if (raw.currentTestIndex !== null && typeof raw.currentTestIndex !== "number") {
      issues.push({
        path: "currentTestIndex",
        message: "must be number or null",
      });
    }
    if (raw.totalTests !== null && typeof raw.totalTests !== "number") {
      issues.push({
        path: "totalTests",
        message: "must be number or null",
      });
    }
    if (raw.startedAt !== null && typeof raw.startedAt !== "string") {
      issues.push({
        path: "startedAt",
        message: "must be string or null",
      });
    }
    if (issues.length > 0) return fail(issues);
    return ok(raw as unknown as WorkerReviewerState);
  },
};

// ---- IO ------------------------------------------------------------------

export const STATE_FILENAME = "state.json";

function statePath(workspace: string): string {
  return join(workspace, STATE_FILENAME);
}

function ensureWorkspace(workspace: string): void {
  if (!existsSync(workspace)) {
    mkdirSync(workspace, { recursive: true });
  }
}

/**
 * Read and validate state.json from workspace as the tdd-execute schema.
 * Throws on missing file or schema mismatch.
 */
export function readState(workspace: string): State {
  const p = statePath(workspace);
  if (!existsSync(p)) {
    throw new Error(`state.json not found at ${p}`);
  }
  const raw = JSON.parse(readFileSync(p, "utf-8"));
  return StateSchema.parse(raw);
}

/**
 * Read state.json without enforcing a schema — returns whatever JSON is in
 * the file or null if missing/unparseable. Useful for tools that need to
 * accept either schema (the validate-submission hook).
 */
export function readStateRaw(workspace: string): unknown | null {
  const p = statePath(workspace);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

/** Write tdd-execute state.json (validated against the memo schema). */
export function writeState(workspace: string, s: State): void {
  StateSchema.parse(s); // throw if caller passed garbage
  ensureWorkspace(workspace);
  writeFileSync(statePath(workspace), JSON.stringify(s, null, 2));
}

/**
 * Write any state object as JSON without schema validation. For
 * worker-reviewer back-compat.
 */
export function writeStateRaw(workspace: string, s: unknown): void {
  ensureWorkspace(workspace);
  writeFileSync(statePath(workspace), JSON.stringify(s, null, 2));
}

// ---- Workspace discovery -------------------------------------------------

const MAX_CLIMB = 12;

/**
 * Walk up from `startPath` looking for a `.tdd-execute/<slice-id>/state.json`.
 * Returns the absolute path to that state.json (NOT the workspace dir — see
 * the original design memo: "climbs from a file path looking for
 * `.tdd-execute/<slice-id>/state.json` for any slice-id"). Returns null if
 * no such file is found within MAX_CLIMB ancestors.
 *
 * If startPath is itself a file path, its directory is the start; if it's a
 * directory, we start from it directly.
 */
export function climbToWorkspace(startPath: string): string | null {
  let dir: string;
  try {
    const st = statSync(startPath);
    dir = st.isDirectory() ? startPath : dirname(startPath);
  } catch {
    // Path doesn't exist on disk — that's fine; treat as a file path.
    dir = dirname(startPath);
  }

  for (let i = 0; i < MAX_CLIMB; i++) {
    const tddDir = join(dir, ".tdd-execute");
    if (existsSync(tddDir)) {
      try {
        const st = statSync(tddDir);
        if (st.isDirectory()) {
          // Look for any subdirectory containing state.json.
          for (const entry of readdirSync(tddDir)) {
            const candidate = join(tddDir, entry, STATE_FILENAME);
            if (existsSync(candidate)) {
              return candidate;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Looser variant used by worker-reviewer: walk up from startPath looking
 * for any directory with a state.json directly in it. Returns that
 * directory (the workspace dir), or null if none found.
 *
 * Mirrors the legacy behaviour of `validate-submission.ts`'s
 * `getWorkspaceDir`.
 */
export function climbToStateJson(startPath: string): string | null {
  let dir: string;
  try {
    const st = statSync(startPath);
    dir = st.isDirectory() ? startPath : dirname(startPath);
  } catch {
    dir = dirname(startPath);
  }

  for (let i = 0; i < MAX_CLIMB; i++) {
    if (existsSync(join(dir, STATE_FILENAME))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
