import { describe, expect, test } from "bun:test";
import { buildFleetCommand } from "./index";
import { buildFleetSnapshotCommand } from "./commands/snapshot";

describe("buildFleetCommand", () => {
  test("registers top-level options", () => {
    const cmd = buildFleetCommand();
    expect(cmd.name()).toBe("fleet");
    const flags = cmd.options.map((o) => o.long);
    expect(flags).toContain("--json");
    expect(flags).toContain("--only-blocked");
    expect(flags).toContain("--include-cwd");
  });

  test("registers snapshot subcommand", () => {
    const cmd = buildFleetCommand();
    const subNames = cmd.commands.map((c) => c.name());
    expect(subNames).toContain("snapshot");
  });
});

describe("buildFleetSnapshotCommand", () => {
  test("registers snapshot options", () => {
    const cmd = buildFleetSnapshotCommand();
    const flags = cmd.options.map((o) => o.long);
    expect(flags).toContain("--output");
    expect(flags).toContain("--only-blocked");
    expect(flags).toContain("--include-cwd");
  });
});
