#!/usr/bin/env bun
/**
 * Auto-implement hook: TDD order enforcement
 *
 * PreToolUse hook for Write/Edit — blocks writing implementation files
 * until at least one test file has been written since the last commit.
 *
 * This enforces test-first ordering (not just test-presence, which the
 * pre-commit hook handles). The agent must touch a test file before
 * touching an implementation file in each commit cycle.
 *
 * State is tracked in /tmp/auto-impl-tdd-state.json and resets
 * automatically when a new commit is detected (HEAD changes).
 *
 * Only active during auto-implement sessions (context file exists).
 *
 * Exit codes:
 *   0 = allow
 *   2 = deny (message on stderr)
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { $ } from "bun";

const STATE_FILE = "/tmp/auto-impl-tdd-state.json";

interface ToolInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
  };
}

interface TddState {
  test_files_written: string[];
  last_commit_sha: string;
}

// ---------------------------------------------------------------------------
// File classification — mirrors pre-commit-guard.sh patterns
// ---------------------------------------------------------------------------

function isTestFile(filePath: string): boolean {
  if (/\.(test|spec)\.(ts|tsx|py)$/.test(filePath)) return true;
  if (/\/tests\//.test(filePath)) return true;
  if (/test_.*\.py$/.test(filePath)) return true;
  if (/conftest\.py$/.test(filePath)) return true;
  // Feature files (Gherkin/Playwright e2e)
  if (/\.feature$/.test(filePath)) return true;
  return false;
}

function isImplFile(filePath: string): boolean {
  // Skip test files
  if (isTestFile(filePath)) return false;

  // Skip non-logic files
  if (/\.(css|scss|md|json|yaml|yml|svg|png|jpg|ico)$/.test(filePath)) return false;
  if (/\.d\.ts$/.test(filePath)) return false;
  if (/types\.ts$/.test(filePath)) return false;

  // Next.js actions/api
  if (/^nextjs-app\/app\/(actions|api)\//.test(filePath)) return true;

  // Next.js app-level components (not route files)
  if (/^nextjs-app\/app\/.*\.tsx?$/.test(filePath)) {
    if (/\/(layout|page|loading|error|not-found)\.tsx$/.test(filePath)) return false;
    return true;
  }

  // Next.js lib/hooks/components
  if (/^nextjs-app\/(lib|hooks|components)\/.*\.(ts|tsx)$/.test(filePath)) return true;

  // Python services
  if (/^python-services\/agent_api\/.*\.py$/.test(filePath)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

async function getCurrentCommitSha(): Promise<string> {
  const result = await $`git rev-parse HEAD`.quiet().nothrow();
  if (result.exitCode !== 0) return "unknown";
  return result.stdout.toString().trim();
}

function readState(): TddState {
  try {
    if (!existsSync(STATE_FILE)) {
      return { test_files_written: [], last_commit_sha: "" };
    }
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { test_files_written: [], last_commit_sha: "" };
  }
}

function writeState(state: TddState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // This hook is only installed during auto-implement sessions (via lifecycle.ts).
  // Its presence in settings.local.json IS the activation signal.
  // No context-file check — the agent can't disarm the guard by deleting a file.

  const input = await Bun.stdin.text();

  let toolInput: ToolInput;
  try {
    toolInput = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  // Only gate Write and Edit
  if (toolInput.tool_name !== "Write" && toolInput.tool_name !== "Edit") {
    process.exit(0);
  }

  const filePath = toolInput.tool_input.file_path;
  if (!filePath) {
    process.exit(0);
  }

  // Make path relative to repo root for pattern matching
  const repoRoot = "/workspaces/test-mvp/";
  const relativePath = filePath.startsWith(repoRoot)
    ? filePath.slice(repoRoot.length)
    : filePath;

  // Read current state
  let state = readState();

  // Reset state if a new commit has been made (HEAD changed)
  const currentSha = await getCurrentCommitSha();
  if (state.last_commit_sha !== currentSha) {
    state = { test_files_written: [], last_commit_sha: currentSha };
    writeState(state);
  }

  // Test files: record and allow
  if (isTestFile(relativePath)) {
    if (!state.test_files_written.includes(relativePath)) {
      state.test_files_written.push(relativePath);
      writeState(state);
    }
    process.exit(0);
  }

  // Non-implementation files (config, types, migrations, etc.): allow
  if (!isImplFile(relativePath)) {
    process.exit(0);
  }

  // Implementation file: check if tests have been written since last commit
  if (state.test_files_written.length === 0) {
    console.error(
      [
        "",
        `⛔ TDD ORDER: Write failing tests first.`,
        "",
        `You're trying to write an implementation file:`,
        `  ${relativePath}`,
        "",
        `But no test files have been written since the last commit.`,
        `TDD means tests come FIRST, then implementation.`,
        "",
        `Write your test file first, watch it fail, then implement.`,
        `Once you've written at least one test file, this gate opens.`,
        "",
      ].join("\n"),
    );
    process.exit(2);
  }

  // Tests exist in this cycle — allow implementation
  process.exit(0);
}

main();
