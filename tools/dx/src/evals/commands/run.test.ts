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
      "python-services/agent_api/agent/effi_system_prompt.py",
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
      "python-services/agent_api/agent/effi_system_prompt.py",
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
      "python-services/agent_api/agent/effi_system_prompt.py",
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
