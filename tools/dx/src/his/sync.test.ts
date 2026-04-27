import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

let tmpDir: string;
let dbA: string;
let dbB: string;
let stateDir: string;
let exportPath: string;

// This file lives at tools/dx/src/his/sync.test.ts → repo root is 4 dirs up.
const REPO_ROOT = join(import.meta.dir, "..", "..", "..", "..");
const dxBin = join(REPO_ROOT, "tools", "bin", "dx");
const baseEnv = (db: string) => ({
  ...process.env,
  DX_HIS_DB: db,
  DX_HIS_STATE_DIR: stateDir,
  DX_OUTPUT: "json",
  DX_HIS_QUIET: "1",
});

function run(env: Record<string, string>, args: string[]) {
  return spawnSync(dxBin, args, { env, encoding: "utf8" });
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "dx-his-sync-"));
  dbA = join(tmpDir, "a.db");
  dbB = join(tmpDir, "b.db");
  stateDir = join(tmpDir, "state");
  exportPath = join(tmpDir, "export.jsonl");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("dx his sync", () => {
  it("round-trips submissions across two stores", () => {
    // Seed machine A
    run({ ...baseEnv(dbA), CLAUDE_SESSION_ID: "s-a" }, [
      "his", "rate", "vibe=80", "accuracy=90", "--as=human", "--note", "from machine A",
    ]);
    run({ ...baseEnv(dbA), CLAUDE_SESSION_ID: "s-a" }, [
      "his", "rate", "friction_running_tests=70", "--as=claude", "--note", "tests slow on A",
    ]);

    // Export from A
    const ex = run(baseEnv(dbA), ["his", "sync", "export", exportPath, "--all"]);
    expect(ex.status).toBe(0);
    const lines = readFileSync(exportPath, "utf8").split("\n").filter(Boolean);
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).origin_host).toBeTruthy();

    // Import into B
    const im = run(baseEnv(dbB), ["his", "sync", "import", exportPath]);
    expect(im.status).toBe(0);
    const imOut = JSON.parse(im.stdout);
    expect(imOut.imported).toBe(2);
    expect(imOut.skipped).toBe(0);

    // Verify B has them
    const show = run({ ...baseEnv(dbB), CLAUDE_SESSION_ID: "s-a" }, ["his", "show"]);
    const shown = JSON.parse(show.stdout);
    expect(shown.submissions.length).toBe(2);
  });

  it("dedupes on re-import", () => {
    run({ ...baseEnv(dbA), CLAUDE_SESSION_ID: "s-d" }, [
      "his", "rate", "vibe=50", "--as=human",
    ]);
    run(baseEnv(dbA), ["his", "sync", "export", exportPath, "--all"]);

    const im1 = run(baseEnv(dbB), ["his", "sync", "import", exportPath]);
    expect(JSON.parse(im1.stdout).imported).toBe(1);

    const im2 = run(baseEnv(dbB), ["his", "sync", "import", exportPath]);
    const out2 = JSON.parse(im2.stdout);
    expect(out2.imported).toBe(0);
    expect(out2.skipped).toBe(1);
  });

  it("--dry-run reports without mutating", () => {
    run({ ...baseEnv(dbA), CLAUDE_SESSION_ID: "s-x" }, [
      "his", "rate", "vibe=70", "--as=human",
    ]);
    run(baseEnv(dbA), ["his", "sync", "export", exportPath, "--all"]);

    const dry = run(baseEnv(dbB), ["his", "sync", "import", exportPath, "--dry-run"]);
    expect(JSON.parse(dry.stdout).imported).toBe(1);
    expect(JSON.parse(dry.stdout).dry_run).toBe(true);

    // Now real import — should still see 1 to import (dry-run didn't write).
    const real = run(baseEnv(dbB), ["his", "sync", "import", exportPath]);
    expect(JSON.parse(real.stdout).imported).toBe(1);
  });
});
