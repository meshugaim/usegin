#!/usr/bin/env bun
/**
 * Test the validate-submission hook
 * Run: bun tools/worker-reviewer-experiment/hooks/test-hook.ts
 */

import { spawn } from "bun";
import { join } from "path";

const HOOK_PATH = join(import.meta.dir, "validate-submission.ts");

interface TestCase {
  name: string;
  input: {
    tool_name: string;
    tool_input: {
      file_path: string;
      content: string;
    };
  };
  expectAllow: boolean;
  expectErrorContains?: string;
}

const testCases: TestCase[] = [
  {
    name: "Non-Write tool passes through",
    input: {
      tool_name: "Read",
      tool_input: { file_path: "/some/file", content: "" }
    },
    expectAllow: true
  },
  {
    name: "Write to unrelated file passes through",
    input: {
      tool_name: "Write",
      tool_input: {
        file_path: "/some/other/file.md",
        content: "whatever"
      }
    },
    expectAllow: true
  },
  {
    name: "submission.md without frontmatter is denied",
    input: {
      tool_name: "Write",
      tool_input: {
        file_path: "/workspaces/test-mvp/tools/worker-reviewer-experiment/workspace/submission.md",
        content: "No frontmatter here"
      }
    },
    expectAllow: false,
    expectErrorContains: "must have YAML frontmatter"
  },
  {
    name: "submission.md with invalid plan phase is denied",
    input: {
      tool_name: "Write",
      tool_input: {
        file_path: "/workspaces/test-mvp/tools/worker-reviewer-experiment/workspace/submission.md",
        content: `---
phase: plan
iteration: 1
---

No testPlan provided
`
      }
    },
    expectAllow: false,
    expectErrorContains: "testPlan"
  },
  {
    name: "submission.md with valid plan is allowed",
    input: {
      tool_name: "Write",
      tool_input: {
        file_path: "/workspaces/test-mvp/tools/worker-reviewer-experiment/workspace/submission.md",
        content: `---
phase: plan
iteration: 1
testPlan:
  tests:
    - index: 0
      name: shows help with --help flag
      description: Running md2html --help prints usage and exits 0
    - index: 1
      name: exits with error for missing file
      description: Running md2html nonexistent.md exits 1
---

## Rationale

Starting with CLI basics.
`
      }
    },
    expectAllow: true
  }
];

async function runTest(tc: TestCase): Promise<{ passed: boolean; message: string }> {
  const proc = spawn({
    cmd: ["bun", HOOK_PATH],
    stdin: new TextEncoder().encode(JSON.stringify(tc.input)),
    stdout: "pipe",
    stderr: "pipe"
  });

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  // Parse output if present
  let decision = "allow"; // default if no output
  let reason = "";

  if (stdout.trim()) {
    try {
      const output = JSON.parse(stdout);
      decision = output.hookSpecificOutput?.permissionDecision || "allow";
      reason = output.hookSpecificOutput?.permissionDecisionReason || "";
    } catch {
      // Not JSON, treat as allow
    }
  }

  const allowed = decision !== "deny" && exitCode === 0;

  if (tc.expectAllow && !allowed) {
    return {
      passed: false,
      message: `Expected allow but got deny: ${reason}`
    };
  }

  if (!tc.expectAllow && allowed) {
    return {
      passed: false,
      message: `Expected deny but was allowed`
    };
  }

  if (!tc.expectAllow && tc.expectErrorContains && !reason.includes(tc.expectErrorContains)) {
    return {
      passed: false,
      message: `Expected error to contain "${tc.expectErrorContains}" but got: ${reason.slice(0, 100)}...`
    };
  }

  return { passed: true, message: "OK" };
}

async function main() {
  console.log("Testing validate-submission hook\n");
  console.log("=".repeat(50));

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const result = await runTest(tc);
    if (result.passed) {
      console.log(`✓ ${tc.name}`);
      passed++;
    } else {
      console.log(`✗ ${tc.name}`);
      console.log(`  ${result.message}`);
      failed++;
    }
  }

  console.log("=".repeat(50));
  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
