/**
 * Tests for `dx evals run --dry-run`:
 *   1. Existing effi-001-citation-test (transcript kind).
 *   2. Synthetic gin-fixture-prompt-test (prompt kind) — exercises dry-run end-to-end
 *      through evaluateDimensions (judge), threshold parser, and writeRunResults.
 *      --dry-run: runner returns a deterministic stub JudgeResult; NO Anthropic SDK call.
 *
 * All assertions run in --dry-run mode — no API calls.
 */

import { describe, expect, it, afterEach } from "bun:test";
import { existsSync, readFileSync, rmSync } from "fs";
import { join, resolve, dirname } from "path";
import { writeRunResults } from "../lib/writer";
import { loadCases } from "../lib/case-loader";
import { loadDog } from "../lib/dog-loader";
import { parseDog } from "../lib/dog-loader";
import { runCase } from "../lib/runner";
import { evaluateDimensions } from "../lib/judge";
import type { RunSummary } from "../lib/writer";
import { parseMatrixFlags, cartesian, cellSlug } from "../lib/matrix";
import { resolvePrompt } from "../lib/prompt-resolver";
import { runMatrix } from "../lib/matrix-runner";
import { buildEvalsRunCommand } from "./run";

// Resolve repo root (this file: tools/dx/src/evals/commands/run.test.ts → 5 up)
function repoRoot(): string {
  const here = new URL(import.meta.url).pathname;
  return here.split("/").slice(0, -6).join("/");
}

const CORPUS = "effi";
const CASE_ID = "effi-001-citation-test";

describe("dx evals run --dry-run (effi-001-citation-test)", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    // Clean up run dirs created during tests
    for (const dir of createdDirs) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    createdDirs.length = 0;
  });

  it("loads the case without error", () => {
    const cases = loadCases(CORPUS, CASE_ID);
    expect(cases.length).toBe(1);
    expect(cases[0].id).toBe(CASE_ID);
    expect(cases[0].source.kind).toBe("transcript");
  });

  it("loads the DoG without error", () => {
    const cases = loadCases(CORPUS, CASE_ID);
    const evalCase = cases[0];
    const dog = loadDog(evalCase.dog_ref, CORPUS, evalCase._file_path);
    expect(dog.slug).toBe("citation-faithful");
    expect(dog.dimensions.length).toBeGreaterThan(0);
    expect(dog.dimensions.map((d) => d.name)).toContain("citation_present");
    expect(dog.dimensions.map((d) => d.name)).toContain("citation_supports_claim");
    expect(dog.dimensions.map((d) => d.name)).toContain("no_unsupported_facts");
  });

  it("returns not-implemented-trace-replay for transcript case in dry-run", async () => {
    const cases = loadCases(CORPUS, CASE_ID);
    const evalCase = cases[0];
    const dog = loadDog(evalCase.dog_ref, CORPUS, evalCase._file_path);

    const result = await runCase(evalCase, dog, "claude-sonnet-4-6", "claude-opus-4-7", true);

    // Transcript-kind cases always return not-implemented (even in dry-run)
    expect(result.status).toBe("not-implemented-trace-replay");
    expect(result.caseId).toBe(CASE_ID);
    expect(result.transcriptExcerpt).toContain("trace-replay");
    // No crash — no error message
    expect(result.errorMessage).toBeUndefined();
  });

  it("writes run folder with expected structure", async () => {
    const cases = loadCases(CORPUS, CASE_ID);
    const evalCase = cases[0];
    const dog = loadDog(evalCase.dog_ref, CORPUS, evalCase._file_path);

    const result = await runCase(evalCase, dog, "claude-sonnet-4-6", "claude-opus-4-7", true);

    const { runDir, summary } = writeRunResults(
      CORPUS,
      "default",
      "claude-sonnet-4-6",
      "baseline",
      "claude-opus-4-7",
      cases,
      [result],
      new Date().toISOString(),
      true, // dryRun
    );
    createdDirs.push(runDir);

    // Folder exists
    expect(existsSync(runDir)).toBe(true);

    // Required files present
    expect(existsSync(join(runDir, "summary.json"))).toBe(true);
    expect(existsSync(join(runDir, "summary.md"))).toBe(true);
    expect(existsSync(join(runDir, "meta.json"))).toBe(true);
    expect(existsSync(join(runDir, `${CASE_ID}.json`))).toBe(true);

    // summary.json shape
    const summaryJson = JSON.parse(
      readFileSync(join(runDir, "summary.json"), "utf-8"),
    ) as RunSummary;
    expect(summaryJson.case_count).toBe(1);
    expect(summaryJson.meta.corpus).toBe(CORPUS);
    expect(summaryJson.meta.suite).toBe("default");
    expect(summaryJson.meta.dryRun).toBe(true);
    expect(Array.isArray(summaryJson.cases)).toBe(true);
    expect(summaryJson.cases[0].id).toBe(CASE_ID);
    expect(summaryJson.cases[0].status).toBe("not-implemented-trace-replay");

    // summary.md contains the case ID
    const summaryMd = readFileSync(join(runDir, "summary.md"), "utf-8");
    expect(summaryMd).toContain(CASE_ID);
    expect(summaryMd).toContain("not-implemented-trace-replay");
  });

  it("per-case JSON contains case data and result", async () => {
    const cases = loadCases(CORPUS, CASE_ID);
    const evalCase = cases[0];
    const dog = loadDog(evalCase.dog_ref, CORPUS, evalCase._file_path);

    const result = await runCase(evalCase, dog, "claude-sonnet-4-6", "claude-opus-4-7", true);

    const { runDir } = writeRunResults(
      CORPUS,
      "default",
      "claude-sonnet-4-6",
      "baseline",
      "claude-opus-4-7",
      cases,
      [result],
      new Date().toISOString(),
      true,
    );
    createdDirs.push(runDir);

    const caseFile = JSON.parse(
      readFileSync(join(runDir, `${CASE_ID}.json`), "utf-8"),
    ) as { case: { id: string }; result: { status: string } };

    expect(caseFile.case.id).toBe(CASE_ID);
    expect(caseFile.result.status).toBe("not-implemented-trace-replay");
  });

  it("no crash when running entire effi suite dry-run", async () => {
    // All cases in the corpus (just one at v0)
    const cases = loadCases(CORPUS);
    expect(cases.length).toBeGreaterThan(0);

    const results = [];
    for (const evalCase of cases) {
      const dog = loadDog(evalCase.dog_ref, CORPUS, evalCase._file_path);
      const r = await runCase(evalCase, dog, "claude-sonnet-4-6", "claude-opus-4-7", true);
      results.push(r);
    }

    const { runDir, summary } = writeRunResults(
      CORPUS,
      "default",
      "claude-sonnet-4-6",
      "baseline",
      "claude-opus-4-7",
      cases,
      results,
      new Date().toISOString(),
      true,
    );
    createdDirs.push(runDir);

    expect(existsSync(runDir)).toBe(true);
    expect(summary.case_count).toBe(cases.length);
    // All transcript cases → not-implemented, no errors
    expect(summary.error_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Prompt-kind fixture: exercises dry-run end-to-end (no Anthropic SDK call)
// ---------------------------------------------------------------------------
describe("dx evals run --dry-run (prompt-kind fixture)", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
    createdDirs.length = 0;
  });

  // Load the fixture case directly (it lives outside the corpus dirs)
  function fixturesDir(): string {
    const here = new URL(import.meta.url).pathname;
    return join(here.split("/").slice(0, -2).join("/"), "__fixtures__");
  }

  function loadFixtureCase() {
    const casePath = join(fixturesDir(), "cases", "gin-fixture-prompt-test.json");
    const raw = JSON.parse(readFileSync(casePath, "utf-8")) as Record<string, unknown>;
    // Minimal strip + attach _file_path (mirrors what case-loader does)
    return { ...(raw as Record<string, unknown>), _file_path: casePath } as import("../lib/case-loader").EvalCase;
  }

  it("prompt-kind case: dry-run returns pass with per-dimension scores", async () => {
    const evalCase = loadFixtureCase();
    const dogPath = resolve(dirname(evalCase._file_path), evalCase.dog_ref);
    const dog = parseDog(dogPath);

    // Confirm case has correct shape
    expect(evalCase.source.kind).toBe("prompt");

    // dry-run=true — no SDK call; runner returns deterministic stub
    const result = await runCase(evalCase, dog, "claude-haiku-4-5", "claude-opus-4-7", true);
    expect(result.status).toBe("pass");
    expect(result.judgeResult).toBeDefined();
    expect(result.dimensionResults).toBeDefined();
    expect(result.dimensionResults!.length).toBe(dog.dimensions.length);

    // Each dimension has a score and a pass/fail decision
    for (const dim of result.dimensionResults!) {
      expect(typeof dim.score).toBe("number");
      expect(typeof dim.pass).toBe("boolean");
      expect(typeof dim.threshold).toBe("string");
    }
  });

  it("prompt-kind case: threshold pass/fail correctly derived", async () => {
    const evalCase = loadFixtureCase();
    const dogPath = resolve(dirname(evalCase._file_path), evalCase.dog_ref);
    const dog = parseDog(dogPath);

    const result = await runCase(evalCase, dog, "claude-haiku-4-5", "claude-opus-4-7", true);
    const dimResults = result.dimensionResults!;

    // Stub assigns bool dims score=1, float dims score=0.9
    const boolDim = dimResults.find((d) => d.threshold === "== true");
    const floatDim = dimResults.find((d) => d.threshold.startsWith(">="));

    // bool score=1 with "== true" threshold → pass
    if (boolDim) expect(boolDim.pass).toBe(true);
    // float score=0.9 with ">= 0.90" threshold → pass
    if (floatDim) expect(floatDim.pass).toBe(true);
  });

  it("prompt-kind case: writeRun produces summary.md with case row", async () => {
    const evalCase = loadFixtureCase();
    const dogPath = resolve(dirname(evalCase._file_path), evalCase.dog_ref);
    const dog = parseDog(dogPath);

    const result = await runCase(evalCase, dog, "claude-haiku-4-5", "claude-opus-4-7", true);

    const { runDir, summary } = writeRunResults(
      "gin",
      "default",
      "claude-haiku-4-5",
      "(fixture)",
      "claude-opus-4-7",
      [evalCase],
      [result],
      new Date().toISOString(),
      true, // dryRun
    );
    createdDirs.push(runDir);

    // Folder and required files
    expect(existsSync(join(runDir, "summary.json"))).toBe(true);
    expect(existsSync(join(runDir, "summary.md"))).toBe(true);
    expect(existsSync(join(runDir, "meta.json"))).toBe(true);

    // summary.md contains the case ID row
    const md = readFileSync(join(runDir, "summary.md"), "utf-8");
    expect(md).toContain("gin-fixture-prompt-test");

    // pass_count matches
    expect(summary.pass_count).toBe(1);
    expect(summary.error_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// S4 — Matrix mode tests
// ---------------------------------------------------------------------------

describe("S4 matrix: parseMatrixFlags + cartesian", () => {
  it("parses two axes and produces correct cartesian product", () => {
    const axes = parseMatrixFlags(["model=opus,sonnet", "prompt=v1,v2"]);
    expect(axes.length).toBe(2);
    const modelAxis = axes.find((a) => a.axis === "model")!;
    const promptAxis = axes.find((a) => a.axis === "prompt")!;
    expect(modelAxis.values).toEqual(["opus", "sonnet"]);
    expect(promptAxis.values).toEqual(["v1", "v2"]);

    const cells = cartesian(axes, { model: "default-model", prompt: "baseline" });
    // 2 models × 2 prompts = 4 cells
    expect(cells.length).toBe(4);
    const slugs = cells.map(cellSlug);
    // Slugs use underscores, not = signs
    expect(slugs).toContain("model_opus__prompt_v1");
    expect(slugs).toContain("model_opus__prompt_v2");
    expect(slugs).toContain("model_sonnet__prompt_v1");
    expect(slugs).toContain("model_sonnet__prompt_v2");
    // No = characters in any slug
    for (const slug of slugs) {
      expect(slug).not.toContain("=");
    }
  });

  it("rejects unsupported axes with a clear v0 boundary message", () => {
    expect(() => parseMatrixFlags(["temperature=0.5,1.0"])).toThrow(
      /axis "temperature" is not supported at v0/,
    );
    expect(() => parseMatrixFlags(["judge-model=opus,sonnet"])).toThrow(
      /axis "judge-model" is not supported at v0/,
    );
  });

  it("single-axis (model only) fills in default prompt", () => {
    const axes = parseMatrixFlags(["model=opus,sonnet"]);
    const cells = cartesian(axes, { model: "default-model", prompt: "baseline" });
    expect(cells.length).toBe(2);
    expect(cells.every((c) => c.prompt === "baseline")).toBe(true);
  });

  it("gin corpus with no prompt axis yields model-only slug (no = chars)", () => {
    const axes = parseMatrixFlags(["model=opus,sonnet"]);
    const cells = cartesian(axes, { model: "claude-sonnet-4-6", prompt: "(embedded)" });
    const slugs = cells.map(cellSlug);
    expect(slugs).toContain("model_opus");
    expect(slugs).toContain("model_sonnet");
    for (const slug of slugs) {
      expect(slug).not.toContain("=");
      expect(slug).not.toContain("prompt");
    }
  });
});

describe("S4 matrix: end-to-end dry-run produces matrix.md + per-cell sub-dirs", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
    createdDirs.length = 0;
  });

  it("2×2 matrix dry-run creates 4 cell dirs + matrix.md + matrix.json + matrix-rollup.json", async () => {
    const corpus = "effi";
    const cases = loadCases(corpus, "effi-001-citation-test");
    const dogsByCase = new Map();
    for (const c of cases) {
      dogsByCase.set(c.id, loadDog(c.dog_ref, corpus, c._file_path));
    }

    const axes = parseMatrixFlags(["model=opus,sonnet", "prompt=baseline,strict-citations"]);
    const cells = cartesian(axes, { model: "claude-sonnet-4-6", prompt: "baseline" });
    expect(cells.length).toBe(4);

    const startedAt = new Date().toISOString();
    const result = await runMatrix(
      corpus,
      "default",
      cells,
      cases,
      dogsByCase,
      "claude-opus-4-7",
      true, // dry-run
      undefined,
      startedAt,
      () => {},
    );
    createdDirs.push(result.runDir);

    // matrix.md exists
    expect(existsSync(join(result.runDir, "matrix.md"))).toBe(true);
    // matrix.json exists
    expect(existsSync(join(result.runDir, "matrix.json"))).toBe(true);
    // matrix-rollup.json exists (renamed from summary.json at run level)
    expect(existsSync(join(result.runDir, "matrix-rollup.json"))).toBe(true);

    // 4 cell sub-directories
    expect(result.cells.length).toBe(4);
    for (const cell of result.cells) {
      expect(existsSync(cell.cellDir)).toBe(true);
      expect(existsSync(join(cell.cellDir, "summary.json"))).toBe(true);
      expect(existsSync(join(cell.cellDir, "summary.md"))).toBe(true);
    }

    // matrix.md contains cell slugs (underscore format, no = signs)
    const md = readFileSync(join(result.runDir, "matrix.md"), "utf-8");
    expect(md).toContain("model_opus");
    expect(md).toContain("model_sonnet");
    expect(md).toContain("prompt_baseline");
    expect(md).toContain("prompt_strict-");
    expect(md).not.toContain("model=");
    expect(md).not.toContain("prompt=");

    // matrix.json has 4 cells and includes dim_scores
    const matrixJson = JSON.parse(readFileSync(join(result.runDir, "matrix.json"), "utf-8")) as {
      cells: Array<{ slug: string; dim_scores: unknown[] }>;
    };
    expect(matrixJson.cells.length).toBe(4);
    for (const cell of matrixJson.cells) {
      expect(Array.isArray(cell.dim_scores)).toBe(true);
      // slug must not contain = characters
      expect(cell.slug).not.toContain("=");
    }

    // matrix-rollup.json has arrays for models/prompts (not comma-joined strings)
    const rollup = JSON.parse(
      readFileSync(join(result.runDir, "matrix-rollup.json"), "utf-8"),
    ) as { meta: { models: string[]; prompts: string[]; git: unknown; whoRan: unknown; finishedAt: string } };
    expect(Array.isArray(rollup.meta.models)).toBe(true);
    expect(Array.isArray(rollup.meta.prompts)).toBe(true);
    expect(rollup.meta.git).toBeDefined();
    expect(rollup.meta.whoRan).toBeDefined();
    expect(rollup.meta.finishedAt).toBeDefined();
  });
});

describe("S4 matrix: gin corpus + --matrix prompt= errors clearly", () => {
  it("resolvePrompt throws for gin corpus", () => {
    expect(() => resolvePrompt("gin", "v1")).toThrow(
      /Gin cases embed their prompt; --matrix prompt= is Effi-only/,
    );
  });
});

// ---------------------------------------------------------------------------
// S4 matrix: CLI-driven tests (fix #6 — drives Commander parseAsync)
// ---------------------------------------------------------------------------

describe("S4 matrix: CLI-driven end-to-end via Commander", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
    createdDirs.length = 0;
  });

  it("parseAsync: --matrix model=opus,sonnet --matrix prompt=baseline,strict-citations --dry-run produces matrix.md", async () => {
    // Capture the run dir by watching the effi runs dir before + after
    const effiRunsDir = join(repoRoot(), "usegin", "evals", "effi", "runs");

    // List dirs before
    const { readdirSync: rd } = await import("fs");
    const before = new Set(rd(effiRunsDir).filter((d) => d.endsWith("-matrix")));

    const cmd = buildEvalsRunCommand();
    // parseAsync does not call process.exit on success
    await cmd.parseAsync([
      "--corpus", "effi",
      "--matrix", "model=opus,sonnet",
      "--matrix", "prompt=baseline,strict-citations",
      "--dry-run",
    ], { from: "user" });

    // Find newly created matrix run dir
    const after = rd(effiRunsDir).filter((d) => d.endsWith("-matrix") && !before.has(d));
    expect(after.length).toBeGreaterThanOrEqual(1);
    const runDir = join(effiRunsDir, after[after.length - 1]!);
    createdDirs.push(runDir);

    // matrix.md exists and contains both cell slugs (no = chars)
    const mdPath = join(runDir, "matrix.md");
    expect(existsSync(mdPath)).toBe(true);
    const md = readFileSync(mdPath, "utf-8");
    expect(md).toContain("model_opus");
    expect(md).toContain("model_sonnet");
    expect(md).not.toContain("model=");
    expect(md).not.toContain("prompt=");
  });

  it("parseAsync: --matrix prompt=v1 --corpus gin --dry-run exits with error message about gin+prompt", async () => {
    // Override process.exit to capture the exit code
    const originalExit = process.exit.bind(process);
    let capturedCode: number | undefined;
    const stderrChunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);

    process.exit = ((code?: number | string) => {
      capturedCode = typeof code === "number" ? code : 2;
      throw new Error(`process.exit(${capturedCode})`);
    }) as typeof process.exit;

    (process.stderr as NodeJS.WriteStream & { write: (chunk: string) => boolean }).write = (chunk: string) => {
      stderrChunks.push(chunk);
      return true;
    };

    try {
      const cmd = buildEvalsRunCommand();
      await cmd.parseAsync([
        "--corpus", "gin",
        "--matrix", "prompt=v1",
        "--dry-run",
      ], { from: "user" });
    } catch {
      // expected — process.exit throws
    } finally {
      process.exit = originalExit;
      (process.stderr as NodeJS.WriteStream & { write: typeof originalWrite }).write = originalWrite;
    }

    expect(capturedCode).toBe(2);
    const stderr = stderrChunks.join("");
    expect(stderr).toContain("Gin cases embed their prompt");
  });
});
