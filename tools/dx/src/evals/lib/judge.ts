/**
 * judge.ts — Single-axis Opus judge for an eval case.
 *
 * Builds the judge prompt from the DoG (goal + dimensions + calibration
 * anchors + anti-criteria), calls the Anthropic SDK, parses the JSON
 * verdict, and returns a typed JudgeResult.
 *
 * Judge prompt is v1-faithfulness-judge.md. The judge response is pure JSON
 * per that prompt's contract.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { DogDocument, DogDimension } from "./dog-loader";
import { readFileSync } from "fs";
import { join } from "path";

export interface DimensionScore {
  name: string;
  score: number;
  rationale: string;
}

export interface JudgeResult {
  case_id: string;
  dimensions: DimensionScore[];
  overall: {
    pass: boolean;
    score: number;
    summary: string;
  };
}

export interface JudgeInput {
  caseId: string;
  userQuery: string;
  assistantAnswer: string;
  dog: DogDocument;
  expectedJson: string;
}

function judgeSystemPrompt(): string {
  // Resolve relative to repo root: usegin/evals/framework/judges/citation-faithful-judge-v1.md
  // This file is at: tools/dx/src/evals/lib/judge.ts → 5 dirs up = repo root
  const here = new URL(import.meta.url).pathname;
  const repoRoot = here.split("/").slice(0, -6).join("/");
  const judgePromptPath = join(
    repoRoot,
    "usegin",
    "evals",
    "framework",
    "judges",
    "citation-faithful-judge-v1.md",
  );
  return readFileSync(judgePromptPath, "utf-8");
}

function buildUserMessage(input: JudgeInput): string {
  return [
    `CASE_ID: ${input.caseId}`,
    `USER_QUERY: ${input.userQuery}`,
    "",
    "ASSISTANT_ANSWER:",
    input.assistantAnswer,
    "",
    "DEFINITION_OF_GOOD (DoG):",
    input.dog.rawMarkdown,
    "",
    "CASE_EXPECTED:",
    input.expectedJson,
  ].join("\n");
}

function parseJudgeResponse(raw: string, caseId: string): JudgeResult {
  // Strip any accidental markdown fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `judge: response is not valid JSON for case ${caseId}. Got: ${raw.slice(0, 200)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`judge: expected object, got ${typeof parsed}`);
  }
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj["dimensions"])) {
    throw new Error(`judge: missing "dimensions" array`);
  }
  if (typeof obj["overall"] !== "object" || obj["overall"] === null) {
    throw new Error(`judge: missing "overall" object`);
  }
  return obj as unknown as JudgeResult;
}

/**
 * Score a transcript (or placeholder) against a DoG using a single Opus judge call.
 *
 * @param caseId        Case identifier (for embedding in the verdict).
 * @param userQuery     The user's original question (from case or inferred from transcript).
 * @param assistantAnswer  The assistant's answer text to be judged.
 * @param dog           Parsed DoG document.
 * @param expectedJson  JSON-stringified case.expected.
 * @param judgeModel    Anthropic model to use as judge.
 * @returns             Typed JudgeResult.
 */
export async function judge(
  input: JudgeInput,
  judgeModel: string,
): Promise<JudgeResult> {
  const client = new Anthropic();
  const systemPrompt = judgeSystemPrompt();
  const userMessage = buildUserMessage(input);

  const response = await client.messages.create({
    model: judgeModel,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`judge: no text block in response for case ${input.caseId}`);
  }

  return parseJudgeResponse(textBlock.text, input.caseId);
}

/**
 * Aggregate per-dimension pass/fail against DoG thresholds.
 * Returns {name, score, pass, threshold}[] per dimension.
 */
export function evaluateDimensions(
  result: JudgeResult,
  dimensions: DogDimension[],
): Array<DimensionScore & { pass: boolean; threshold: string }> {
  return result.dimensions.map((dim) => {
    const def = dimensions.find((d) => d.name === dim.name);
    if (!def) {
      return { ...dim, pass: false, threshold: "unknown" };
    }
    const pass = meetsThreshold(dim.score, def.threshold, def.type);
    return { ...dim, pass, threshold: def.threshold };
  });
}

function meetsThreshold(
  score: number,
  threshold: string,
  type: string,
): boolean {
  // threshold is like ">= 0.95", "== true", "<= 0.05"
  const t = threshold.trim();

  if (type === "bool" || t === "== true") {
    return score === 1;
  }
  if (t === "== false") return score === 0;

  const match = /^([><=!]+)\s*([\d.]+)$/.exec(t);
  if (!match) return false;
  const [, op, valStr] = match;
  const val = parseFloat(valStr);
  switch (op) {
    case ">=": return score >= val;
    case ">":  return score > val;
    case "<=": return score <= val;
    case "<":  return score < val;
    case "==": return score === val;
    case "!=": return score !== val;
    default:   return false;
  }
}
