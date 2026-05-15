import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFleetCommand, runFleet } from "./index";
import {
  buildFleetSnapshotCommand,
  runSnapshot,
} from "./commands/snapshot";

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

describe("runFleet / runSnapshot integration", () => {
  let prevHome: string | undefined;
  let home: string;

  beforeEach(() => {
    prevHome = process.env.HOME;
    home = mkdtempSync(join(tmpdir(), "dx-fleet-cmd-"));
    mkdirSync(join(home, ".claude", "jobs", "aaaa1111"), { recursive: true });
    mkdirSync(join(home, ".claude", "sessions"), { recursive: true });
    writeFileSync(
      join(home, ".claude", "jobs", "aaaa1111", "state.json"),
      JSON.stringify({
        state: "blocked",
        tempo: "blocked",
        intent: "test intent",
        needs: "test needs",
        sessionId: "aaaa1111-full",
        cwd: "/workspaces/test-mvp",
        updatedAt: new Date().toISOString(),
      }),
    );
    mkdirSync(join(home, ".claude", "jobs", "bbbb2222"), { recursive: true });
    writeFileSync(
      join(home, ".claude", "jobs", "bbbb2222", "state.json"),
      JSON.stringify({
        state: "working",
        intent: "other intent",
        cwd: "/other",
        updatedAt: new Date().toISOString(),
      }),
    );
    process.env.HOME = home;
  });

  afterEach(() => {
    if (prevHome !== undefined) process.env.HOME = prevHome;
    else delete process.env.HOME;
  });

  test("runFleet returns rows from seeded registries with no filters", () => {
    const { rows } = runFleet({});
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.jobId).sort()).toEqual(["aaaa1111", "bbbb2222"]);
  });

  test("runFleet applies --only-blocked and --include-cwd together", () => {
    const { rows } = runFleet({
      onlyBlocked: true,
      includeCwd: "/workspaces",
    });
    expect(rows.map((r) => r.jobId)).toEqual(["aaaa1111"]);
  });

  test("runSnapshot writes a markdown file at --output and returns the abs path", () => {
    const outPath = join(home, "snap.md");
    const result = runSnapshot({ output: outPath });
    expect(result).toBe(outPath);
    expect(existsSync(outPath)).toBe(true);
    const md = readFileSync(outPath, "utf-8");
    expect(md).toContain("# Fleet snapshot");
    expect(md).toContain("aaaa1111");
    expect(md).toContain("bbbb2222");
  });

  test("runSnapshot honors --only-blocked when writing", () => {
    const outPath = join(home, "snap-blocked.md");
    runSnapshot({ output: outPath, onlyBlocked: true });
    const md = readFileSync(outPath, "utf-8");
    expect(md).toContain("aaaa1111");
    expect(md).not.toContain("bbbb2222");
  });
});
