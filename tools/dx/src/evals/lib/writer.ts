/**
 * writer.ts — Write run results to usegin/evals/<corpus>/runs/<slug>/.
 *
 * Produces:
 *   summary.json  — run metadata + per-case summary
 *   summary.md    — human-readable table
 *   <case-id>.json — full result per case
 *   meta.json     — git sha, branch, dirty-flag, who ran, model versions
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import type { CaseResult, CaseStatus } from "./runner";
import type { EvalCase } from "./case-loader";
import { runsDir } from "./case-loader";

export interface RunMeta {
  runId: string;
  corpus: string;
  suite: string;
  model: string;
  promptRef: string;
  judgeModel: string;
  startedAt: string;
  finishedAt: string;
  git: {
    sha: string;
    sha7: string;
    branch: string;
    dirty: boolean;
  };
  whoRan: string;
  dryRun: boolean;
}

export interface RunSummary {
  meta: RunMeta;
  case_count: number;
  pass_count: number;
  not_implemented_count: number;
  error_count: number;
  cases: Array<{
    id: string;
    status: CaseStatus;
    overall_score?: number;
    overall_pass?: boolean;
    duration_ms: number;
  }>;
}

function gitInfo(): RunMeta["git"] {
  const sha = run("git", ["rev-parse", "HEAD"]).trim() || "unknown";
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim() || "unknown";
  const dirty = run("git", ["status", "--porcelain"]).trim() !== "";
  return { sha, sha7: sha.slice(0, 7), branch, dirty };
}

function run(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: "utf-8" });
  return r.stdout ?? "";
}

function whoRan(): string {
  const gitUser = run("git", ["config", "user.email"]).trim();
  return gitUser || process.env["USER"] || "unknown";
}

export function makeRunId(
  slug: string,
  git: RunMeta["git"],
  startedAt: string,
  caseSlug?: string,
): string {
  const ts = startedAt.replace(/[:.]/g, "-");
  const base = `${ts}-${git.sha7}-${slug}`;
  if (!caseSlug) return base;
  // Include case slug when filtered; truncate the slug component if total > 80 chars.
  const caseSegment = `-${caseSlug.replace(/[^a-z0-9-]/g, "-").slice(0, 30)}`;
  const full = `${base}${caseSegment}`;
  return full.length <= 80 ? full : full.slice(0, 80);
}

function buildSummaryMd(summary: RunSummary, cases: EvalCase[], results: CaseResult[]): string {
  const lines: string[] = [];
  lines.push(`# Eval Run: ${summary.meta.runId}`);
  lines.push("");
  lines.push(`**Corpus:** ${summary.meta.corpus}  `);
  lines.push(`**Suite:** ${summary.meta.suite}  `);
  lines.push(`**Model:** ${summary.meta.model}  `);
  lines.push(`**Judge:** ${summary.meta.judgeModel}  `);
  lines.push(`**Started:** ${summary.meta.startedAt}  `);
  lines.push(`**Git:** ${summary.meta.git.sha7} (${summary.meta.git.branch})${summary.meta.git.dirty ? " [dirty]" : ""}  `);
  lines.push(`**Ran by:** ${summary.meta.whoRan}  `);
  if (summary.meta.dryRun) lines.push(`**DRY RUN**  `);
  lines.push("");
  lines.push(`## Results`);
  lines.push("");
  lines.push(`| Case | Status | Score | Duration |`);
  lines.push(`|------|--------|-------|----------|`);

  for (const result of results) {
    const score =
      result.judgeResult?.overall.score !== undefined
        ? result.judgeResult.overall.score.toFixed(2)
        : "-";
    lines.push(
      `| ${result.caseId} | ${result.status} | ${score} | ${result.durationMs}ms |`,
    );
  }

  lines.push("");
  lines.push(`**Pass:** ${summary.pass_count}/${summary.case_count}`);
  lines.push("");

  // Per-case dimension breakdown
  for (const result of results) {
    const evalCase = cases.find((c) => c.id === result.caseId);
    lines.push(`### ${result.caseId}`);
    if (evalCase?.title) lines.push(`*${evalCase.title}*`);
    lines.push("");

    if (result.status === "not-implemented-trace-replay") {
      lines.push("_Transcript-kind case: trace-replay not implemented at v0._");
      lines.push("");
      continue;
    }
    if (result.status === "error") {
      lines.push(`**Error:** ${result.errorMessage ?? "(no detail)"}`);
      lines.push("");
      continue;
    }

    if (result.dimensionResults && result.dimensionResults.length > 0) {
      lines.push(`| Dimension | Score | Pass | Threshold | Rationale |`);
      lines.push(`|-----------|-------|------|-----------|-----------|`);
      for (const dim of result.dimensionResults) {
        const rationaleTrunc = dim.rationale.slice(0, 100).replace(/\|/g, "\\|");
        lines.push(
          `| ${dim.name} | ${dim.score.toFixed(2)} | ${dim.pass ? "pass" : "fail"} | ${dim.threshold} | ${rationaleTrunc} |`,
        );
      }
      lines.push("");
    }

    if (result.judgeResult?.overall.summary) {
      lines.push(`**Summary:** ${result.judgeResult.overall.summary}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function writeRunResults(
  corpus: string,
  suite: string,
  model: string,
  promptRef: string,
  judgeModel: string,
  cases: EvalCase[],
  results: CaseResult[],
  startedAt: string,
  dryRun: boolean,
  /** When --case <id> restricts to a single case, pass it here to include in runId */
  filteredCaseId?: string,
  /** Override the output directory (used by matrix-runner to point at cell dirs) */
  outputDirOverride?: string,
): { runDir: string; runId: string; summary: RunSummary } {
  const git = gitInfo();
  const slug = suite.replace(/[^a-z0-9-]/g, "-").slice(0, 20);
  const runId = makeRunId(slug, git, startedAt, filteredCaseId);
  const runDir = outputDirOverride ?? join(runsDir(corpus), runId);

  mkdirSync(runDir, { recursive: true });

  const finishedAt = new Date().toISOString();
  const meta: RunMeta = {
    runId,
    corpus,
    suite,
    model,
    promptRef,
    judgeModel,
    startedAt,
    finishedAt,
    git,
    whoRan: whoRan(),
    dryRun,
  };

  const summary: RunSummary = {
    meta,
    case_count: results.length,
    pass_count: results.filter((r) => r.status === "pass").length,
    not_implemented_count: results.filter((r) => r.status === "not-implemented-trace-replay").length,
    error_count: results.filter((r) => r.status === "error").length,
    cases: results.map((r) => ({
      id: r.caseId,
      status: r.status,
      overall_score: r.judgeResult?.overall.score,
      overall_pass: r.judgeResult?.overall.pass,
      duration_ms: r.durationMs,
    })),
  };

  // summary.json
  writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");

  // meta.json
  writeFileSync(join(runDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");

  // summary.md
  writeFileSync(join(runDir, "summary.md"), buildSummaryMd(summary, cases, results));

  // Per-case JSON
  for (const result of results) {
    const evalCase = cases.find((c) => c.id === result.caseId);
    const caseOut = {
      case: evalCase,
      result,
    };
    writeFileSync(
      join(runDir, `${result.caseId}.json`),
      JSON.stringify(caseOut, null, 2) + "\n",
    );
  }

  return { runDir, runId, summary };
}
