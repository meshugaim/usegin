import { describe, it, expect } from "bun:test";
import { isTestPath, isProductionPath } from "../src/test-globs";

describe("isTestPath", () => {
  it("identifies *.test.ts/tsx", () => {
    expect(isTestPath("nextjs-app/lib/foo.test.ts")).toBe(true);
    expect(isTestPath("/abs/path/Foo.test.tsx")).toBe(true);
    expect(isTestPath("foo.test.js")).toBe(true);
  });

  it("identifies *.spec.ts/tsx", () => {
    expect(isTestPath("foo.spec.ts")).toBe(true);
    expect(isTestPath("a/b/Foo.spec.tsx")).toBe(true);
  });

  it("identifies Python test files", () => {
    expect(isTestPath("python-services/tests/test_foo.py")).toBe(true);
    expect(isTestPath("python-services/foo_test.py")).toBe(true);
    expect(isTestPath("anywhere/test_thing.py")).toBe(true);
  });

  it("identifies files under tests/ / __tests__/", () => {
    expect(isTestPath("tests/foo.ts")).toBe(true);
    expect(isTestPath("nextjs-app/tests/integration/foo.ts")).toBe(true);
    expect(isTestPath("a/b/__tests__/foo.ts")).toBe(true);
    expect(isTestPath("test/utils.py")).toBe(true);
  });

  it("identifies pgTAP SQL tests under supabase/tests/", () => {
    expect(isTestPath("supabase/tests/policies/users.sql")).toBe(true);
    expect(isTestPath("/repo/supabase/tests/foo.sql")).toBe(true);
  });

  it("does NOT match production code", () => {
    expect(isTestPath("nextjs-app/lib/foo.ts")).toBe(false);
    expect(isTestPath("python-services/agent_api/main.py")).toBe(false);
    expect(isTestPath("supabase/migrations/0001.sql")).toBe(false);
    expect(isTestPath("README.md")).toBe(false);
  });

  it("does NOT match files merely named 'tested'", () => {
    expect(isTestPath("nextjs-app/lib/tested-fn.ts")).toBe(false);
  });

  it("handles Windows-style backslashes", () => {
    expect(isTestPath("a\\b\\foo.test.ts")).toBe(true);
    expect(isTestPath("a\\tests\\thing.ts")).toBe(true);
  });

  it("handles leading ./", () => {
    expect(isTestPath("./tests/foo.ts")).toBe(true);
    expect(isTestPath("./lib/foo.ts")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isTestPath("")).toBe(false);
  });
});

describe("isProductionPath", () => {
  it("returns true for ordinary source files", () => {
    expect(isProductionPath("nextjs-app/lib/foo.ts")).toBe(true);
    expect(isProductionPath("python-services/agent_api/main.py")).toBe(true);
    expect(isProductionPath("tools/tdd-shared/src/state.ts")).toBe(true);
  });

  it("returns false for test files", () => {
    expect(isProductionPath("foo.test.ts")).toBe(false);
    expect(isProductionPath("python-services/tests/test_x.py")).toBe(false);
  });

  it("returns false for build/vendor dirs", () => {
    expect(isProductionPath("node_modules/foo/index.js")).toBe(false);
    expect(isProductionPath("nextjs-app/.next/server/page.js")).toBe(false);
    expect(isProductionPath("dist/index.js")).toBe(false);
    expect(isProductionPath("build/output.js")).toBe(false);
    expect(isProductionPath(".venv/lib/python.py")).toBe(false);
    expect(isProductionPath("coverage/lcov.info")).toBe(false);
    expect(isProductionPath(".git/hooks/pre-commit")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isProductionPath("")).toBe(false);
  });

  it("works with absolute paths", () => {
    expect(isProductionPath("/workspaces/test-mvp/src/foo.ts")).toBe(true);
    expect(isProductionPath("/workspaces/test-mvp/node_modules/foo.ts")).toBe(false);
  });
});
