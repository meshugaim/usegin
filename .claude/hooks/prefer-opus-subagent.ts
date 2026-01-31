#!/usr/bin/env bun
/**
 * Claude Code PreToolUse hook: Reminds about Opus preference for subagents.
 *
 * When the Task tool is used with a non-Opus model, outputs a brief reminder
 * about the project preference for Opus in subagents.
 *
 * Does NOT block - just adds context to encourage better reasoning.
 */

interface ToolInput {
  tool_name: string;
  tool_input: {
    model?: string;
    [key: string]: unknown;
  };
}

// Model identifiers that indicate Opus
const OPUS_PATTERNS = [
  /opus/i,
  /claude-opus/i,
];

function isOpusModel(model: string): boolean {
  return OPUS_PATTERNS.some(pattern => pattern.test(model));
}

async function main() {
  // Read tool input from stdin
  const input = await Bun.stdin.text();

  let toolInput: ToolInput;
  try {
    toolInput = JSON.parse(input);
  } catch {
    // Can't parse input, allow the command
    process.exit(0);
  }

  // Only check Task tool calls
  if (toolInput.tool_name !== "Task") {
    process.exit(0);
  }

  const model = toolInput.tool_input.model;

  // No model specified - that's fine, it will use default
  if (!model) {
    process.exit(0);
  }

  // Check if it's an Opus model
  if (isOpusModel(model)) {
    process.exit(0);
  }

  // Non-Opus model specified - output reminder via additionalContext
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: `Note: This subagent uses "${model}". Per project guidelines, Opus is preferred for subagents for better reasoning.`
    }
  };
  console.log(JSON.stringify(output));

  // Exit 0 to allow the call (just a reminder, not a block)
  process.exit(0);
}

main();
