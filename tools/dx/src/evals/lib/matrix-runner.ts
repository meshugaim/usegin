/**
 * matrix-runner.ts — Run the Cartesian matrix of (model × prompt) × cases.
 *
 * For each cell:
 *   - Creates runs/<run-id>/cells/<cell-slug>/
 *   - Runs all cases via runCase()
 *   - Writes per-cell summary.json + summary.md (same shape as S3)
 *
 * At run-dir top level:
 *   - matrix.json        — full grid of all cell summaries
 *   - matrix-rollup.json — rolled-up totals across cells (matrix-specific shape;
 *                          NOT S3 RunSummary — use matrix.json for programmatic
 *                          consumption, summary.json per cell for S3-compat reads)
 *   - matrix.md          — human-readable table (rows=cells, cols=dimensions)
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import type { EvalCase } from "./case-loader";
import { runsDir } from "./case-loader";
import type { DogDocument } from "./dog-loader";
import { runCase } from "./runner";
import type { CaseResult } from "./runner";
import { writeRunResults } from "./writer";
import type { RunSummary } from "./writer";
import { cellSlug } from "./matrix";
import type { CellSpec } from "./matrix";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export interface CellOutcome {
  cell: CellSpec;
  slug: string;
  cellDir: string;
  summary: RunSummary;
  results: CaseResult[];
}

export interface MatrixRunResult {
  runDir: string;
  runId: string;
  cells: CellOutcome[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gitSha7(): string {
  const r = spawnSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf-8" });
  return (r.stdout ?? "").trim() || "unknown";
}

function makeMatrixRunId(startedAt: string, sha7: string): string {
  const ts = startedAt.replace(/[:.]/g, "-");
  return `${ts}-${sha7}-matrix`;
}

// ---------------------------------------------------------------------------
// Per-dimension delta computation
// ---------------------------------------------------------------------------

interface DimScore {
  name: string;
  score: number;
  pass: boolean;
}

function collectDimScores(results: CaseResult[]): DimScore[] {
  const totals: Record<string, { sum: number; passCount: number; total: number }> = {};
  for (const r of results) {
    for (const d of r.dimensionResults ?? []) {
      if (!totals[d.name]) totals[d.name] = { sum: 0, passCount: 0, total: 0 };
      totals[d.name].sum += d.score;
      totals[d.name].passCount += d.pass ? 1 : 0;
      totals[d.name].total += 1;
    }
  }
  return Object.entries(totals).map(([name, { sum, passCount, total }]) => ({
    name,
    score: total > 0 ? sum / total : 0,
    pass: total > 0 && passCount === total,
  }));
}

// ---------------------------------------------------------------------------
// Baseline loading
// ---------------------------------------------------------------------------

interface DimScoreRecord {
  name: string;
  score: number;
  pass: boolean;
}

interface MatrixJsonCell {
  slug: string;
  dim_scores?: DimScoreRecord[];
}

interface MatrixJson {
  cells: MatrixJsonCell[];
}

interface BaselineCellSummary {
  cellSlug: string;
  dimScores: DimScore[];
  passRate: number;
}

/**
 * Load baseline cells from a prior matrix run dir.
 *
 * Hydration strategy (in priority order):
 * 1. If the baseline run dir has a matrix.json, read per-dim scores per cell from it.
 * 2. If the baseline has no matrix.json but exactly one cell and per-case JSONs
 *    exist in that cell dir, aggregate dim scores from the per-case judge results.
 * 3. When neither source is available, return the cell with empty dimScores
 *    so pass_rate delta can still be shown, but omit dim delta columns.
 *
 * When NO baseline cells are loaded at all, the caller suppresses delta columns
 * entirely (returns empty array → hasBaseline = false).
 */
function loadBaselineCells(baselineRunId: string, corpus: string): BaselineCellSummary[] {
  const baseRunDir = join(runsDir(corpus), baselineRunId);
  const baseDir = join(baseRunDir, "cells");
  if (!existsSync(baseDir)) return [];

  const cells: BaselineCellSummary[] = [];

  // Try strategy 1: read matrix.json from baseline run dir
  const matrixJsonPath = join(baseRunDir, "matrix.json");
  let matrixData: MatrixJson | null = null;
  if (existsSync(matrixJsonPath)) {
    try {
      matrixData = JSON.parse(readFileSync(matrixJsonPath, "utf-8")) as MatrixJson;
    } catch {
      matrixData = null;
    }
  }

  // Enumerate cell slug dirs
  let slugs: string[];
  try {
    slugs = readdirSync(baseDir).filter((entry) => {
      // Only directories (cell dirs); skip any stray files
      try {
        const full = join(baseDir, entry);
        return existsSync(join(full, "summary.json"));
      } catch {
        return false;
      }
    });
  } catch (err) {
    // If we can't read the baseline cells dir, surface the error rather than silently swallowing it
    throw new Error(`matrix-runner: cannot read baseline cells dir ${baseDir}: ${String(err)}`);
  }

  for (const slug of slugs) {
    const summaryPath = join(baseDir, slug, "summary.json");
    if (!existsSync(summaryPath)) continue;

    let summary: RunSummary;
    try {
      summary = JSON.parse(readFileSync(summaryPath, "utf-8")) as RunSummary;
    } catch (err) {
      throw new Error(`matrix-runner: cannot parse baseline summary ${summaryPath}: ${String(err)}`);
    }

    const passRate = summary.case_count > 0 ? summary.pass_count / summary.case_count : 0;

    // Strategy 1: hydrate dim scores from matrix.json
    if (matrixData) {
      const matrixCell = matrixData.cells.find((c) => c.slug === slug);
      if (matrixCell?.dim_scores) {
        cells.push({ cellSlug: slug, dimScores: matrixCell.dim_scores, passRate });
        continue;
      }
    }

    // Strategy 2: single-cell baseline — hydrate from per-case JSON judge results
    if (slugs.length === 1) {
      const caseFiles = (() => {
        try {
          return readdirSync(join(baseDir, slug)).filter(
            (f) => f.endsWith(".json") && f !== "summary.json" && f !== "meta.json",
          );
        } catch {
          return [];
        }
      })();
      const dimAccum: Record<string, { sum: number; passCount: number; total: number }> = {};
      for (const cf of caseFiles) {
        try {
          const caseData = JSON.parse(
            readFileSync(join(baseDir, slug, cf), "utf-8"),
          ) as { result?: { dimensionResults?: DimScore[] } };
          for (const d of caseData.result?.dimensionResults ?? []) {
            if (!dimAccum[d.name]) dimAccum[d.name] = { sum: 0, passCount: 0, total: 0 };
            dimAccum[d.name].sum += d.score;
            dimAccum[d.name].passCount += d.pass ? 1 : 0;
            dimAccum[d.name].total += 1;
          }
        } catch {
          // Skip unreadable case files
        }
      }
      const dimScores = Object.entries(dimAccum).map(([name, { sum, passCount, total }]) => ({
        name,
        score: total > 0 ? sum / total : 0,
        pass: total > 0 && passCount === total,
      }));
      cells.push({ cellSlug: slug, dimScores, passRate });
      continue;
    }

    // Strategy 3: no dim scores available — record passRate only; dim delta columns
    // will render as "-" because bds will be undefined in buildMatrixMd
    cells.push({ cellSlug: slug, dimScores: [], passRate });
  }

  return cells;
}

// ---------------------------------------------------------------------------
// matrix.md builder
// ---------------------------------------------------------------------------

function buildMatrixMd(
  runId: string,
  corpus: string,
  cells: CellOutcome[],
  baselineCells: BaselineCellSummary[],
  dryRun: boolean,
): string {
  const lines: string[] = [];
  lines.push(`# Eval Matrix Run: ${runId}`);
  lines.push("");
  lines.push(`**Corpus:** ${corpus}  `);
  if (dryRun) lines.push(`**DRY RUN**  `);
  lines.push("");

  // Collect all dimension names across all cells
  const dimNames: Set<string> = new Set();
  for (const cell of cells) {
    for (const r of cell.results) {
      for (const d of r.dimensionResults ?? []) {
        dimNames.add(d.name);
      }
    }
  }
  const dims = Array.from(dimNames);

  // Only show baseline delta columns when we have a baseline AND it has dim scores
  // for at least one cell. Without dim scores we only show pass_rate delta.
  const hasBaseline = baselineCells.length > 0;
  const baselineHasDimScores = baselineCells.some((b) => b.dimScores.length > 0);

  // Header row
  const cols = ["cell", "model", "prompt", "pass_rate", ...dims];
  if (hasBaseline) {
    cols.push("pass_rate_delta");
    // Only add per-dim delta columns if baseline actually has dim scores
    if (baselineHasDimScores) {
      for (const d of dims) cols.push(`${d}_delta`);
    }
  }

  lines.push("## Results");
  lines.push("");
  lines.push(`| ${cols.join(" | ")} |`);
  lines.push(`| ${cols.map(() => "---").join(" | ")} |`);

  for (const cell of cells) {
    const passRate =
      cell.summary.case_count > 0
        ? (cell.summary.pass_count / cell.summary.case_count).toFixed(2)
        : "-";

    const dimScores = collectDimScores(cell.results);
    const dimCols = dims.map((name) => {
      const ds = dimScores.find((d) => d.name === name);
      if (!ds) return "-";
      return `${ds.score.toFixed(2)} (${ds.pass ? "pass" : "fail"})`;
    });

    const row = [
      cell.slug,
      cell.cell.model,
      cell.cell.prompt,
      passRate,
      ...dimCols,
    ];

    if (hasBaseline) {
      const baseline = baselineCells.find((b) => b.cellSlug === cell.slug);
      if (baseline) {
        const currentPassRate =
          cell.summary.case_count > 0 ? cell.summary.pass_count / cell.summary.case_count : 0;
        const prDelta = currentPassRate - baseline.passRate;
        row.push(formatDelta(prDelta));
        if (baselineHasDimScores) {
          for (const name of dims) {
            const ds = dimScores.find((d) => d.name === name);
            const bds = baseline.dimScores.find((d) => d.name === name);
            if (!ds || !bds) {
              row.push("-");
            } else {
              row.push(formatDelta(ds.score - bds.score));
            }
          }
        }
      } else {
        row.push("(no baseline)");
        if (baselineHasDimScores) {
          for (const _ of dims) row.push("-");
        }
      }
    }

    lines.push(`| ${row.join(" | ")} |`);
  }

  lines.push("");
  lines.push(`**Total cells:** ${cells.length}  `);
  const allPass = cells.every((c) => c.summary.error_count === 0);
  lines.push(`**Errors:** ${allPass ? "none" : cells.filter((c) => c.summary.error_count > 0).length + " cells with errors"}  `);
  lines.push("");

  return lines.join("\n");
}

function formatDelta(d: number): string {
  // Treat values within ±0.005 as zero (avoids "-0.00" renders)
  if (Math.abs(d) < 0.005) return "0.00";
  return (d >= 0 ? "+" : "") + d.toFixed(2);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runMatrix(
  corpus: string,
  suite: string,
  cells: CellSpec[],
  cases: EvalCase[],
  dogsByCase: Map<string, DogDocument>,
  judgeModel: string,
  dryRun: boolean,
  baselineRunId: string | undefined,
  startedAt: string,
  log: (msg: string) => void,
): Promise<MatrixRunResult> {
  const sha7 = gitSha7();
  const runId = makeMatrixRunId(startedAt, sha7);
  const runDir = join(runsDir(corpus), runId);
  const cellsDir = join(runDir, "cells");
  mkdirSync(cellsDir, { recursive: true });

  const cellOutcomes: CellOutcome[] = [];

  for (const cell of cells) {
    const slug = cellSlug(cell);
    const cellDir = join(cellsDir, slug);
    mkdirSync(cellDir, { recursive: true });

    log(`  Cell: ${slug} (model=${cell.model} prompt=${cell.prompt})`);

    const results: CaseResult[] = [];
    for (const evalCase of cases) {
      log(`    Case: ${evalCase.id}`);
      const dog = dogsByCase.get(evalCase.id);
      if (!dog) {
        results.push({
          caseId: evalCase.id,
          status: "error",
          transcriptExcerpt: "",
          errorMessage: `No DoG loaded for case ${evalCase.id}`,
          durationMs: 0,
        });
        continue;
      }
      const result = await runCase(evalCase, dog, cell.model, judgeModel, dryRun);
      results.push(result);
      log(`      -> ${result.status} (${result.durationMs}ms)`);
    }

    // Write per-cell output reusing S3's writeRunResults, pointed at the cell dir
    const { summary } = writeRunResults(
      corpus,
      suite,
      cell.model,
      cell.prompt,
      judgeModel,
      cases,
      results,
      startedAt,
      dryRun,
      undefined,
      cellDir, // override output dir
    );

    cellOutcomes.push({ cell, slug, cellDir, summary, results });
  }

  // Load baseline cells (best-effort)
  const baselineCells = baselineRunId ? loadBaselineCells(baselineRunId, corpus) : [];

  // Collect dim scores for each cell (used in matrix.json for future baseline hydration)
  const cellDimScores = cellOutcomes.map((co) => ({
    slug: co.slug,
    dim_scores: collectDimScores(co.results),
  }));

  // Build matrix.md
  const matrixMd = buildMatrixMd(runId, corpus, cellOutcomes, baselineCells, dryRun);
  writeFileSync(join(runDir, "matrix.md"), matrixMd);

  // Build matrix.json (full grid — includes dim_scores for future baseline hydration)
  const matrixJson = {
    run_id: runId,
    corpus,
    suite,
    started_at: startedAt,
    dry_run: dryRun,
    baseline_run_id: baselineRunId ?? null,
    cells: cellOutcomes.map((c, i) => ({
      slug: c.slug,
      model: c.cell.model,
      prompt: c.cell.prompt,
      pass_count: c.summary.pass_count,
      case_count: c.summary.case_count,
      error_count: c.summary.error_count,
      cell_dir: c.cellDir,
      dim_scores: cellDimScores[i]?.dim_scores ?? [],
    })),
  };
  writeFileSync(join(runDir, "matrix.json"), JSON.stringify(matrixJson, null, 2) + "\n");

  // Build matrix-rollup.json — matrix-mode aggregate (NOT S3 RunSummary shape)
  const totalCases = cellOutcomes.reduce((s, c) => s + c.summary.case_count, 0);
  const totalPass = cellOutcomes.reduce((s, c) => s + c.summary.pass_count, 0);
  const totalErrors = cellOutcomes.reduce((s, c) => s + c.summary.error_count, 0);
  const totalNI = cellOutcomes.reduce((s, c) => s + c.summary.not_implemented_count, 0);

  const rollup = {
    meta: {
      runId,
      corpus,
      suite,
      // Arrays for multi-model / multi-prompt: consumers must not split a string
      models: [...new Set(cells.map((c) => c.model))],
      prompts: [...new Set(cells.map((c) => c.prompt))],
      judgeModel,
      startedAt,
      finishedAt: new Date().toISOString(),
      git: cellOutcomes[0]?.summary.meta.git ?? null,
      whoRan: cellOutcomes[0]?.summary.meta.whoRan ?? null,
      dryRun,
      matrixMode: true,
    },
    case_count: totalCases,
    pass_count: totalPass,
    not_implemented_count: totalNI,
    error_count: totalErrors,
    cells: cellOutcomes.map((c) => ({
      slug: c.slug,
      model: c.cell.model,
      prompt: c.cell.prompt,
      pass_count: c.summary.pass_count,
      case_count: c.summary.case_count,
      error_count: c.summary.error_count,
    })),
  };
  writeFileSync(join(runDir, "matrix-rollup.json"), JSON.stringify(rollup, null, 2) + "\n");

  return { runDir, runId, cells: cellOutcomes };
}
