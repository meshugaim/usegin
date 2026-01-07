import { describe, test, expect } from "bun:test";
import { createReplayCommand } from "../src/commands/replay";

describe("createReplayCommand", () => {
  test("creates a command named 'replay'", () => {
    const cmd = createReplayCommand();
    expect(cmd.name()).toBe("replay");
  });

  test("has required argument for replay-id", () => {
    const cmd = createReplayCommand();
    // Check command has the argument
    const args = (cmd as unknown as { _args: Array<{ name: () => string }> })._args;
    expect(args.length).toBeGreaterThan(0);
    expect(args[0].name()).toBe("replay-id");
  });

  test("has --org option with default value", () => {
    const cmd = createReplayCommand();
    const orgOption = cmd.options.find((o) => o.long === "--org");
    expect(orgOption).toBeDefined();
    expect(orgOption?.defaultValue).toBe("askeffi");
  });

  test("has --type option for filtering", () => {
    const cmd = createReplayCommand();
    const typeOption = cmd.options.find((o) => o.long === "--type");
    expect(typeOption).toBeDefined();
    expect(typeOption?.description).toContain("mutation");
    expect(typeOption?.description).toContain("click");
    expect(typeOption?.description).toContain("error");
    expect(typeOption?.description).toContain("hydration");
  });

  test("has --json option", () => {
    const cmd = createReplayCommand();
    const jsonOption = cmd.options.find((o) => o.long === "--json");
    expect(jsonOption).toBeDefined();
  });

  test("has --project option", () => {
    const cmd = createReplayCommand();
    const projOption = cmd.options.find((o) => o.long === "--project");
    expect(projOption).toBeDefined();
  });

  test("has description", () => {
    const cmd = createReplayCommand();
    expect(cmd.description()).toContain("replay");
  });
});
