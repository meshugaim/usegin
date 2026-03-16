#!/usr/bin/env bun
/**
 * Build-orchestrate skill hook: blocks bare Agent calls.
 *
 * The build director must use TeamCreate for any agent that needs to
 * orchestrate (liaison, research director, etc.). Plain Agent subagents
 * cannot spawn further agents — the Agent tool is unavailable inside them.
 *
 * To use Agent for simple leaf tasks (reviewers, verifiers, readers),
 * include [leaf] in the description field.
 *
 * Exit codes:
 *   0 — allow (has [leaf] flag)
 *   2 — block with guidance message
 */

interface HookInput {
  tool_name: string;
  tool_input: {
    description?: string;
    prompt?: string;
    team_name?: string;
    [key: string]: unknown;
  };
}

async function main() {
  const input = await Bun.stdin.text();

  let hookInput: HookInput;
  try {
    hookInput = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  // Only applies to Agent/Task tool calls
  if (hookInput.tool_name !== "Agent" && hookInput.tool_name !== "Task") {
    process.exit(0);
  }

  // If spawning into a team (team_name set), this is already a TeamCreate
  // member spawn — allow it, the agent will have full tools
  if (hookInput.tool_input.team_name) {
    process.exit(0);
  }

  const description = hookInput.tool_input.description ?? "";

  // Check for [leaf] flag in description
  if (description.includes("[leaf]")) {
    process.exit(0);
  }

  // Block with guidance
  const message = [
    "BLOCKED: Agent calls require intent declaration under /build-orchestrate.",
    "",
    "Agent subagents cannot spawn further agents (no Agent tool inside subagents).",
    "",
    "  Orchestrators (liaison, research director):  use TeamCreate + Agent(team_name=...)",
    "  Leaf agents (reviewer, verifier, reader):    add [leaf] to your description",
    "",
    'Example: description: "[leaf] Code review Slice 1"',
  ].join("\n");

  process.stderr.write(message);
  process.exit(2);
}

main();
