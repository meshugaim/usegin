/**
 * iterate-writer.ts — Persist the Director's per-run artifacts to
 * `usegin/evals/<corpus>/iterate-runs/<run-id>/`.
 *
 * Layout:
 *   meta.json            — config + started/finished + budget + stop_reason
 *   leaderboard.md       — per-generation table (model | gen | worker |
 *                          score per dim | cheat? | winner?)
 *   winner.diff          — `git diff --no-index` baseline.md ↔ winner.md
 *   decision.md          — z020-shape decision (decided X / why / next)
 *   gen-NNN/proposals.md — one row per worker (mutation summary + score)
 *   gen-NNN/worker-MM/<prompt-name>.md — the proposed mutation
 *
 * Sandbox copies stay under `usegin/evals/sandbox/<run-id>/...`; this writer
 * does NOT touch the sandbox — that's the Director's job. We only persist
 * the promotable artifact class.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { spawnSync } from "child_process";
import { runsDir } from "./case-loader";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * iterate-runs lives sibling to runs/ under the corpus dir.
 * Reuse case-loader's `runsDir` to derive the corpus root, then sibling.
 */
export function iterateRunsDir(corpus: string): string {
  // runsDir(corpus) = …/usegin/evals/<corpus>/runs
  const r = runsDir(corpus);
  return join(dirname(r), "iterate-runs");
}

/**
 * Sandbox lives at repo-root level under usegin/evals/sandbox/<run-id>/.
 * Gitignored at usegin/evals/.gitignore.
 */
export function sandboxDir(corpus: string): string {
  // Walk: usegin/evals/<corpus>/runs → usegin/evals/<corpus> → usegin/evals
  const corpusRoot = dirname(runsDir(corpus));
  return join(dirname(corpusRoot), "sandbox");
}

export function genSlug(generation: number): string {
  return `gen-${String(generation).padStart(3, "0")}`;
}
export function workerSlug(workerIndex: number): string {
  return `worker-${String(workerIndex).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StopReason =
  | "dog_met"
  | "budget_exhausted"
  | "plateau"
  | "all_winners_vetoed";

export interface IterateMeta {
  runId: string;
  corpus: string;
  promptName: string;
  dogPath: string;
  caseId: string;
  budget: number;
  width: number;
  workerModel: string;
  judgeModel: string;
  scoreModel: string;
  plateauPp: number;
  plateauWindow: number;
  startedAt: string;
  finishedAt: string;
  stopReason: StopReason;
  bestGeneration: number;
  bestWorkerIndex: number;
  bestScore: number;
  dryRun: boolean;
  /** True if the promoted winner came from a non-vetoed cheat-suspect. */
  winnerWarning?: string;
}

export interface DimScore {
  name: string;
  score: number;
  pass: boolean;
}

export interface ProposalRecord {
  generation: number;
  workerIndex: number;
  /** One-line description of the mutation this worker introduced. */
  mutationSummary: string;
  /** Aggregate score (mean of dim scores). */
  overallScore: number;
  /** Whether all DoG dim thresholds were met. */
  allDimsPass: boolean;
  dimScores: DimScore[];
  /** Discipline-reviewer verdict, only filled for the gen winner. */
  cheated?: boolean;
  cheatReason?: string;
  /** Path to the proposed prompt file inside iterate-runs/<id>/gen-NNN/worker-MM/. */
  promotedPromptPath: string;
  /** Path to the sandbox copy of the proposed prompt. */
  sandboxPromptPath: string;
}

export interface GenerationRecord {
  generation: number;
  proposals: ProposalRecord[];
  winnerIndex: number;
  /** Score that won this generation. */
  winnerScore: number;
}

// ---------------------------------------------------------------------------
// Run-id generation
// ---------------------------------------------------------------------------

function gitSha7(): string {
  const r = spawnSync("git", ["rev-parse", "--short=7", "HEAD"], {
    encoding: "utf-8",
  });
  return (r.stdout ?? "").trim() || "unknown";
}

export function makeIterateRunId(
  startedAt: string,
  promptName: string,
  caseId: string,
): string {
  const ts = startedAt.replace(/[:.]/g, "-");
  const slug = `${promptName}-${caseId}`.replace(/[^a-z0-9-]/gi, "-").slice(0, 30);
  return `${ts}-${gitSha7()}-iter-${slug}`;
}

// ---------------------------------------------------------------------------
// Per-generation directory + proposal writer
// ---------------------------------------------------------------------------

/**
 * Create the per-worker directory under iterate-runs/<id>/gen-NNN/worker-MM/
 * and write the proposed prompt file there. Returns the path.
 *
 * The same prompt is also kept in the sandbox; this is the *promotable*
 * copy (sandbox is gitignored, this is committed).
 */
export function writeProposedPrompt(
  runDir: string,
  generation: number,
  workerIndex: number,
  promptName: string,
  promptText: string,
): string {
  const dir = join(runDir, genSlug(generation), workerSlug(workerIndex));
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${promptName}.md`);
  writeFileSync(filePath, promptText);
  return filePath;
}

/**
 * Append the per-generation proposals.md table.
 */
export function writeGenerationProposalsMd(
  runDir: string,
  gen: GenerationRecord,
): void {
  const dir = join(runDir, genSlug(gen.generation));
  mkdirSync(dir, { recursive: true });

  const lines: string[] = [];
  lines.push(`# Generation ${gen.generation} — proposals`);
  lines.push("");
  lines.push(`Winner: worker-${gen.winnerIndex} (score=${gen.winnerScore.toFixed(3)})`);
  lines.push("");
  lines.push(`| worker | mutation | overall | all_dims_pass | cheat? |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const p of gen.proposals) {
    const cheat =
      p.cheated === undefined
        ? "-"
        : p.cheated
        ? `VETO (${p.cheatReason ?? ""})`
        : "ok";
    lines.push(
      `| worker-${p.workerIndex} | ${p.mutationSummary} | ${p.overallScore.toFixed(3)} | ${p.allDimsPass ? "yes" : "no"} | ${cheat} |`,
    );
  }
  lines.push("");
  lines.push("## Per-dimension scores");
  lines.push("");
  // Compute dim names from first proposal
  const dimNames = gen.proposals[0]?.dimScores.map((d) => d.name) ?? [];
  if (dimNames.length > 0) {
    lines.push(`| worker | ${dimNames.join(" | ")} |`);
    lines.push(`| --- | ${dimNames.map(() => "---").join(" | ")} |`);
    for (const p of gen.proposals) {
      const cells = dimNames.map((n) => {
        const d = p.dimScores.find((x) => x.name === n);
        return d ? `${d.score.toFixed(3)} (${d.pass ? "pass" : "fail"})` : "-";
      });
      lines.push(`| worker-${p.workerIndex} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  writeFileSync(join(dir, "proposals.md"), lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Run-level artifacts
// ---------------------------------------------------------------------------

export function writeIterateMeta(runDir: string, meta: IterateMeta): void {
  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    join(runDir, "meta.json"),
    JSON.stringify(meta, null, 2) + "\n",
  );
}

export function writeLeaderboardMd(
  runDir: string,
  meta: IterateMeta,
  generations: GenerationRecord[],
): void {
  const lines: string[] = [];
  lines.push(`# Iterate leaderboard — ${meta.runId}`);
  lines.push("");
  lines.push(`**Prompt:** \`${meta.promptName}\`  `);
  lines.push(`**DoG:** \`${meta.dogPath}\`  `);
  lines.push(`**Case:** \`${meta.caseId}\`  `);
  lines.push(`**Budget:** ${meta.budget} generation(s) × ${meta.width} workers  `);
  lines.push(`**Worker model:** ${meta.workerModel}  `);
  lines.push(`**Score model:** ${meta.scoreModel}  `);
  lines.push(`**Judge model:** ${meta.judgeModel}  `);
  if (meta.dryRun) lines.push(`**DRY RUN**  `);
  lines.push(`**Started:** ${meta.startedAt}  `);
  lines.push(`**Finished:** ${meta.finishedAt}  `);
  lines.push(`**Stop reason:** ${meta.stopReason}  `);
  lines.push(
    `**Best:** gen ${meta.bestGeneration}, worker ${meta.bestWorkerIndex}, ` +
      `score ${meta.bestScore.toFixed(3)}  `,
  );
  if (meta.winnerWarning) {
    lines.push(`**Warning:** ${meta.winnerWarning}  `);
  }
  lines.push("");
  lines.push(`## Per-generation summary`);
  lines.push("");
  lines.push(`| generation | winner | winner_score | proposals_run |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const g of generations) {
    lines.push(
      `| ${g.generation} | worker-${g.winnerIndex} | ${g.winnerScore.toFixed(3)} | ${g.proposals.length} |`,
    );
  }
  lines.push("");
  lines.push(`## Detail`);
  lines.push("");
  for (const g of generations) {
    lines.push(`### Generation ${g.generation}`);
    lines.push("");
    lines.push(`| worker | overall | all_dims_pass | cheat? |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const p of g.proposals) {
      const cheat =
        p.cheated === undefined ? "-" : p.cheated ? "VETO" : "ok";
      lines.push(
        `| worker-${p.workerIndex} | ${p.overallScore.toFixed(3)} | ${p.allDimsPass ? "yes" : "no"} | ${cheat} |`,
      );
    }
    lines.push("");
  }
  writeFileSync(join(runDir, "leaderboard.md"), lines.join("\n"));
}

/**
 * Produce winner.diff via `git diff --no-index baseline winner`.
 *
 * `git diff --no-index` exits 1 when files differ (that's its way of saying
 * "diff produced output") and 0 when identical — neither is an error. We
 * tolerate both and capture stdout regardless.
 */
export function writeWinnerDiff(
  runDir: string,
  baselinePromptPath: string,
  winnerPromptPath: string,
): void {
  const r = spawnSync(
    "git",
    ["diff", "--no-index", "--", baselinePromptPath, winnerPromptPath],
    { encoding: "utf-8" },
  );
  // r.status: 0 = identical, 1 = different, anything else = real error
  const diffText =
    r.status === 0 || r.status === 1
      ? r.stdout ?? ""
      : `# git diff failed (status=${r.status}): ${r.stderr ?? ""}\n`;
  writeFileSync(join(runDir, "winner.diff"), diffText);
}

/**
 * z020-shape decision: "Decided X. Why: Y. Next: Z."
 *
 * Includes the warning if the winner was the only un-vetoed proposal of a
 * generation that had a cheat-suspect.
 */
export function writeDecisionMd(
  runDir: string,
  meta: IterateMeta,
  baselinePromptPath: string,
  winnerPromptPath: string,
): void {
  const baseSize = existsSync(baselinePromptPath)
    ? readFileSync(baselinePromptPath, "utf-8").length
    : 0;
  const winSize = existsSync(winnerPromptPath)
    ? readFileSync(winnerPromptPath, "utf-8").length
    : 0;

  const reasonNarrative: Record<StopReason, string> = {
    dog_met:
      "All DoG dimension thresholds were met by the best generation; the iterate loop stopped at its goal.",
    budget_exhausted:
      "The generation budget was exhausted before all DoG dimensions were satisfied; further iterations would need a higher --budget.",
    plateau:
      "Score improvement fell below the plateau threshold over the plateau window; the loop stopped to avoid burning more compute on flat ground.",
    all_winners_vetoed:
      "Every generation's top-scoring winner was vetoed by the discipline reviewer (cheat-suspect); the loop has no clean candidate to promote.",
  };

  const lines: string[] = [];
  lines.push(`# Iterate decision — ${meta.runId}`);
  lines.push("");
  lines.push(`## Decided`);
  lines.push("");
  if (meta.stopReason === "all_winners_vetoed") {
    lines.push(
      `Promote nothing. Every winner was a cheat-suspect — investigate the DoG dimensions ` +
        `or the case to understand why the scorer is rewarding shortcuts.`,
    );
  } else {
    lines.push(
      `Promote the winner from generation ${meta.bestGeneration}, worker-${meta.bestWorkerIndex}.`,
    );
    lines.push("");
    lines.push(`Apply with:`);
    lines.push("");
    lines.push("```bash");
    lines.push(
      `git diff --no-index ${baselinePromptPath} ${winnerPromptPath} | git apply`,
    );
    lines.push("```");
  }
  lines.push("");
  lines.push(`## Why`);
  lines.push("");
  lines.push(reasonNarrative[meta.stopReason]);
  lines.push("");
  lines.push(`Best score: ${meta.bestScore.toFixed(3)}`);
  lines.push(
    `Prompt size: baseline=${baseSize} chars → winner=${winSize} chars (Δ=${winSize - baseSize}).`,
  );
  if (meta.winnerWarning) {
    lines.push("");
    lines.push(`> WARNING: ${meta.winnerWarning}`);
  }
  lines.push("");
  lines.push(`## Next`);
  lines.push("");
  switch (meta.stopReason) {
    case "dog_met":
      lines.push(
        `- Read the diff at \`winner.diff\`.`,
        `- If it looks right, apply it to \`${meta.promptName}.md\` in the corpus prompts dir.`,
        `- Re-run \`dx evals run\` against the case to confirm the score holds outside iterate.`,
      );
      break;
    case "budget_exhausted":
      lines.push(
        `- Inspect \`leaderboard.md\` — was the trajectory still climbing?`,
        `- If yes, re-run with a higher \`--budget\`.`,
        `- If no, raise the issue: the prompt may be near its ceiling for this DoG.`,
      );
      break;
    case "plateau":
      lines.push(
        `- Inspect \`leaderboard.md\` for the score curve.`,
        `- Consider tightening the DoG thresholds or revising the case if the score never crossed the floor.`,
        `- Try a different worker model (\`--worker-model\`) to vary mutation flavors.`,
      );
      break;
    case "all_winners_vetoed":
      lines.push(
        `- Read the per-generation \`proposals.md\` files for the cheat-reason text.`,
        `- The DoG likely rewards a shortcut the worker found; tighten \`anti-criteria\` and re-run.`,
      );
      break;
  }
  lines.push("");
  writeFileSync(join(runDir, "decision.md"), lines.join("\n"));
}
