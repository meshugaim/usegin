/**
 * `dx evals run` — single-axis runner (S3) + matrix mode (S4).
 *
 * Single-axis (default): one model × one prompt × all cases in suite.
 * Matrix mode (--matrix flags present): Cartesian product of model × prompt values.
 *
 * Flags:
 *   --corpus <effi|gin>             (required)
 *   --suite  <name>                 (default: "default" = all cases/*.json)
 *   --case   <id>                   (optional; restricts to one case)
 *   --model  <model>                (default: claude-sonnet-4-6; ignored in matrix mode)
 *   --prompt <path>                 (default: corpus-appropriate default; ignored in matrix mode)
 *   --judge-model <model>           (default: claude-opus-4-7)
 *   --baseline <run-id>             (optional; matrix mode computes deltas vs this run)
 *   --dry-run                       (skip API calls; deterministic stubs)
 *   --matrix <axis=v1,v2>           (repeatable; axes: model, prompt)
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { loadCases } from "../lib/case-loader";
import { loadDog } from "../lib/dog-loader";
import { runCase } from "../lib/runner";
import { writeRunResults } from "../lib/writer";
import { parseMatrixFlags, cartesian } from "../lib/matrix";
import { resolvePrompt } from "../lib/prompt-resolver";
import { runMatrix } from "../lib/matrix-runner";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_JUDGE_MODEL = "claude-opus-4-7";
/**
 * Canonical default prompt for both single-axis and matrix mode.
 * Lives in usegin/evals/effi/prompts/baseline.md — the prompt under evaluation.
 * Production code is read-only at v0; use prod-snapshot-2026-04-28 to reproduce
 * production behavior (`--prompt prod-snapshot-2026-04-28`).
 */
const DEFAULT_PROMPT_NAME = "baseline";

interface RunOptions {
  corpus: string;
  suite: string;
  case?: string;
  model: string;
  prompt: string;
  judgeModel: string;
  baseline?: string;
  dryRun: boolean;
  json?: boolean;
  matrix?: string[];
}

export function buildEvalsRunCommand(): Command {
  return new Command("run")
    .description(
      "Run eval suite — single-axis or matrix mode. " +
        "Single: one model × one prompt × all cases. " +
        "Matrix: --matrix model=a,b --matrix prompt=x,y runs Cartesian product. " +
        "Writes results to usegin/evals/<corpus>/runs/.",
    )
    .requiredOption("--corpus <corpus>", "Corpus to run against: effi or gin")
    .option("--suite <name>", "Suite name (default: 'default' = all cases)", "default")
    .option("--case <id>", "Restrict to a single case ID")
    .option("--model <model>", "Model to use for the agent (single-axis mode)", DEFAULT_MODEL)
    .option(
      "--prompt <path>",
      "Path to system prompt. Defaults to effi_system_prompt.py for effi corpus (single-axis mode)",
    )
    .option("--judge-model <model>", "Model to use for the judge", DEFAULT_JUDGE_MODEL)
    .option("--baseline <run-id>", "Baseline run ID for delta comparison (matrix mode)")
    .option("--dry-run", "Skip API calls; write deterministic stub results")
    .option("--json", "Output JSON summary to stdout")
    .option(
      "--matrix <axis=values>",
      "Matrix axis: axis=v1,v2,… (repeatable). Axes: model, prompt. Other axes error at v0.",
      (val: string, prev: string[]) => [...(prev ?? []), val],
      [] as string[],
    )
    .action(actionEvalsRun);
}

async function actionEvalsRun(opts: RunOptions): Promise<void> {
  const useJson = dxShouldOutputJson(opts);
  const log = (msg: string) => process.stderr.write(msg + "\n");

  const corpus = opts.corpus;
  if (corpus !== "effi" && corpus !== "gin") {
    process.stderr.write(`dx evals run: --corpus must be "effi" or "gin", got: ${corpus}\n`);
    process.exit(2);
  }

  const matrixRaw = opts.matrix ?? [];

  // -------------------------------------------------------------------------
  // MATRIX PATH
  // -------------------------------------------------------------------------
  if (matrixRaw.length > 0) {
    await actionEvalsRunMatrix(opts, corpus, matrixRaw, log, useJson);
    return;
  }

  // -------------------------------------------------------------------------
  // SINGLE-AXIS PATH (S3 — unchanged behavior)
  // -------------------------------------------------------------------------
  const promptRef = opts.prompt ?? (corpus === "effi" ? DEFAULT_PROMPT_NAME : "(embedded in case)");
  const startedAt = new Date().toISOString();

  log(
    `dx evals run: corpus=${corpus} suite=${opts.suite} model=${opts.model} ` +
      `judge=${opts.judgeModel}${opts.dryRun ? " [DRY-RUN]" : ""}`,
  );

  // Load cases
  let cases;
  try {
    cases = loadCases(corpus, opts.case);
  } catch (err) {
    process.stderr.write(`dx evals run: ${String(err)}\n`);
    process.exit(1);
  }

  log(`  Loaded ${cases.length} case(s)`);

  // Run each case
  const results = [];
  for (const evalCase of cases) {
    log(`  Running case: ${evalCase.id}`);

    let dog;
    try {
      dog = loadDog(evalCase.dog_ref, corpus, evalCase._file_path);
    } catch (err) {
      process.stderr.write(
        `dx evals run: failed to load DoG for case ${evalCase.id}: ${String(err)}\n`,
      );
      results.push({
        caseId: evalCase.id,
        status: "error" as const,
        transcriptExcerpt: "",
        errorMessage: String(err),
        durationMs: 0,
      });
      continue;
    }

    const result = await runCase(evalCase, dog, opts.model, opts.judgeModel, opts.dryRun);
    results.push(result);
    log(`    → ${result.status} (${result.durationMs}ms)`);
  }

  // Write output
  let writeResult;
  try {
    writeResult = writeRunResults(
      corpus,
      opts.suite,
      opts.model,
      promptRef,
      opts.judgeModel,
      cases,
      results,
      startedAt,
      opts.dryRun,
      opts.case,
    );
  } catch (err) {
    process.stderr.write(`dx evals run: failed to write results: ${String(err)}\n`);
    process.exit(1);
  }

  const { runDir, summary } = writeResult;
  const passRate = `${summary.pass_count}/${summary.case_count} passed`;

  log(`\ndx evals run: complete — ${passRate}`);
  log(`  Run dir: ${runDir}`);
  log(`  Summary: ${runDir}/summary.md`);

  if (useJson) {
    process.stdout.write(
      JSON.stringify(
        {
          run_id: summary.meta.runId,
          run_dir: runDir,
          pass_count: summary.pass_count,
          case_count: summary.case_count,
          status: summary.error_count === 0 ? "ok" : "partial",
        },
        null,
        2,
      ) + "\n",
    );
  }
}

async function actionEvalsRunMatrix(
  opts: RunOptions,
  corpus: string,
  matrixRaw: string[],
  log: (msg: string) => void,
  useJson: boolean,
): Promise<void> {
  // Parse --matrix flags
  let axisSpecs;
  try {
    axisSpecs = parseMatrixFlags(matrixRaw);
  } catch (err) {
    process.stderr.write(`dx evals run: ${String(err)}\n`);
    process.exit(2);
  }

  // Validate: gin corpus + prompt axis → error
  const hasPromptAxis = axisSpecs.some((a) => a.axis === "prompt");
  if (corpus === "gin" && hasPromptAxis) {
    process.stderr.write(
      `dx evals run: --matrix prompt= is not supported for the gin corpus: ` +
        `Gin cases embed their prompt; --matrix prompt= is Effi-only.\n`,
    );
    process.exit(2);
  }

  // For gin corpus with no prompt axis: use "(embedded)" so cellSlug omits the
  // prompt segment (slug becomes model_<model> instead of model_<model>__prompt_...).
  const defaultPrompt = corpus === "effi" || hasPromptAxis ? DEFAULT_PROMPT_NAME : "(embedded)";
  const cells = cartesian(axisSpecs, { model: DEFAULT_MODEL, prompt: defaultPrompt });

  log(
    `dx evals run (matrix): corpus=${corpus} suite=${opts.suite} ` +
      `${cells.length} cells judge=${opts.judgeModel}${opts.dryRun ? " [DRY-RUN]" : ""}`,
  );

  // Resolve prompts for effi corpus — validate all prompt names up front
  if (corpus === "effi") {
    const promptNames = [...new Set(cells.map((c) => c.prompt))];
    for (const name of promptNames) {
      try {
        resolvePrompt(corpus, name);
      } catch (err) {
        process.stderr.write(`dx evals run: ${String(err)}\n`);
        process.exit(1);
      }
    }
  }

  // Load cases
  let cases;
  try {
    cases = loadCases(corpus, opts.case);
  } catch (err) {
    process.stderr.write(`dx evals run: ${String(err)}\n`);
    process.exit(1);
  }
  log(`  Loaded ${cases.length} case(s)`);

  // Pre-load DoGs for all cases
  const dogsByCase = new Map();
  for (const evalCase of cases) {
    try {
      const dog = loadDog(evalCase.dog_ref, corpus, evalCase._file_path);
      dogsByCase.set(evalCase.id, dog);
    } catch (err) {
      process.stderr.write(
        `dx evals run: failed to load DoG for case ${evalCase.id}: ${String(err)}\n`,
      );
      process.exit(1);
    }
  }

  const startedAt = new Date().toISOString();

  let matrixResult;
  try {
    matrixResult = await runMatrix(
      corpus,
      opts.suite,
      cells,
      cases,
      dogsByCase,
      opts.judgeModel,
      opts.dryRun,
      opts.baseline,
      startedAt,
      log,
    );
  } catch (err) {
    process.stderr.write(`dx evals run: matrix run failed: ${String(err)}\n`);
    process.exit(1);
  }

  const { runDir, runId } = matrixResult;
  log(`\ndx evals run (matrix): complete`);
  log(`  Run dir: ${runDir}`);
  log(`  Matrix:  ${runDir}/matrix.md`);

  if (useJson) {
    process.stdout.write(
      JSON.stringify(
        {
          run_id: runId,
          run_dir: runDir,
          cell_count: cells.length,
          status: "ok",
        },
        null,
        2,
      ) + "\n",
    );
  }
}
