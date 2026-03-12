#!/usr/bin/env bun
/**
 * Auto-implement hook: Commit frequency gate
 *
 * PreToolUse hook for Edit/Write — blocks if >4 dirty files.
 * Forces the agent to commit frequently instead of batching work.
 *
 * Reads tool input from stdin (Claude Code PreToolUse protocol).
 *
 * Exit codes:
 *   0 = allow
 *   2 = deny (message on stderr)
 */

const MAX_DIRTY_FILES = 4;

interface ToolInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

async function main() {
  const input = await Bun.stdin.text();

  let toolInput: ToolInput;
  try {
    toolInput = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  // Only gate Edit and Write
  if (toolInput.tool_name !== "Edit" && toolInput.tool_name !== "Write") {
    process.exit(0);
  }

  // Count dirty files
  const result = await Bun.$`git status --porcelain`.quiet().nothrow();
  if (result.exitCode !== 0) {
    // If git status fails, allow (don't block on git errors)
    process.exit(0);
  }

  const lines = result.stdout
    .toString()
    .trim()
    .split("\n")
    .filter((line: string) => line.length > 0);
  const dirtyCount = lines.length;

  if (dirtyCount > MAX_DIRTY_FILES) {
    console.error(
      [
        "",
        `⛔ BLOCKED: ${dirtyCount} uncommitted files (max ${MAX_DIRTY_FILES}).`,
        "",
        "Commit your current changes before making more edits.",
        "This keeps commits small and frequent.",
        "",
        "  git add <files> && git commit -m 'message'",
        "",
      ].join("\n"),
    );
    process.exit(2);
  }

  process.exit(0);
}

main();
