/**
 * `dx evals iterate` (S5) — DoG-driven autonomous prompt mutation loop.
 *
 * Spawns N stateless worker mutations of the prompt-under-iteration per
 * generation, scores them via the existing matrix-runner stack against
 * the same fixed (case + DoG + judge), takes the discipline-reviewer-cleared
 * winner, and repeats until DoG met / budget exhausted / plateau / all
 * winners vetoed.
 *
 * Cases, scorers, dogs, and the original (non-sandbox) prompt path are
 * write-locked by `.claude/skills/evals-iterate/hooks/pre-tool-use.sh`.
 *
 * See: usegin/evals/BUILD-PLAN.md S5
 */

import { Command } from "commander";
import { resolve, isAbsolute } from "path";
import { existsSync } from "fs";
import { dxShouldOutputJson } from "../../output";
import { runDirector } from "../lib/iterate-director";
import { dogsDir } from "../lib/case-loader";

const DEFAULT_BUDGET = 10;
const DEFAULT_WIDTH = 4;
const DEFAULT_WORKER_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_JUDGE_MODEL = "claude-opus-4-7";
const DEFAULT_SCORE_MODEL = "claude-sonnet-4-6";
const DEFAULT_PLATEAU_PP = 1.0;
const DEFAULT_PLATEAU_WINDOW = 3;

interface IterateOptions {
  corpus: string;
  dog: string;
  case: string;
  budget: string;
  width: string;
  workerModel: string;
  judgeModel: string;
  scoreModel: string;
  plateau: string;
  plateauWindow: string;
  dryRun?: boolean;
  json?: boolean;
  /** Hidden test toggles. */
  stubInjectCheat?: boolean;
  stubPlateau?: boolean;
}

/**
 * Resolve a DoG path. Accepts:
 *   - absolute path
 *   - path relative to cwd
 *   - "<corpus>/dogs/<file>" form (legacy convenience)
 *   - bare "<name>.md" → resolved against `usegin/evals/<corpus>/dogs/`
 */
function resolveDogPath(dogArg: string, corpus: string): string {
  if (isAbsolute(dogArg)) return dogArg;
  // try cwd-relative first
  const cwdRel = resolve(process.cwd(), dogArg);
  if (existsSync(cwdRel)) return cwdRel;
  // try corpus dogs dir + basename
  const corpusRel = resolve(dogsDir(corpus), dogArg.replace(/^.*\//, ""));
  if (existsSync(corpusRel)) return corpusRel;
  // last-ditch: assume the user meant <corpus>/dogs/<rest-of-path>
  // (handles "effi/dogs/citation-faithful.md" passed from anywhere)
  const stripped = dogArg.replace(new RegExp(`^${corpus}/dogs/`), "");
  return resolve(dogsDir(corpus), stripped);
}

export function buildEvalsIterateCommand(): Command {
  return new Command("iterate")
    .description(
      "DoG-driven autonomous prompt mutation loop. " +
        "Spawns N workers per generation; scores with the same fixed eval; " +
        "stops at goal, budget, plateau, or veto.",
    )
    .argument("<prompt-name>", "Prompt under iteration (resolved via prompt-resolver)")
    .requiredOption("--dog <path>", "DoG markdown file (relative to cwd or <corpus>/dogs/)")
    .requiredOption("--corpus <corpus>", "Corpus: effi or gin (gin is stub-only at v0)")
    .requiredOption("--case <id>", "Case ID to drive the iterate loop (one-case at v0)")
    .option("--budget <n>", "Max generations", String(DEFAULT_BUDGET))
    .option("--width <n>", "Workers per generation", String(DEFAULT_WIDTH))
    .option("--worker-model <model>", "Anthropic model used for mutation workers", DEFAULT_WORKER_MODEL)
    .option("--judge-model <model>", "Anthropic model used for the judge / discipline reviewer", DEFAULT_JUDGE_MODEL)
    .option("--score-model <model>", "Anthropic model used to generate the agent answer being judged", DEFAULT_SCORE_MODEL)
    .option("--plateau <pp>", "Stop if best score doesn't improve by this many pp over the window", String(DEFAULT_PLATEAU_PP))
    .option("--plateau-window <n>", "Window of generations over which to measure plateau", String(DEFAULT_PLATEAU_WINDOW))
    .option("--dry-run", "Skip API calls; use deterministic stubs (CI-friendly)")
    .option("--json", "Output JSON summary to stdout")
    // Hidden test toggles — documented but not advertised in --help body
    .option("--stub-inject-cheat", "(testing) inject a cheat-suspect mutation in dry-run gen 1 worker 0", false)
    .option("--stub-plateau", "(testing) deterministic flat scoring in dry-run", false)
    .action(actionIterate);
}

async function actionIterate(
  promptName: string,
  opts: IterateOptions,
): Promise<void> {
  const useJson = dxShouldOutputJson(opts);
  const log = (msg: string) => process.stderr.write(msg + "\n");

  if (opts.corpus !== "effi" && opts.corpus !== "gin") {
    process.stderr.write(`dx evals iterate: --corpus must be "effi" or "gin", got: ${opts.corpus}\n`);
    process.exit(2);
  }
  if (opts.corpus === "gin" && !opts.dryRun) {
    process.stderr.write(
      "dx evals iterate: gin corpus is stub-only at v0 — pass --dry-run\n",
    );
    process.exit(2);
  }

  const budget = parseInt(opts.budget, 10);
  const width = parseInt(opts.width, 10);
  const plateauPp = parseFloat(opts.plateau);
  const plateauWindow = parseInt(opts.plateauWindow, 10);

  for (const [name, val] of [
    ["--budget", budget],
    ["--width", width],
    ["--plateau-window", plateauWindow],
  ] as const) {
    if (!Number.isFinite(val) || val <= 0) {
      process.stderr.write(`dx evals iterate: ${name} must be a positive integer\n`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(plateauPp) || plateauPp < 0) {
    process.stderr.write("dx evals iterate: --plateau must be a non-negative number\n");
    process.exit(2);
  }

  const dogPath = resolveDogPath(opts.dog, opts.corpus);
  if (!existsSync(dogPath)) {
    process.stderr.write(`dx evals iterate: DoG not found at ${dogPath}\n`);
    process.exit(1);
  }

  let result;
  try {
    result = await runDirector({
      promptName,
      dogPath,
      corpus: opts.corpus as "effi" | "gin",
      caseId: opts.case,
      budget,
      width,
      workerModel: opts.workerModel,
      judgeModel: opts.judgeModel,
      scoreModel: opts.scoreModel,
      plateauPp,
      plateauWindow,
      dryRun: Boolean(opts.dryRun),
      stubInjectCheat: Boolean(opts.stubInjectCheat),
      stubPlateau: Boolean(opts.stubPlateau),
      log,
    });
  } catch (err) {
    process.stderr.write(`dx evals iterate: ${String(err)}\n`);
    process.exit(1);
  }

  log("");
  log(`dx evals iterate: complete — stop=${result.meta.stopReason}`);
  log(`  Run dir: ${result.runDir}`);
  log(`  Decision: ${result.runDir}/decision.md`);

  if (useJson) {
    process.stdout.write(
      JSON.stringify(
        {
          run_id: result.meta.runId,
          run_dir: result.runDir,
          stop_reason: result.meta.stopReason,
          best_score: result.meta.bestScore,
          best_generation: result.meta.bestGeneration,
          best_worker_index: result.meta.bestWorkerIndex,
          warning: result.meta.winnerWarning ?? null,
        },
        null,
        2,
      ) + "\n",
    );
  }
}
