/**
 * iterate-director.ts — DoG-driven autonomous mutation Director (S5).
 *
 * For each generation:
 *   1. Propose: spawn `width` worker mutations of the current best prompt.
 *      Each worker gets the failing dimensions and a "tweak the prompt"
 *      charter; in --dry-run, deterministic stub mutations are used.
 *   2. Sandbox: write each mutation to
 *      `usegin/evals/sandbox/<run-id>/gen-NNN/worker-MM/<prompt-name>.md`.
 *   3. Score: invoke the matrix-runner (S4) with one cell per worker; the
 *      runner produces per-dim scores against the fixed case + DoG. In
 *      --dry-run, a deterministic stub climbs scores per generation.
 *   4. Leaderboard: rank by overall mean score; top is the gen winner.
 *   5. Discipline check: spawn ONE Opus review per gen winner; in dry-run,
 *      a deterministic stub flags only the cheat suffix. Vetoed → drop to
 *      next-best.
 *   6. Stop conditions:
 *        (a) all DoG dim thresholds met → `dog_met`
 *        (b) budget exhausted          → `budget_exhausted`
 *        (c) plateau                    → `plateau`
 *        (d) every winner vetoed       → `all_winners_vetoed`
 *   7. Promote: write meta.json, leaderboard.md, winner.diff, decision.md
 *      via iterate-writer.
 *
 * v0 Director is a regular Bun process (NOT a headless Claude session).
 * It calls Anthropic SDK only for live mutations + live discipline review.
 * The judge calls (per cell) flow through the existing matrix/runner stack.
 */

import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from "fs";
import { join } from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { resolvePrompt } from "./prompt-resolver";
import { loadCases } from "./case-loader";
import type { EvalCase } from "./case-loader";
import { loadDog } from "./dog-loader";
import type { DogDocument, DogDimension } from "./dog-loader";
import { runCase } from "./runner";
import type { CaseResult } from "./runner";
import { evaluateDimensions } from "./judge";
import {
  iterateRunsDir,
  sandboxDir,
  genSlug,
  workerSlug,
  makeIterateRunId,
  writeProposedPrompt,
  writeGenerationProposalsMd,
  writeIterateMeta,
  writeLeaderboardMd,
  writeWinnerDiff,
  writeDecisionMd,
} from "./iterate-writer";
import type {
  GenerationRecord,
  IterateMeta,
  ProposalRecord,
  StopReason,
  DimScore,
} from "./iterate-writer";
import {
  stubMutate,
  stubReview,
  stubScore,
  STUB_CHEAT_SUFFIX,
} from "./iterate-stub";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DirectorOptions {
  promptName: string;
  dogPath: string;          // resolved absolute path
  corpus: "effi" | "gin";
  caseId: string;
  budget: number;           // max generations
  width: number;            // workers per generation
  workerModel: string;
  judgeModel: string;
  scoreModel: string;
  plateauPp: number;        // percentage points
  plateauWindow: number;    // window size (in generations)
  dryRun: boolean;
  /**
   * Internal stub-mode toggle: in dry-run, when true, worker-0 of gen-1
   * emits a literal-answer "cheat" mutation (used by tests).
   */
  stubInjectCheat?: boolean;
  /**
   * Internal stub-mode toggle: in dry-run, scores never climb (used by tests).
   */
  stubPlateau?: boolean;
  /** Override the started-at timestamp (for deterministic tests). */
  startedAt?: string;
  log?: (msg: string) => void;
}

export interface DirectorResult {
  runDir: string;
  meta: IterateMeta;
  generations: GenerationRecord[];
}

// ---------------------------------------------------------------------------
// Stop-condition helpers
// ---------------------------------------------------------------------------

function allDimsMeet(dims: DimScore[]): boolean {
  if (dims.length === 0) return false;
  return dims.every((d) => d.pass);
}

function isPlateau(
  generations: GenerationRecord[],
  plateauPp: number,
  plateauWindow: number,
): boolean {
  if (generations.length < plateauWindow + 1) return false;
  // "best over last K gens improved by ≤ Δpp" — spec wants positive-direction only.
  // Compare best-within-window to best-before-window; regressions are a separate signal.
  const priorGens = generations.slice(0, -plateauWindow);
  const recentGens = generations.slice(-plateauWindow);
  const priorBest = Math.max(...priorGens.map((g) => g.winnerScore));
  const recentBest = Math.max(...recentGens.map((g) => g.winnerScore));
  const improvementPp = (recentBest - priorBest) * 100;
  // Only stop on plateau when improvement is non-negative but too small.
  // Regressions (improvementPp < 0) don't trip the plateau condition.
  return improvementPp >= 0 && improvementPp <= plateauPp;
}

// ---------------------------------------------------------------------------
// Worker mutation
// ---------------------------------------------------------------------------

interface MutationResult {
  text: string;
  /** One-line summary of what changed (for proposals.md). */
  summary: string;
}

async function mutatePrompt(
  client: Anthropic | null,
  baselineText: string,
  generation: number,
  workerIndex: number,
  workerModel: string,
  failingDims: DimDescriptor[],
  dryRun: boolean,
  injectCheat: boolean,
): Promise<MutationResult> {
  if (dryRun) {
    const text = stubMutate({
      promptText: baselineText,
      generation,
      workerIndex,
      cheat: injectCheat,
    });
    const isCheat = text.includes(STUB_CHEAT_SUFFIX);
    return {
      text,
      summary: isCheat
        ? "stub: literal-answer cheat suffix"
        : `stub: rotating anti-Goodhart suffix #${(generation * 7 + workerIndex) % 6}`,
    };
  }

  if (!client) {
    throw new Error("iterate-director: live mode requires Anthropic client");
  }

  const failingList =
    failingDims.length === 0
      ? "(no failing dimensions reported; baseline run was clean — explore stylistic variation)"
      : failingDims
          .map((d) => `- ${d.name} (${d.threshold}) — ${d.notes}`)
          .join("\n");

  const sys = [
    "You are a prompt-mutation worker inside an evals iterate loop.",
    "Your job is to produce ONE candidate revision of the prompt below.",
    "Return ONLY the new prompt text inside a single fenced code block.",
    "Do not address the user. Do not explain. Do not add commentary.",
    "The prompt under iteration is treated as a system prompt for an LLM agent.",
    "",
    "Constraints:",
    "- Address at least one of the failing DoG dimensions.",
    "- Do not literally embed the expected answer to a case (this is a Goodhart cheat and will be vetoed).",
    "- Keep the prompt small enough to fit in a single context.",
  ].join("\n");

  const usr = [
    `# Failing DoG dimensions (worker ${workerIndex} of generation ${generation})`,
    failingList,
    "",
    "# Current prompt",
    "```",
    baselineText,
    "```",
    "",
    "Return ONLY the new prompt text in one fenced ``` block.",
  ].join("\n");

  const resp = await client.messages.create({
    model: workerModel,
    max_tokens: 2048,
    system: sys,
    messages: [{ role: "user", content: usr }],
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("iterate-director: worker returned no text");
  }
  const fenced = /```[a-zA-Z]*\n([\s\S]*?)```/.exec(textBlock.text);
  const text = (fenced ? fenced[1] : textBlock.text).trim() + "\n";
  return {
    text,
    summary: `live worker (${workerModel}) — ${text.length} chars`,
  };
}

// ---------------------------------------------------------------------------
// Discipline review
// ---------------------------------------------------------------------------

async function reviewWinner(
  client: Anthropic | null,
  diffText: string,
  generation: number,
  workerIndex: number,
  judgeModel: string,
  dryRun: boolean,
): Promise<{ cheated: boolean; reasoning: string }> {
  if (dryRun) {
    return stubReview({ diff: diffText, generation, workerIndex });
  }
  if (!client) {
    throw new Error("iterate-director: live review requires Anthropic client");
  }
  const sys = [
    "You are the discipline reviewer for an evals iterate loop.",
    "Given a prompt diff (between baseline and a candidate winner), decide:",
    "did this mutation cheat the scorer?",
    "Cheats include: literally embedding the expected answer, addressing the case prompt directly,",
    "or degrading unmeasured behavior to satisfy a measured one.",
    "Return ONLY JSON of the shape: {\"cheated\": <bool>, \"reasoning\": \"<one paragraph>\"}.",
  ].join("\n");
  const resp = await client.messages.create({
    model: judgeModel,
    max_tokens: 512,
    system: sys,
    messages: [{ role: "user", content: diffText }],
  });
  const tb = resp.content.find((b) => b.type === "text");
  if (!tb || tb.type !== "text") return { cheated: false, reasoning: "no text" };
  const cleaned = tb.text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      cheated?: unknown;
      reasoning?: unknown;
    };
    return {
      cheated: Boolean(parsed.cheated),
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    };
  } catch {
    return { cheated: false, reasoning: "review JSON parse failed" };
  }
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

interface DimDescriptor {
  name: string;
  threshold: string;
  notes: string;
}

function describeDimensions(dog: DogDocument): DimDescriptor[] {
  return dog.dimensions.map((d) => ({
    name: d.name,
    threshold: d.threshold,
    notes: d.how_measured,
  }));
}

/**
 * Score one proposal by writing the prompt to its sandbox cell and invoking
 * the existing per-case runner.
 *
 * In dry-run, the per-dim scores come from stubScore so we can drive the
 * Director's stop conditions deterministically.
 */
async function scoreProposal(
  evalCase: EvalCase,
  dog: DogDocument,
  scoreModel: string,
  judgeModel: string,
  generation: number,
  workerIndex: number,
  width: number,
  isCheater: boolean,
  dryRun: boolean,
  stubPlateau: boolean,
): Promise<{ dimScores: DimScore[]; overall: number }> {
  if (dryRun) {
    const dimScores: DimScore[] = dog.dimensions.map((d, i) => {
      const score = stubScore({
        generation,
        workerIndex,
        width,
        dimensionIndex: i,
        dimensionType: d.type,
        plateauMode: stubPlateau,
        isCheater,
      });
      return {
        name: d.name,
        score,
        pass: meetsThreshold(score, d.threshold, d.type),
      };
    });
    const overall =
      dimScores.reduce((s, x) => s + x.score, 0) / dimScores.length;
    return { dimScores, overall };
  }

  // Live mode: delegate to runCase which calls the SDK + judge.
  const r: CaseResult = await runCase(
    evalCase,
    dog,
    scoreModel,
    judgeModel,
    /* dryRun= */ false,
  );
  const evaluated =
    r.judgeResult !== undefined
      ? evaluateDimensions(r.judgeResult, dog.dimensions)
      : [];
  const dimScores: DimScore[] = evaluated.map((d) => ({
    name: d.name,
    score: d.score,
    pass: d.pass,
  }));
  const overall =
    dimScores.length > 0
      ? dimScores.reduce((s, x) => s + x.score, 0) / dimScores.length
      : 0;
  return { dimScores, overall };
}

// duplicated tiny helper from judge.ts to avoid an export cycle
function meetsThreshold(
  score: number,
  threshold: string,
  type: string,
): boolean {
  const t = threshold.trim();
  if (type === "bool" || t === "== true") return score === 1;
  if (t === "== false") return score === 0;
  const m = /^([><=!]+)\s*([\d.]+)$/.exec(t);
  if (!m) return false;
  const v = parseFloat(m[2]);
  switch (m[1]) {
    case ">=": return score >= v;
    case ">": return score > v;
    case "<=": return score <= v;
    case "<": return score < v;
    case "==": return score === v;
    case "!=": return score !== v;
    default: return false;
  }
}

// ---------------------------------------------------------------------------
// Sandbox helpers
// ---------------------------------------------------------------------------

function writeSandboxCopy(
  runId: string,
  corpus: string,
  generation: number,
  workerIndex: number,
  promptName: string,
  promptText: string,
): string {
  const dir = join(
    sandboxDir(corpus),
    runId,
    genSlug(generation),
    workerSlug(workerIndex),
  );
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${promptName}.md`);
  writeFileSync(filePath, promptText);
  return filePath;
}

// ---------------------------------------------------------------------------
// Main Director loop
// ---------------------------------------------------------------------------

export async function runDirector(
  opts: DirectorOptions,
): Promise<DirectorResult> {
  const log = opts.log ?? (() => {});
  const startedAt = opts.startedAt ?? new Date().toISOString();

  // Load baseline prompt + case + DoG
  const resolved = resolvePrompt(opts.corpus, opts.promptName);
  const baselinePromptPath = resolved.sourcePath;
  let baselineText = resolved.text;

  const cases = loadCases(opts.corpus, opts.caseId);
  if (cases.length === 0) {
    throw new Error(
      `iterate-director: case ${opts.caseId} not found in corpus ${opts.corpus}`,
    );
  }
  const evalCase = cases[0];
  const dog = loadDog(evalCase.dog_ref, opts.corpus, evalCase._file_path);

  const runId = makeIterateRunId(startedAt, opts.promptName, opts.caseId);
  const runDir = join(iterateRunsDir(opts.corpus), runId);
  mkdirSync(runDir, { recursive: true });
  // Snapshot the baseline prompt at run start so winner.diff is stable
  const baselineSnapshot = join(runDir, `baseline-${opts.promptName}.md`);
  copyFileSync(baselinePromptPath, baselineSnapshot);

  // Live mode: one shared SDK client. Dry-run: never instantiated.
  const client = opts.dryRun
    ? null
    : new (await import("@anthropic-ai/sdk")).default();

  const dimDescriptors = describeDimensions(dog);

  log(
    `iterate: run=${runId} case=${opts.caseId} budget=${opts.budget} width=${opts.width}` +
      (opts.dryRun ? " [DRY-RUN]" : ""),
  );

  const generations: GenerationRecord[] = [];
  let stopReason: StopReason | null = null;
  let bestProposal: ProposalRecord | null = null;
  let bestGeneration = 0;
  let winnerWarning: string | undefined;
  let currentBestText = baselineText;

  // Track failing dim names to feed the next mutation
  let failingDimDescriptors: DimDescriptor[] = dimDescriptors;

  for (let gen = 1; gen <= opts.budget; gen++) {
    log(`  gen ${gen}: spawning ${opts.width} workers`);

    const proposals: ProposalRecord[] = [];

    for (let w = 0; w < opts.width; w++) {
      // Compute isCheater once and reuse (fix #10 — was computed twice).
      const isCheater =
        Boolean(opts.stubInjectCheat) && gen === 1 && w === 0;

      // Mutate
      const mutation = await mutatePrompt(
        client,
        currentBestText,
        gen,
        w,
        opts.workerModel,
        failingDimDescriptors,
        opts.dryRun,
        isCheater,
      );

      // Sandbox copy
      const sandboxPath = writeSandboxCopy(
        runId,
        opts.corpus,
        gen,
        w,
        opts.promptName,
        mutation.text,
      );

      // Promotable copy
      const promotedPath = writeProposedPrompt(
        runDir,
        gen,
        w,
        opts.promptName,
        mutation.text,
      );

      // Score
      const { dimScores, overall } = await scoreProposal(
        evalCase,
        dog,
        opts.scoreModel,
        opts.judgeModel,
        gen,
        w,
        opts.width,
        isCheater,
        opts.dryRun,
        Boolean(opts.stubPlateau),
      );

      proposals.push({
        generation: gen,
        workerIndex: w,
        mutationSummary: mutation.summary,
        overallScore: overall,
        allDimsPass: allDimsMeet(dimScores),
        dimScores,
        promotedPromptPath: promotedPath,
        sandboxPromptPath: sandboxPath,
      });
    }

    // Rank: by overall score descending, ties broken by per-dim min
    proposals.sort((a, b) => {
      if (b.overallScore !== a.overallScore)
        return b.overallScore - a.overallScore;
      const minA = Math.min(...a.dimScores.map((d) => d.score), 1);
      const minB = Math.min(...b.dimScores.map((d) => d.score), 1);
      return minB - minA;
    });

    // Discipline-check ranked candidates in order; first un-vetoed wins
    let winnerIdx = -1;
    for (let i = 0; i < proposals.length; i++) {
      const cand = proposals[i]!;
      // diff = baseline → candidate
      const diffText =
        `--- baseline\n+++ candidate (gen ${gen} worker ${cand.workerIndex})\n` +
        cand.promotedPromptPath +
        "\n";
      // Use the actual file content for the review payload
      let actualDiff = diffText;
      try {
        actualDiff = readFileSync(cand.promotedPromptPath, "utf-8");
      } catch {
        // fall back to placeholder
      }
      const review = await reviewWinner(
        client,
        actualDiff,
        gen,
        cand.workerIndex,
        opts.judgeModel,
        opts.dryRun,
      );
      cand.cheated = review.cheated;
      cand.cheatReason = review.reasoning;
      if (!review.cheated) {
        winnerIdx = i;
        break;
      }
    }

    const allVetoed = winnerIdx === -1;
    const effectiveWinner = allVetoed ? proposals[0]! : proposals[winnerIdx]!;
    const genRecord: GenerationRecord = {
      generation: gen,
      proposals,
      winnerIndex: effectiveWinner.workerIndex,
      winnerScore: effectiveWinner.overallScore,
    };
    generations.push(genRecord);

    // Persist this generation's table immediately
    writeGenerationProposalsMd(runDir, genRecord);

    log(
      `    winner: worker-${effectiveWinner.workerIndex} score=${effectiveWinner.overallScore.toFixed(3)}` +
        (allVetoed ? " [ALL VETOED]" : ""),
    );

    if (allVetoed) {
      // Every candidate this gen was a cheat-suspect. Keep the clean prior
      // best if one exists — don't let a cheater overwrite it (fix #2).
      stopReason = "all_winners_vetoed";
      if (!bestProposal) {
        // No clean winner recorded yet; surface the cheat-suspect as last-resort
        // but flag it clearly in the warning.
        bestProposal = effectiveWinner;
        bestGeneration = gen;
        winnerWarning =
          `all_winners_vetoed — gen-${gen} produced only cheat-suspects; ` +
          `no clean prior best existed; the promoted candidate is a cheat-suspect`;
      } else {
        winnerWarning =
          `all_winners_vetoed — gen-${gen} produced only cheat-suspects; ` +
          `prior best from gen-${bestGeneration} retained`;
      }
      break;
    }

    // Check stop conditions BEFORE carrying the winner forward (fix #3) so a
    // final-iteration read failure can't crash before recording the stop_reason.
    if (allDimsMeet(effectiveWinner.dimScores)) {
      // Update best before breaking so the promoted winner is correct.
      if (!bestProposal || effectiveWinner.overallScore > bestProposal.overallScore) {
        bestProposal = effectiveWinner;
        bestGeneration = gen;
      }
      stopReason = "dog_met";
      break;
    }
    if (gen >= opts.budget) {
      if (!bestProposal || effectiveWinner.overallScore > bestProposal.overallScore) {
        bestProposal = effectiveWinner;
        bestGeneration = gen;
      }
      stopReason = "budget_exhausted";
      break;
    }

    // Update best-so-far (only clean winners — allVetoed branch is handled above)
    if (
      !bestProposal ||
      effectiveWinner.overallScore > bestProposal.overallScore
    ) {
      bestProposal = effectiveWinner;
      bestGeneration = gen;
    }

    // Carry the winner forward as the new baseline for the next generation
    currentBestText = readFileSync(effectiveWinner.promotedPromptPath, "utf-8");
    // Update failing-dim descriptors for next gen
    failingDimDescriptors = effectiveWinner.dimScores
      .filter((d) => !d.pass)
      .map((d) => {
        const def = dog.dimensions.find((dd) => dd.name === d.name) as
          | DogDimension
          | undefined;
        return {
          name: d.name,
          threshold: def?.threshold ?? "",
          notes: def?.how_measured ?? "",
        };
      });

    if (isPlateau(generations, opts.plateauPp, opts.plateauWindow)) {
      stopReason = "plateau";
      break;
    }
  }

  if (stopReason === null) {
    // Loop fell off the end without hitting any explicit stop — treat as budget
    stopReason = "budget_exhausted";
  }

  if (!bestProposal) {
    throw new Error(
      "iterate-director: no proposals were produced (budget=0 or width=0?)",
    );
  }

  const finishedAt = new Date().toISOString();
  const meta: IterateMeta = {
    runId,
    corpus: opts.corpus,
    promptName: opts.promptName,
    dogPath: opts.dogPath,
    caseId: opts.caseId,
    budget: opts.budget,
    width: opts.width,
    workerModel: opts.workerModel,
    judgeModel: opts.judgeModel,
    scoreModel: opts.scoreModel,
    plateauPp: opts.plateauPp,
    plateauWindow: opts.plateauWindow,
    startedAt,
    finishedAt,
    stopReason,
    bestGeneration,
    bestWorkerIndex: bestProposal.workerIndex,
    bestScore: bestProposal.overallScore,
    dryRun: opts.dryRun,
    winnerWarning,
  };

  writeIterateMeta(runDir, meta);
  writeLeaderboardMd(runDir, meta, generations);
  writeWinnerDiff(
    runDir,
    baselineSnapshot,
    bestProposal.promotedPromptPath,
  );
  writeDecisionMd(
    runDir,
    meta,
    baselineSnapshot,
    bestProposal.promotedPromptPath,
  );

  log(
    `iterate: complete stop=${stopReason} best=gen${bestGeneration}/worker-${bestProposal.workerIndex} ` +
      `score=${bestProposal.overallScore.toFixed(3)}`,
  );

  return { runDir, meta, generations };
}
