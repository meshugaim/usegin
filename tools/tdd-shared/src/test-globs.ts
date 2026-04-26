/**
 * tdd-shared/test-globs — canonical lists for distinguishing test files
 * from production files. Used by the tdd-execute Edit-gating hook (design
 * memo §4c: "phase=red → file_path must match test-glob; else deny").
 *
 * We deliberately avoid bringing in minimatch / fast-glob: the patterns we
 * care about reduce cleanly to extension-and-segment regex matching, and
 * the hook runs synchronously on every Edit, so we want to keep it cheap.
 */

import { sep, posix } from "path";

/**
 * Glob-flavored patterns. Exported for documentation / cross-skill
 * reference; the actual matching is done by regex in `isTestPath`.
 */
export const TEST_GLOBS: readonly string[] = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.test.js",
  "**/*.test.jsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.spec.js",
  "**/*.spec.jsx",
  "**/test_*.py",
  "**/*_test.py",
  "**/tests/**",
  "**/test/**",
  "**/__tests__/**",
  // pgTAP
  "supabase/tests/**/*.sql",
];

/**
 * Production-path exclusions: dirs that aren't source code and aren't
 * tests either (build artefacts, vendor trees, generated output). Edits
 * to these don't represent "production code" for the TDD discipline.
 */
export const NON_PRODUCTION_GLOBS: readonly string[] = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/.venv/**",
  "**/venv/**",
  "**/__pycache__/**",
  "**/.turbo/**",
  "**/coverage/**",
  "**/.git/**",
];

// ---- Matching engine -----------------------------------------------------

/**
 * Normalise a path for matching: strip leading "./", convert backslashes
 * to forward slashes (Windows), drop a leading "/" so segment matchers
 * work the same on absolute and relative paths.
 */
function normalize(p: string): string {
  let s = p.replace(/\\/g, "/");
  if (s.startsWith("./")) s = s.slice(2);
  if (s.startsWith("/")) s = s.slice(1);
  return s;
}

/** Split into path segments. */
function segments(p: string): string[] {
  return normalize(p).split("/").filter(Boolean);
}

/** True iff filename ends with any of the test extensions. */
function hasTestExtension(filename: string): boolean {
  return (
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filename) ||
    /^test_.+\.py$/i.test(filename) ||
    /.+_test\.py$/i.test(filename)
  );
}

/** True iff path lives under a test directory (tests/, test/, __tests__/). */
function isUnderTestDir(path: string): boolean {
  const segs = segments(path);
  // Walk every segment; first match wins.
  for (const s of segs) {
    if (s === "tests" || s === "test" || s === "__tests__") return true;
  }
  return false;
}

/** True iff path is a pgTAP SQL test (supabase/tests/**\/*.sql). */
function isPgTapTest(path: string): boolean {
  const norm = normalize(path);
  return /(^|\/)supabase\/tests\/.+\.sql$/i.test(norm);
}

/**
 * True iff filePath represents a test file. Conservative: if any of
 *   - filename has .test/.spec extension
 *   - filename matches Python test_*.py or *_test.py
 *   - path lives under tests/, test/, or __tests__/
 *   - path is a pgTAP SQL test under supabase/tests/
 * matches, we count it as a test.
 *
 * Used by the Edit-gating hook to decide whether an Edit is "into a test"
 * or "into production." Both producers and consumers must agree on this
 * function — exporting it from tdd-shared is the point.
 */
export function isTestPath(filePath: string): boolean {
  if (!filePath) return false;
  const norm = normalize(filePath);
  const filename = norm.split("/").pop() ?? "";
  return (
    hasTestExtension(filename) ||
    isUnderTestDir(norm) ||
    isPgTapTest(norm)
  );
}

/**
 * True iff filePath looks like real production source — i.e., not a test
 * AND not under a build/vendor/generated dir. The Edit-gating hook uses
 * this in `phase=green` ("must NOT match test-glob") and the inverse
 * `phase=red` ("must match test-glob"), but tdd-execute's
 * "smallest production change" check also wants to filter out
 * node_modules edits cleanly — that's what this is for.
 */
export function isProductionPath(filePath: string): boolean {
  if (!filePath) return false;
  if (isTestPath(filePath)) return false;
  const segs = segments(filePath);
  for (const s of segs) {
    if (
      s === "node_modules" ||
      s === ".next" ||
      s === "dist" ||
      s === "build" ||
      s === "out" ||
      s === ".venv" ||
      s === "venv" ||
      s === "__pycache__" ||
      s === ".turbo" ||
      s === "coverage" ||
      s === ".git"
    ) {
      return false;
    }
  }
  return true;
}

// Re-export `sep`/`posix` so callers that want their own path-massaging
// don't have to reach into node:path themselves.
export { sep, posix };
