#!/usr/bin/env bun
/**
 * Worker-Reviewer Validation Hook
 *
 * Intercepts writes to submission.md and test-plan.md, validates YAML frontmatter,
 * updates state, and logs events.
 *
 * Usage: Used as a skill-specific hook in .claude/skills/worker-reviewer/SKILL.md
 *
 * Workspace is determined by:
 * 1. WR_WORKSPACE env var (if set)
 * 2. Inferred from file path (looks for parent dir with state.json)
 */

import { parse as parseYaml } from "yaml";
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname, basename, join } from "path";

interface HookInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    content?: string;
  };
  session_id?: string;
}

interface ValidationError {
  field: string;
  message: string;
  expected?: string;
}

interface State {
  phase: string;
  currentTestIndex: number | null;
  totalTests: number | null;
  startedAt: string;
}

interface TestPlan {
  tests: Array<{
    index: number;
    name: string;
    description: string;
    acceptanceCriteria?: string[];
  }>;
}

// --- Workspace Discovery ---

function getWorkspaceDir(filePath: string): string | null {
  // First, check env var
  if (process.env.WR_WORKSPACE) {
    return process.env.WR_WORKSPACE;
  }

  // Infer from file path - look for a directory containing state.json
  let dir = dirname(filePath);
  for (let i = 0; i < 5; i++) {  // Look up to 5 levels
    if (existsSync(join(dir, "state.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;  // Reached root
    dir = parent;
  }

  return null;
}

// --- YAML Frontmatter Parsing ---

function extractFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } | null {
  if (!content.startsWith("---")) {
    return null;
  }

  const lines = content.split("\n");
  let closingIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return null;
  }

  const frontmatterText = lines.slice(1, closingIndex).join("\n");
  const body = lines.slice(closingIndex + 1).join("\n");

  try {
    const frontmatter = parseYaml(frontmatterText) as Record<string, unknown>;
    return { frontmatter, body };
  } catch {
    return null;
  }
}

// --- State Management ---

function getStatePath(workspaceDir: string): string {
  return join(workspaceDir, "state.json");
}

function getEventsPath(workspaceDir: string): string {
  return join(workspaceDir, "events.jsonl");
}

function getTestPlanPath(workspaceDir: string): string {
  return join(workspaceDir, "test-plan.md");
}

function readState(workspaceDir: string): State | null {
  const statePath = getStatePath(workspaceDir);
  if (!existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeState(workspaceDir: string, state: State): void {
  ensureWorkspaceExists(workspaceDir);
  writeFileSync(getStatePath(workspaceDir), JSON.stringify(state, null, 2));
}

function appendEvent(workspaceDir: string, event: Record<string, unknown>): void {
  ensureWorkspaceExists(workspaceDir);
  const eventWithTs = { ts: new Date().toISOString(), ...event };
  appendFileSync(getEventsPath(workspaceDir), JSON.stringify(eventWithTs) + "\n");
}

function ensureWorkspaceExists(workspaceDir: string): void {
  if (!existsSync(workspaceDir)) {
    mkdirSync(workspaceDir, { recursive: true });
  }
}

function readTestPlan(workspaceDir: string): TestPlan | null {
  const planPath = getTestPlanPath(workspaceDir);
  if (!existsSync(planPath)) {
    return null;
  }
  try {
    const content = readFileSync(planPath, "utf-8");
    const parsed = extractFrontmatter(content);
    if (!parsed) return null;
    return parsed.frontmatter as unknown as TestPlan;
  } catch {
    return null;
  }
}

// --- Validation Logic ---

function validateTestPlanSubmission(frontmatter: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required: phase
  if (frontmatter.phase !== "plan") {
    errors.push({
      field: "phase",
      message: "Must be 'plan' for test plan submissions",
      expected: "plan"
    });
  }

  // Required: iteration
  if (typeof frontmatter.iteration !== "number" || frontmatter.iteration < 1) {
    errors.push({
      field: "iteration",
      message: "Must be a positive number",
      expected: "e.g., 1"
    });
  }

  // Required: testPlan with tests array
  const testPlan = frontmatter.testPlan as Record<string, unknown> | undefined;
  if (!testPlan || typeof testPlan !== "object") {
    errors.push({
      field: "testPlan",
      message: "Required object with 'tests' array",
      expected: "testPlan:\n  tests:\n    - index: 0\n      name: test name\n      description: what it tests"
    });
  } else {
    const tests = testPlan.tests as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(tests) || tests.length === 0) {
      errors.push({
        field: "testPlan.tests",
        message: "Must be a non-empty array of tests",
        expected: "tests:\n  - index: 0\n    name: test name\n    description: what it tests"
      });
    } else {
      // Validate each test
      tests.forEach((test, i) => {
        if (typeof test.index !== "number") {
          errors.push({ field: `testPlan.tests[${i}].index`, message: "Must be a number" });
        }
        if (typeof test.name !== "string" || !test.name) {
          errors.push({ field: `testPlan.tests[${i}].name`, message: "Must be a non-empty string" });
        }
        if (typeof test.description !== "string" || !test.description) {
          errors.push({ field: `testPlan.tests[${i}].description`, message: "Must be a non-empty string" });
        }
      });
    }
  }

  return errors;
}

function validateImplSubmission(frontmatter: Record<string, unknown>, state: State, testPlan: TestPlan): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required: phase
  if (frontmatter.phase !== "impl") {
    errors.push({
      field: "phase",
      message: "Must be 'impl' for implementation submissions",
      expected: "impl"
    });
  }

  // Required: iteration
  if (typeof frontmatter.iteration !== "number" || frontmatter.iteration < 1) {
    errors.push({
      field: "iteration",
      message: "Must be a positive number",
      expected: "e.g., 3"
    });
  }

  // Required: targetTest
  const targetTest = frontmatter.targetTest as Record<string, unknown> | undefined;
  if (!targetTest || typeof targetTest !== "object") {
    errors.push({
      field: "targetTest",
      message: "Required object with 'index' and 'name'",
      expected: "targetTest:\n  index: 2\n  name: converts headings"
    });
  } else {
    if (typeof targetTest.index !== "number") {
      errors.push({ field: "targetTest.index", message: "Must be a number" });
    } else if (state.currentTestIndex !== null && targetTest.index !== state.currentTestIndex) {
      errors.push({
        field: "targetTest.index",
        message: `Must match current test index from state`,
        expected: `${state.currentTestIndex} (current test), got ${targetTest.index}`
      });
    }
    if (typeof targetTest.name !== "string" || !targetTest.name) {
      errors.push({ field: "targetTest.name", message: "Must be a non-empty string" });
    }
  }

  // Required: testResults for ALL tests
  const testResults = frontmatter.testResults as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(testResults)) {
    errors.push({
      field: "testResults",
      message: "Must be an array with status for ALL tests",
      expected: "testResults:\n  - index: 0\n    name: test name\n    status: pass\n  - index: 1\n    name: other test\n    status: fail"
    });
  } else {
    // Check all tests are covered
    const reportedIndices = new Set(testResults.map(r => r.index));
    const missingIndices: number[] = [];

    testPlan.tests.forEach(test => {
      if (!reportedIndices.has(test.index)) {
        missingIndices.push(test.index);
      }
    });

    if (missingIndices.length > 0) {
      errors.push({
        field: "testResults",
        message: `Missing status for test indices: ${missingIndices.join(", ")}`,
        expected: `Report status for ALL ${testPlan.tests.length} tests`
      });
    }

    // Validate each result
    testResults.forEach((result, i) => {
      if (typeof result.index !== "number") {
        errors.push({ field: `testResults[${i}].index`, message: "Must be a number" });
      }
      if (typeof result.status !== "string" || !["pass", "fail"].includes(result.status)) {
        errors.push({ field: `testResults[${i}].status`, message: "Must be 'pass' or 'fail'" });
      }
    });

    // Target test should pass
    if (targetTest && typeof targetTest.index === "number") {
      const targetResult = testResults.find(r => r.index === targetTest.index);
      if (targetResult && targetResult.status !== "pass") {
        errors.push({
          field: `testResults[${targetTest.index}].status`,
          message: "Target test should pass before submitting",
          expected: "pass (don't submit until the test you're implementing passes)"
        });
      }
    }
  }

  // Required: filesChanged
  const filesChanged = frontmatter.filesChanged as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(filesChanged) || filesChanged.length === 0) {
    errors.push({
      field: "filesChanged",
      message: "Must list at least one changed file",
      expected: "filesChanged:\n  - path: src/md2html.ts\n    action: modified"
    });
  }

  return errors;
}

// --- Error Formatting ---

function formatErrors(errors: ValidationError[], phase: "plan" | "impl"): string {
  let msg = `❌ submission.md validation failed:\n\n`;

  errors.forEach(err => {
    msg += `• ${err.field}: ${err.message}\n`;
    if (err.expected) {
      msg += `  Expected: ${err.expected}\n`;
    }
    msg += "\n";
  });

  if (phase === "plan") {
    msg += `\n--- Expected Format (Plan Phase) ---\n`;
    msg += `---
phase: plan
iteration: 1
testPlan:
  tests:
    - index: 0
      name: shows help with --help flag
      description: Running md2html --help prints usage and exits 0
      acceptanceCriteria: ["4"]
    - index: 1
      name: exits with error for missing file
      description: Running md2html nonexistent.md exits 1
      acceptanceCriteria: ["5"]
---

## Rationale

Explanation of test order...
`;
  } else {
    msg += `\n--- Expected Format (Impl Phase) ---\n`;
    msg += `---
phase: impl
iteration: 3
targetTest:
  index: 2
  name: converts headings
testResults:
  - index: 0
    name: shows help
    status: pass
  - index: 1
    name: error handling
    status: pass
  - index: 2
    name: converts headings
    status: pass
  - index: 3
    name: converts paragraphs
    status: fail
filesChanged:
  - path: src/md2html.ts
    action: modified
---

## Summary

What you implemented...
`;
  }

  msg += `\nFix these issues and retry.`;
  return msg;
}

// --- Main Hook Logic ---

async function main() {
  // Read input from stdin
  const chunks: string[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(new TextDecoder().decode(chunk));
  }
  const inputText = chunks.join("");

  let input: HookInput;
  try {
    input = JSON.parse(inputText);
  } catch {
    // Not valid JSON, pass through
    process.exit(0);
  }

  // Only handle Write tool
  if (input.tool_name !== "Write") {
    process.exit(0);
  }

  const filePath = input.tool_input.file_path || "";
  const content = input.tool_input.content || "";
  const fileName = basename(filePath);

  // Only validate submission.md and test-plan.md
  if (fileName !== "submission.md" && fileName !== "test-plan.md") {
    process.exit(0);
  }

  // Find workspace directory
  const workspaceDir = getWorkspaceDir(filePath);
  if (!workspaceDir) {
    // No workspace found - this file isn't in a worker-reviewer workspace
    process.exit(0);
  }

  // Parse frontmatter
  const parsed = extractFrontmatter(content);
  if (!parsed) {
    const output = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `❌ ${fileName} must have YAML frontmatter.\n\nExpected format:\n---\nphase: plan\niteration: 1\n...\n---\n\n## Body content here\n\nFix and retry.`
      }
    };
    console.log(JSON.stringify(output));
    process.exit(0);
  }

  const { frontmatter } = parsed;
  const state = readState(workspaceDir);
  const testPlan = readTestPlan(workspaceDir);

  let errors: ValidationError[] = [];
  let phase: "plan" | "impl" = "plan";

  if (fileName === "submission.md") {
    // Determine phase from frontmatter
    if (frontmatter.phase === "impl") {
      phase = "impl";
      if (!testPlan) {
        const output = {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `❌ Cannot submit impl phase without approved test-plan.md.\n\nThe test plan must be approved first. Current phase should be 'plan'.`
          }
        };
        console.log(JSON.stringify(output));
        process.exit(0);
      }
      if (!state) {
        const output = {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `❌ No state.json found. Initialize workspace first.`
          }
        };
        console.log(JSON.stringify(output));
        process.exit(0);
      }
      errors = validateImplSubmission(frontmatter, state, testPlan);
    } else {
      phase = "plan";
      errors = validateTestPlanSubmission(frontmatter);
    }
  } else if (fileName === "test-plan.md") {
    // test-plan.md uses same structure as plan submission
    phase = "plan";
    errors = validateTestPlanSubmission(frontmatter);
  }

  if (errors.length > 0) {
    const output = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: formatErrors(errors, phase)
      }
    };
    console.log(JSON.stringify(output));
    process.exit(0);
  }

  // Validation passed - update state and log event
  if (fileName === "submission.md") {
    if (phase === "plan") {
      // Plan submitted - update state to plan:review
      const newState: State = {
        phase: "plan:review",
        currentTestIndex: null,
        totalTests: (frontmatter.testPlan as { tests: unknown[] })?.tests?.length || null,
        startedAt: state?.startedAt || new Date().toISOString()
      };
      writeState(workspaceDir, newState);
      appendEvent(workspaceDir, {
        actor: "worker",
        event: "plan-submitted",
        testCount: newState.totalTests
      });
      appendEvent(workspaceDir, {
        actor: "hook",
        event: "validation-passed",
        file: "submission.md",
        phase: "plan"
      });
    } else {
      // Impl submitted - update state to impl:review
      const newState: State = {
        ...state!,
        phase: "impl:review"
      };
      writeState(workspaceDir, newState);

      const testResults = frontmatter.testResults as Array<{ status: string }>;
      const passingCount = testResults.filter(r => r.status === "pass").length;

      appendEvent(workspaceDir, {
        actor: "worker",
        event: "impl-submitted",
        testIndex: (frontmatter.targetTest as { index: number }).index,
        passingTests: passingCount,
        totalTests: state!.totalTests
      });
      appendEvent(workspaceDir, {
        actor: "hook",
        event: "validation-passed",
        file: "submission.md",
        phase: "impl"
      });
    }
  }

  // Allow the write
  process.exit(0);
}

main().catch(err => {
  console.error(`Hook error: ${err.message}`);
  process.exit(1);
});
