/**
 * runner.ts — Per-case execution logic for `dx evals run`.
 *
 * For each case:
 *   - transcript kind: emit NOT_IMPLEMENTED status (bucket fetcher is v1+).
 *   - prompt kind: spawn `claude -p` with the case prompt (live-replay).
 *
 * Then hands transcript + DoG to judge.ts and returns a typed CaseResult.
 */

import { spawnSync } from "child_process";
import type { EvalCase } from "./case-loader";
import type { DogDocument } from "./dog-loader";
import { judge, evaluateDimensions } from "./judge";
import type { JudgeResult } from "./judge";

export type CaseStatus =
  | "pass"
  | "fail"
  | "not-implemented-trace-replay"
  | "error";

export interface CaseResult {
  caseId: string;
  status: CaseStatus;
  /** The transcript / answer text evaluated (may be placeholder for not-implemented) */
  transcriptExcerpt: string;
  judgeResult?: JudgeResult;
  /** Per-dimension with pass/fail vs threshold */
  dimensionResults?: Array<{
    name: string;
    score: number;
    pass: boolean;
    threshold: string;
    rationale: string;
  }>;
  errorMessage?: string;
  durationMs: number;
}

/**
 * Execute one case and return a result.
 *
 * In dry-run mode: skips all API calls; returns deterministic placeholder data.
 */
export async function runCase(
  evalCase: EvalCase,
  dog: DogDocument,
  model: string,
  judgeModel: string,
  dryRun: boolean,
): Promise<CaseResult> {
  const start = Date.now();

  if (evalCase.source.kind === "transcript") {
    // v0: trace-replay requires bucket access — out of scope.
    return {
      caseId: evalCase.id,
      status: "not-implemented-trace-replay",
      transcriptExcerpt:
        "[trace-replay not implemented at v0: bucket fetcher required]",
      durationMs: Date.now() - start,
    };
  }

  // prompt kind — live-replay via headless claude (or dry-run stub)
  if (dryRun) {
    const stubAnswer =
      "[dry-run] stub answer: Lihu Berman decided to remove the org tier on 2026-04-08 " +
      "[source: Workspace migration plan]. This is a deterministic dry-run placeholder.";

    const stubJudgeResult: JudgeResult = {
      case_id: evalCase.id,
      dimensions: dog.dimensions.map((d) => ({
        name: d.name,
        score: d.type === "bool" ? 1 : 0.9,
        rationale: "[dry-run] deterministic stub score",
      })),
      overall: {
        pass: true,
        score: 0.9,
        summary: "[dry-run] all dimensions stubbed to passing",
      },
    };

    const dimensionResults = evaluateDimensions(stubJudgeResult, dog.dimensions);

    return {
      caseId: evalCase.id,
      status: "pass",
      transcriptExcerpt: stubAnswer,
      judgeResult: stubJudgeResult,
      dimensionResults,
      durationMs: Date.now() - start,
    };
  }

  // Live prompt replay
  const promptSource = evalCase.source;
  let assistantAnswer: string;
  try {
    assistantAnswer = spawnClaude(promptSource.prompt, model);
  } catch (err) {
    return {
      caseId: evalCase.id,
      status: "error",
      transcriptExcerpt: "",
      errorMessage: String(err),
      durationMs: Date.now() - start,
    };
  }

  // Judge
  let judgeResult: JudgeResult;
  try {
    judgeResult = await judge(
      {
        caseId: evalCase.id,
        userQuery: promptSource.prompt,
        assistantAnswer,
        dog,
        expectedJson: JSON.stringify(evalCase.expected, null, 2),
      },
      judgeModel,
    );
  } catch (err) {
    const msg = String(err).replace(/sk-ant-[a-zA-Z0-9_-]+/g, "[REDACTED]");
    return {
      caseId: evalCase.id,
      status: "error",
      transcriptExcerpt: assistantAnswer.slice(0, 500),
      errorMessage: msg,
      durationMs: Date.now() - start,
    };
  }

  const dimensionResults = evaluateDimensions(judgeResult, dog.dimensions);
  const overallPass = judgeResult.overall.pass;

  return {
    caseId: evalCase.id,
    status: overallPass ? "pass" : "fail",
    transcriptExcerpt: assistantAnswer.slice(0, 1000),
    judgeResult,
    dimensionResults,
    durationMs: Date.now() - start,
  };
}

function spawnClaude(prompt: string, _model: string): string {
  // Spawn headless claude per multi-turn-headless-claude skill pattern.
  // We use --output-format json to get a structured response.
  const result = spawnSync("claude", ["-p", prompt, "--output-format", "json"], {
    encoding: "utf-8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`claude spawn error: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.slice(0, 500) ?? "(no stderr)";
    throw new Error(`claude exited ${result.status}: ${stderr}`);
  }

  const stdout = result.stdout?.trim() ?? "";
  if (!stdout) {
    throw new Error("claude returned empty stdout");
  }

  // Try to parse JSON output for the "result" field; fall back to raw text.
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (typeof parsed["result"] === "string") {
      return parsed["result"];
    }
  } catch {
    // not JSON — use raw stdout as text
  }
  return stdout;
}
