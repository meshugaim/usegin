/**
 * Tests for buildFzfDeleteCommands — the pure function that constructs
 * shell commands for fzf's ctrl-x delete-and-reload binding.
 */

import { describe, it, expect } from "bun:test";
import { buildFzfDeleteCommands } from "./find";
import { parseFindArgs } from "../cli-args";

// Helper: build commands from raw CLI args
function commandsFrom(args: string[]) {
  return buildFzfDeleteCommands(parseFindArgs(args));
}

// =============================================================================
// buildFzfDeleteCommands
// =============================================================================

describe("buildFzfDeleteCommands", () => {
  // -------------------------------------------------------------------------
  // Delete command structure
  // -------------------------------------------------------------------------

  it("delete command includes 'rm --yes' to skip confirmation", () => {
    const { deleteCommand } = commandsFrom([]);
    expect(deleteCommand).toContain("rm --yes");
  });

  it("delete command pipes fzf selection through tail to extract path", () => {
    const { deleteCommand } = commandsFrom([]);
    expect(deleteCommand).toContain("echo {}");
    expect(deleteCommand).toContain("tail -1");
    expect(deleteCommand).toContain("xargs");
  });

  // -------------------------------------------------------------------------
  // Reload command structure
  // -------------------------------------------------------------------------

  it("reload command includes --fzf-entries for internal reload mode", () => {
    const { reloadCommand } = commandsFrom([]);
    expect(reloadCommand).toContain("--fzf-entries");
  });

  it("reload command invokes 'find' subcommand", () => {
    const { reloadCommand } = commandsFrom([]);
    expect(reloadCommand).toContain("find");
  });

  // -------------------------------------------------------------------------
  // Default flags (no project, no since, no remote)
  // -------------------------------------------------------------------------

  it("default flags: reload has only --fzf-entries", () => {
    const { reloadCommand } = commandsFrom([]);
    // Should contain --fzf-entries but not --all-projects, --project, --since, --remote
    expect(reloadCommand).toContain("--fzf-entries");
    expect(reloadCommand).not.toContain("--all-projects");
    expect(reloadCommand).not.toContain("--project");
    expect(reloadCommand).not.toContain("--since");
    expect(reloadCommand).not.toContain("--remote");
  });

  // -------------------------------------------------------------------------
  // Individual flags
  // -------------------------------------------------------------------------

  it("--all-projects flag is passed through to reload command", () => {
    const { reloadCommand } = commandsFrom(["--all-projects"]);
    expect(reloadCommand).toContain("--all-projects");
  });

  it("--project flag and value are passed through to reload command", () => {
    const { reloadCommand } = commandsFrom(["--project", "my-project"]);
    expect(reloadCommand).toContain("--project");
    expect(reloadCommand).toContain("my-project");
  });

  it("--since flag and value are passed through to reload command", () => {
    const { reloadCommand } = commandsFrom(["--since", "7d"]);
    expect(reloadCommand).toContain("--since");
    expect(reloadCommand).toContain("7d");
  });

  it("--remote flag is passed through to reload command", () => {
    const { reloadCommand } = commandsFrom(["--remote"]);
    expect(reloadCommand).toContain("--remote");
  });

  // -------------------------------------------------------------------------
  // Multiple flags combined
  // -------------------------------------------------------------------------

  it("multiple flags are all passed through together", () => {
    const { reloadCommand } = commandsFrom([
      "--all-projects",
      "--since", "2w",
      "--remote",
    ]);
    expect(reloadCommand).toContain("--all-projects");
    expect(reloadCommand).toContain("--since");
    expect(reloadCommand).toContain("2w");
    expect(reloadCommand).toContain("--remote");
    expect(reloadCommand).toContain("--fzf-entries");
  });

  it("--project and --since combined", () => {
    const { reloadCommand } = commandsFrom([
      "--project", "foo",
      "--since", "3d",
    ]);
    expect(reloadCommand).toContain("--project");
    expect(reloadCommand).toContain("foo");
    expect(reloadCommand).toContain("--since");
    expect(reloadCommand).toContain("3d");
  });

  // -------------------------------------------------------------------------
  // Flags that should NOT leak into reload command
  // -------------------------------------------------------------------------

  it("--no-preview does not leak into reload command", () => {
    const { reloadCommand } = commandsFrom(["--no-preview"]);
    expect(reloadCommand).not.toContain("--no-preview");
  });

  it("--output does not leak into reload command", () => {
    const { reloadCommand } = commandsFrom(["--output", "json"]);
    expect(reloadCommand).not.toContain("--output");
    expect(reloadCommand).not.toContain("json");
  });
});
