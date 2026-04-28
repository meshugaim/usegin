/**
 * `dx evals run` — single-axis runner.
 *
 * For one model + one prompt + one suite of cases: run each case, score via
 * single Opus judge against its DoG, write results to
 * usegin/evals/<corpus>/runs/<ts>-<sha7>-<slug>/.
 *
 * Flags:
 *   --corpus <effi|gin>        (required)
 *   --suite  <name>            (default: "default" = all cases/*.json)
 *   --case   <id>              (optional; restricts to one case)
 *   --model  <model>           (default: claude-sonnet-4-6)
 *   --prompt <path>            (default: corpus-appropriate default)
 *   --judge-model <model>      (default: claude-opus-4-7)
 *   --baseline <run-id>        (optional)
 *   --dry-run                  (skip API calls; deterministic stubs)
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { loadCases } from "../lib/case-loader";
import { loadDog } from "../lib/dog-loader";
import { runCase } from "../lib/runner";
import { writeRunResults } from "../lib/writer";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_JUDGE_MODEL = "claude-opus-4-7";
const DEFAULT_EFFI_PROMPT = "python-services/agent_api/agent/effi_system_prompt.py";

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
}

export function buildEvalsRunCommand(): Command {
  return new Command("run")
    .description(
      "Run eval suite — one model × one prompt × all cases in suite. " +
        "Scores each case via Opus judge and writes results to usegin/evals/<corpus>/runs/.",
    )
    .requiredOption("--corpus <corpus>", "Corpus to run against: effi or gin")
    .option("--suite <name>", "Suite name (default: 'default' = all cases)", "default")
    .option("--case <id>", "Restrict to a single case ID")
    .option("--model <model>", "Model to use for the agent", DEFAULT_MODEL)
    .option(
      "--prompt <path>",
      "Path to system prompt. Defaults to effi_system_prompt.py for effi corpus",
    )
    .option("--judge-model <model>", "Model to use for the judge", DEFAULT_JUDGE_MODEL)
    .option("--baseline <run-id>", "Baseline run ID for delta comparison")
    .option("--dry-run", "Skip API calls; write deterministic stub results")
    .option("--json", "Output JSON summary to stdout")
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

  const promptRef = opts.prompt ?? (corpus === "effi" ? DEFAULT_EFFI_PROMPT : "(embedded in case)");
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
