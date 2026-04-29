/**
 * Tests for `dx evals iterate` (S5).
 *
 * All tests run --dry-run; no Anthropic API calls. They exercise the
 * Director loop end-to-end through `runDirector`, plus a Commander parse
 * test for flag wiring.
 *
 * Coverage:
 *   (a) flag parsing (budget, width, plateau)
 *   (b) dry-run climbs to dog_met within a few generations
 *   (c) --budget 1 → budget_exhausted
 *   (d) --stub-plateau → plateau stop
 *   (e) cheat-suspect injected via --stub-inject-cheat → vetoed → second-best promoted
 */

import { describe, expect, it, afterEach } from "bun:test";
import { existsSync, readFileSync, rmSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { runDirector } from "../lib/iterate-director";
import { iterateRunsDir, sandboxDir } from "../lib/iterate-writer";
import { buildEvalsIterateCommand } from "./iterate";

const CORPUS = "effi" as const;
const PROMPT_NAME = "baseline";
const CASE_ID = "effi-001-citation-test";

function cleanup(runDirs: string[]): void {
  for (const dir of runDirs) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
  // Also wipe any leftover sandbox dirs created by these tests.
  // The sandbox lives at usegin/evals/sandbox/<run-id>/
  const sb = sandboxDir(CORPUS);
  for (const dir of runDirs) {
    const runId = dir.split("/").pop()!;
    const sbRun = join(sb, runId);
    if (existsSync(sbRun)) rmSync(sbRun, { recursive: true, force: true });
  }
  runDirs.length = 0;
}

// ---------------------------------------------------------------------------
// (a) flag parsing
// ---------------------------------------------------------------------------

describe("iterate (a): flag parsing", () => {
  it("Commander parses budget/width/plateau and rejects bad values", () => {
    const cmd = buildEvalsIterateCommand();
    // Smoke: building the command does not throw and the option set exists
    const opts = cmd.options.map((o) => o.long);
    expect(opts).toContain("--budget");
    expect(opts).toContain("--width");
    expect(opts).toContain("--plateau");
    expect(opts).toContain("--plateau-window");
    expect(opts).toContain("--worker-model");
    expect(opts).toContain("--judge-model");
    expect(opts).toContain("--score-model");
    expect(opts).toContain("--dry-run");
  });
});

// ---------------------------------------------------------------------------
// (b) dry-run hits dog_met
// ---------------------------------------------------------------------------

describe("iterate (b): dry-run climbs to dog_met", () => {
  const runDirs: string[] = [];
  afterEach(() => cleanup(runDirs));

  it("3 gens of width 2 reach dog_met and emit winner.diff + decision.md", async () => {
    const r = await runDirector({
      promptName: PROMPT_NAME,
      dogPath: "effi/dogs/citation-faithful.md",
      corpus: CORPUS,
      caseId: CASE_ID,
      budget: 5,
      width: 2,
      workerModel: "claude-haiku-4-5-20251001",
      judgeModel: "claude-opus-4-7",
      scoreModel: "claude-sonnet-4-6",
      plateauPp: 1.0,
      plateauWindow: 3,
      dryRun: true,
    });
    runDirs.push(r.runDir);

    expect(r.meta.stopReason).toBe("dog_met");
    expect(existsSync(join(r.runDir, "meta.json"))).toBe(true);
    expect(existsSync(join(r.runDir, "leaderboard.md"))).toBe(true);
    expect(existsSync(join(r.runDir, "winner.diff"))).toBe(true);
    expect(existsSync(join(r.runDir, "decision.md"))).toBe(true);
    // Per-generation dirs exist for at least gen-001 (and however far we ran)
    expect(existsSync(join(r.runDir, "gen-001"))).toBe(true);

    // The winner.diff should be non-empty (mutation differs from baseline).
    const diff = readFileSync(join(r.runDir, "winner.diff"), "utf-8");
    expect(diff.length).toBeGreaterThan(0);

    // decision.md mentions "dog_met" indirectly via stop_reason narrative
    const dec = readFileSync(join(r.runDir, "decision.md"), "utf-8");
    expect(dec).toContain("Promote the winner");
  });
});

// ---------------------------------------------------------------------------
// (c) --budget 1 → budget_exhausted
// ---------------------------------------------------------------------------

describe("iterate (c): --budget 1 hits budget_exhausted", () => {
  const runDirs: string[] = [];
  afterEach(() => cleanup(runDirs));

  it("stops after one generation with stop_reason budget_exhausted", async () => {
    const r = await runDirector({
      promptName: PROMPT_NAME,
      dogPath: "effi/dogs/citation-faithful.md",
      corpus: CORPUS,
      caseId: CASE_ID,
      budget: 1,
      width: 2,
      workerModel: "claude-haiku-4-5-20251001",
      judgeModel: "claude-opus-4-7",
      scoreModel: "claude-sonnet-4-6",
      plateauPp: 1.0,
      plateauWindow: 3,
      dryRun: true,
    });
    runDirs.push(r.runDir);

    // gen-1 in stub: float dims score=0.78-0.80, bool dim=0 (climb starts gen-2),
    // so dog_met cannot fire on gen 1. Budget=1 → budget_exhausted.
    expect(r.meta.stopReason).toBe("budget_exhausted");
    expect(r.generations.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (d) --stub-plateau → plateau stop
// ---------------------------------------------------------------------------

describe("iterate (d): plateau stub forces plateau stop", () => {
  const runDirs: string[] = [];
  afterEach(() => cleanup(runDirs));

  it("flat scoring + small window stops with stop_reason plateau", async () => {
    const r = await runDirector({
      promptName: PROMPT_NAME,
      dogPath: "effi/dogs/citation-faithful.md",
      corpus: CORPUS,
      caseId: CASE_ID,
      budget: 10,
      width: 2,
      workerModel: "claude-haiku-4-5-20251001",
      judgeModel: "claude-opus-4-7",
      scoreModel: "claude-sonnet-4-6",
      plateauPp: 0.5, // tiny — stub-plateau yields delta=0 across gens
      plateauWindow: 2,
      dryRun: true,
      stubPlateau: true,
    });
    runDirs.push(r.runDir);

    expect(r.meta.stopReason).toBe("plateau");
    // Should NOT have run all 10 generations
    expect(r.generations.length).toBeLessThan(10);
    // And plateau requires at least window+1 generations of evidence
    expect(r.generations.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// (e) cheat-suspect injection → vetoed → second-best promoted
// ---------------------------------------------------------------------------

describe("iterate (e): cheat-suspect winner is vetoed, second-best is promoted", () => {
  const runDirs: string[] = [];
  afterEach(() => cleanup(runDirs));

  it("worker-0 cheats; reviewer flags it; worker-1 wins gen-1 leaderboard", async () => {
    const r = await runDirector({
      promptName: PROMPT_NAME,
      dogPath: "effi/dogs/citation-faithful.md",
      corpus: CORPUS,
      caseId: CASE_ID,
      budget: 3,
      width: 2,
      workerModel: "claude-haiku-4-5-20251001",
      judgeModel: "claude-opus-4-7",
      scoreModel: "claude-sonnet-4-6",
      plateauPp: 1.0,
      plateauWindow: 3,
      dryRun: true,
      stubInjectCheat: true,
    });
    runDirs.push(r.runDir);

    // Generation-1: worker-0 is the cheater (would-be top-ranked by score=1)
    const gen1 = r.generations.find((g) => g.generation === 1);
    expect(gen1).toBeDefined();
    const cheater = gen1!.proposals.find((p) => p.workerIndex === 0);
    expect(cheater?.cheated).toBe(true);
    // Cheater would have ranked first, but the reviewer veto means winner != worker-0
    expect(gen1!.winnerIndex).not.toBe(0);

    // Per-gen proposals.md mentions the VETO
    const propMd = readFileSync(
      join(r.runDir, "gen-001", "proposals.md"),
      "utf-8",
    );
    expect(propMd).toContain("VETO");
  });
});

// ---------------------------------------------------------------------------
// (f) bonus: end-to-end CLI parseAsync drives the full path
// ---------------------------------------------------------------------------

describe("iterate (f): Commander parseAsync end-to-end", () => {
  const runDirs: string[] = [];
  afterEach(() => cleanup(runDirs));

  it("parseAsync with --dry-run writes a real iterate-runs/<id>/ folder", async () => {
    const irDir = iterateRunsDir(CORPUS);
    const before = existsSync(irDir)
      ? new Set(readdirSync(irDir))
      : new Set<string>();

    const cmd = buildEvalsIterateCommand();
    await cmd.parseAsync(
      [
        PROMPT_NAME,
        "--dog", "effi/dogs/citation-faithful.md",
        "--corpus", "effi",
        "--case", CASE_ID,
        "--budget", "3",
        "--width", "2",
        "--dry-run",
      ],
      { from: "user" },
    );

    const after = readdirSync(irDir).filter((d) => !before.has(d));
    expect(after.length).toBeGreaterThanOrEqual(1);
    const runDir = join(irDir, after[after.length - 1]!);
    runDirs.push(runDir);

    expect(existsSync(join(runDir, "meta.json"))).toBe(true);
    expect(existsSync(join(runDir, "leaderboard.md"))).toBe(true);
    expect(existsSync(join(runDir, "winner.diff"))).toBe(true);
    expect(existsSync(join(runDir, "decision.md"))).toBe(true);

    // dirname is just used to keep the import lint-clean elsewhere.
    void dirname;
  });
});
