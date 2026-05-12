#!/usr/bin/env bun
/**
 * Experiment 005 — eval harness.
 *
 * Reads a list of questions from eval-questions.md, runs each one twice
 * through `effi ask` (wiki-off / wiki-on), and persists per-pair artifacts
 * (trace JSONL + transcripts) to runs/<timestamp>/ for downstream human +
 * LLM-judge scoring.
 *
 * Usage:
 *   bun run usegin/effi-memory/experiments/005-effi-wiki-tool/harness/run.ts \
 *     --wiki-project-id <uuid> [--profile agent-dev] [--filter <substring>] \
 *     [--questions <path>] [--output-dir <path>] [--dry-run]
 *
 * What it does NOT do:
 *   - Score answers. That's a separate, human-in-the-loop pass.
 *   - Start `just agent-dev` or otherwise manage services.
 *   - Pull the wiki UUID from anywhere — caller passes it explicitly.
 *
 * Wire shape per pair under runs/<timestamp>/:
 *   NNN-off.jsonl        - trace JSONL line from `effi ask --trace-jsonl`
 *   NNN-off.stdout.txt   - assistant content (stdout)
 *   NNN-off.stderr.txt   - tool-call chatter + clock stamps (stderr)
 *   NNN-on.jsonl, ...    - same, but with EFFI_WIKI_PROJECT_ID injected
 *   index.md             - per-pair tool-call summary derived from the JSONL
 *   RESULTS.md           - scoring skeleton (human + LLM judge fills in)
 *
 * Part of: ENG-5379 (experiment 005, step 2b)
 */

import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface CliOptions {
	questions: string;
	wikiProjectId: string;
	profile: string;
	outputDir: string;
	filter?: string;
	dryRun: boolean;
}

const HELP = `Usage: run.ts [options]

Run the experiment 005 eval harness: for each question in eval-questions.md,
spawn \`effi ask\` twice (wiki-off / wiki-on) and persist per-pair artifacts.

Options:
  --questions <path>          Path to eval-questions.md
                              (default: ../eval-questions.md relative to script)
  --wiki-project-id <uuid>    Dogfooding project UUID for wiki-on runs (required)
  --profile <name>            effi profile (default: agent-dev)
  --output-dir <path>         Where to write runs/<timestamp>/
                              (default: ../runs relative to script)
  --filter <substring>        Run only questions whose text contains this
                              substring (case-insensitive). Useful for smoke runs.
  --dry-run                   Print planned spawn commands without executing.
  --help                      Show this help.
`;

function parseCliOptions(argv: string[]): CliOptions {
	const scriptDir = dirname(resolve(import.meta.path ?? __filename));
	const defaultQuestions = resolve(scriptDir, "..", "eval-questions.md");
	const defaultOutputDir = resolve(scriptDir, "..", "runs");

	const { values } = parseArgs({
		args: argv,
		options: {
			questions: { type: "string" },
			"wiki-project-id": { type: "string" },
			profile: { type: "string" },
			"output-dir": { type: "string" },
			filter: { type: "string" },
			"dry-run": { type: "boolean", default: false },
			help: { type: "boolean", default: false },
		},
		strict: true,
		allowPositionals: false,
	});

	if (values.help) {
		process.stdout.write(HELP);
		process.exit(0);
	}

	if (!values["wiki-project-id"]) {
		process.stderr.write("Error: --wiki-project-id <uuid> is required.\n\n");
		process.stderr.write(HELP);
		process.exit(1);
	}

	return {
		questions: values.questions ?? defaultQuestions,
		wikiProjectId: values["wiki-project-id"] as string,
		profile: values.profile ?? "agent-dev",
		outputDir: values["output-dir"] ?? defaultOutputDir,
		filter: values.filter,
		dryRun: values["dry-run"] === true,
	};
}

// ---------------------------------------------------------------------------
// Question parsing (pure, unit-testable)
// ---------------------------------------------------------------------------

/**
 * Parse questions from a markdown blob. One question per `## ` heading.
 * Trims whitespace, drops empty headings. Headers like `# ` (single hash)
 * or deeper (`### `) are ignored.
 */
export function parseQuestions(markdown: string): string[] {
	const out: string[] = [];
	for (const rawLine of markdown.split(/\r?\n/)) {
		const line = rawLine.trimEnd();
		// Match `## ` followed by content; reject `### ` or deeper.
		const m = line.match(/^##\s+(.+)$/);
		if (!m) continue;
		// Guard against `### `: `##\s+` would still match if we're not careful.
		// `##\s+(.+)` will match `### foo` as `# foo`, so explicitly reject `###`.
		if (line.startsWith("### ")) continue;
		const text = m[1].trim();
		if (text.length > 0) out.push(text);
	}
	return out;
}

function filterQuestions(qs: string[], filter: string | undefined): string[] {
	if (!filter) return qs;
	const needle = filter.toLowerCase();
	return qs.filter((q) => q.toLowerCase().includes(needle));
}

// ---------------------------------------------------------------------------
// Timestamp + paths
// ---------------------------------------------------------------------------

function formatTimestamp(d: Date = new Date()): string {
	const pad = (n: number) => n.toString().padStart(2, "0");
	return (
		`${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
		`-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
	);
}

function padIndex(i: number): string {
	return i.toString().padStart(3, "0");
}

// ---------------------------------------------------------------------------
// Spawn one `effi ask` and capture stdout/stderr + exit code
// ---------------------------------------------------------------------------

interface SpawnResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

function buildAskArgs(opts: {
	question: string;
	profile: string;
	tracePath: string;
}): string[] {
	return [
		"ask",
		opts.question,
		"--profile",
		opts.profile,
		"--json",
		"--trace-jsonl",
		opts.tracePath,
	];
}

function buildAskEnv(wikiProjectId: string | null): NodeJS.ProcessEnv {
	const env = { ...process.env };
	if (wikiProjectId === null) {
		// Wiki-off run: ensure the var isn't inherited from the caller's shell.
		delete env.EFFI_WIKI_PROJECT_ID;
	} else {
		env.EFFI_WIKI_PROJECT_ID = wikiProjectId;
	}
	return env;
}

async function runEffiAsk(opts: {
	question: string;
	profile: string;
	tracePath: string;
	wikiProjectId: string | null;
}): Promise<SpawnResult> {
	const args = buildAskArgs({
		question: opts.question,
		profile: opts.profile,
		tracePath: opts.tracePath,
	});
	const env = buildAskEnv(opts.wikiProjectId);

	return new Promise((resolveP, rejectP) => {
		const child = spawn("effi", args, {
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		child.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
		child.stderr.on("data", (c: Buffer) => stderrChunks.push(c));

		child.on("error", (err) => rejectP(err));
		child.on("close", (code) => {
			resolveP({
				exitCode: code ?? -1,
				stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
				stderr: Buffer.concat(stderrChunks).toString("utf-8"),
			});
		});
	});
}

// ---------------------------------------------------------------------------
// Trace JSONL inspection — derive a one-line tool-call summary per side
// ---------------------------------------------------------------------------

interface TraceSummary {
	toolCallChain: string; // "memory_lookup → canon_search" or "(no tools)"
	ttftMs: number | null;
	totalMs: number | null;
	missing: boolean;
	parseError: string | null;
}

function summarizeTrace(tracePath: string): TraceSummary {
	if (!existsSync(tracePath)) {
		return {
			toolCallChain: "(trace missing)",
			ttftMs: null,
			totalMs: null,
			missing: true,
			parseError: null,
		};
	}
	let content: string;
	try {
		content = readFileSync(tracePath, "utf-8");
	} catch (err) {
		return {
			toolCallChain: "(trace unreadable)",
			ttftMs: null,
			totalMs: null,
			missing: true,
			parseError: err instanceof Error ? err.message : String(err),
		};
	}
	const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length === 0) {
		return {
			toolCallChain: "(trace empty)",
			ttftMs: null,
			totalMs: null,
			missing: true,
			parseError: null,
		};
	}
	// `effi ask` is one-shot so a single line is expected; we read the last
	// line in case the file grew (defensive).
	const lastLine = lines[lines.length - 1];
	try {
		const parsed = JSON.parse(lastLine) as {
			tool_calls?: Array<{ name?: string }>;
			ttft_ms?: number | null;
			total_ms?: number | null;
		};
		const names = (parsed.tool_calls ?? [])
			.map((t) => t.name ?? "?")
			.filter((n) => n.length > 0);
		const chain = names.length === 0 ? "(no tools)" : names.join(" → ");
		return {
			toolCallChain: chain,
			ttftMs: parsed.ttft_ms ?? null,
			totalMs: parsed.total_ms ?? null,
			missing: false,
			parseError: null,
		};
	} catch (err) {
		return {
			toolCallChain: "(trace unparseable)",
			ttftMs: null,
			totalMs: null,
			missing: false,
			parseError: err instanceof Error ? err.message : String(err),
		};
	}
}

// ---------------------------------------------------------------------------
// Per-pair execution + writeout
// ---------------------------------------------------------------------------

interface PairRecord {
	index: number;
	question: string;
	offTrace: TraceSummary;
	onTrace: TraceSummary;
	offExitCode: number;
	onExitCode: number;
}

function fmtMs(ms: number | null): string {
	if (ms === null) return "?";
	return `${ms}ms`;
}

function truncate(s: string, n: number): string {
	if (s.length <= n) return s;
	return `${s.slice(0, n - 1)}…`;
}

async function runPair(opts: {
	index: number;
	question: string;
	profile: string;
	wikiProjectId: string;
	runDir: string;
}): Promise<PairRecord> {
	const n = padIndex(opts.index);
	const offTracePath = resolve(opts.runDir, `${n}-off.jsonl`);
	const onTracePath = resolve(opts.runDir, `${n}-on.jsonl`);

	const offResult = await runEffiAsk({
		question: opts.question,
		profile: opts.profile,
		tracePath: offTracePath,
		wikiProjectId: null,
	});
	writeFileSync(resolve(opts.runDir, `${n}-off.stdout.txt`), offResult.stdout);
	writeFileSync(resolve(opts.runDir, `${n}-off.stderr.txt`), offResult.stderr);
	const offTrace = summarizeTrace(offTracePath);

	const onResult = await runEffiAsk({
		question: opts.question,
		profile: opts.profile,
		tracePath: onTracePath,
		wikiProjectId: opts.wikiProjectId,
	});
	writeFileSync(resolve(opts.runDir, `${n}-on.stdout.txt`), onResult.stdout);
	writeFileSync(resolve(opts.runDir, `${n}-on.stderr.txt`), onResult.stderr);
	const onTrace = summarizeTrace(onTracePath);

	return {
		index: opts.index,
		question: opts.question,
		offTrace,
		onTrace,
		offExitCode: offResult.exitCode,
		onExitCode: onResult.exitCode,
	};
}

// ---------------------------------------------------------------------------
// Index + RESULTS skeleton writeout
// ---------------------------------------------------------------------------

function renderIndex(opts: {
	timestamp: string;
	profile: string;
	pairs: PairRecord[];
}): string {
	const lines: string[] = [];
	lines.push(`# Experiment 005 — run ${opts.timestamp}`);
	lines.push("");
	lines.push(`Profile: \`${opts.profile}\``);
	lines.push(`Pairs: ${opts.pairs.length}`);
	lines.push("");
	lines.push("Each pair: \`NNN-off.{jsonl,stdout.txt,stderr.txt}\` (wiki-off)");
	lines.push("           \`NNN-on.{jsonl,stdout.txt,stderr.txt}\`  (wiki-on)");
	lines.push("");
	lines.push("## Pairs");
	lines.push("");
	for (const p of opts.pairs) {
		const n = padIndex(p.index);
		lines.push(`### ${n}. ${p.question}`);
		lines.push("");
		const offFail = p.offExitCode !== 0 ? ` **[exit=${p.offExitCode}]**` : "";
		const onFail = p.onExitCode !== 0 ? ` **[exit=${p.onExitCode}]**` : "";
		lines.push(
			`- wiki-off: ${p.offTrace.toolCallChain}` +
				`  · ttft ${fmtMs(p.offTrace.ttftMs)}` +
				` · total ${fmtMs(p.offTrace.totalMs)}${offFail}`,
		);
		lines.push(
			`- wiki-on:  ${p.onTrace.toolCallChain}` +
				`  · ttft ${fmtMs(p.onTrace.ttftMs)}` +
				` · total ${fmtMs(p.onTrace.totalMs)}${onFail}`,
		);
		if (p.offTrace.parseError) {
			lines.push(`  - off trace parse error: ${p.offTrace.parseError}`);
		}
		if (p.onTrace.parseError) {
			lines.push(`  - on trace parse error: ${p.onTrace.parseError}`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

function renderResultsSkeleton(opts: {
	timestamp: string;
	profile: string;
	pairCount: number;
}): string {
	return `# Experiment 005 — run ${opts.timestamp}

Pairs: ${opts.pairCount}
Profile: \`${opts.profile}\`
Wiki project ID: <redacted before commit if sensitive>

## Scoring

For each pair, read both transcripts (\`NNN-{off,on}.stdout.txt\`) and the
tool-call summary in \`index.md\`. Mark wiki-on as:

- **better** / **equal** / **worse** / **regression**

Plus a one-line note. Aggregate at the bottom.

## Pairs

See \`index.md\` for the pre-populated tool-call summaries. Add per-pair
scoring notes below.

## Aggregate

- TTFT delta (wiki-on − wiki-off, mean): TBD
- Final-token delta: TBD
- Win rate: TBD
- Citation fidelity: TBD

## What we learned about the wiki

TBD

## What we learned about Effi

TBD

## Next iteration

TBD
`;
}

// ---------------------------------------------------------------------------
// Dry-run renderer — shows the planned spawn commands
// ---------------------------------------------------------------------------

function renderDryRunPlan(opts: {
	questions: string[];
	profile: string;
	wikiProjectId: string;
	runDir: string;
}): string {
	const lines: string[] = [];
	lines.push(`# Dry run — ${opts.questions.length} question(s)`);
	lines.push(`# Run dir: ${opts.runDir}`);
	lines.push(`# Profile: ${opts.profile}`);
	lines.push("");
	opts.questions.forEach((q, i) => {
		const n = padIndex(i + 1);
		const offTrace = resolve(opts.runDir, `${n}-off.jsonl`);
		const onTrace = resolve(opts.runDir, `${n}-on.jsonl`);
		lines.push(`# Q${n}: ${truncate(q, 80)}`);
		lines.push(
			`unset EFFI_WIKI_PROJECT_ID; effi ask ${JSON.stringify(q)} ` +
				`--profile ${opts.profile} --json --trace-jsonl ${offTrace}`,
		);
		lines.push(
			`EFFI_WIKI_PROJECT_ID=${opts.wikiProjectId} effi ask ${JSON.stringify(q)} ` +
				`--profile ${opts.profile} --json --trace-jsonl ${onTrace}`,
		);
		lines.push("");
	});
	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const opts = parseCliOptions(process.argv.slice(2));

	if (!existsSync(opts.questions)) {
		process.stderr.write(`Error: questions file not found: ${opts.questions}\n`);
		process.exit(1);
	}
	const markdown = readFileSync(opts.questions, "utf-8");
	const allQuestions = parseQuestions(markdown);
	const questions = filterQuestions(allQuestions, opts.filter);
	if (questions.length === 0) {
		process.stderr.write(
			opts.filter
				? `Error: no questions matched --filter ${JSON.stringify(opts.filter)} (pool: ${allQuestions.length})\n`
				: `Error: no questions found in ${opts.questions}\n`,
		);
		process.exit(1);
	}

	const timestamp = formatTimestamp();
	const runDir = resolve(opts.outputDir, timestamp);

	if (opts.dryRun) {
		process.stdout.write(
			renderDryRunPlan({
				questions,
				profile: opts.profile,
				wikiProjectId: opts.wikiProjectId,
				runDir,
			}),
		);
		return;
	}

	mkdirSync(runDir, { recursive: true });
	process.stderr.write(`Run dir: ${runDir}\n`);
	process.stderr.write(`Questions: ${questions.length}\n\n`);

	const pairs: PairRecord[] = [];
	for (let i = 0; i < questions.length; i++) {
		const idx = i + 1;
		const q = questions[i];
		const n = padIndex(idx);
		const label = truncate(q, 60);
		process.stderr.write(`[${n}/${padIndex(questions.length)}] ${label}\n`);
		try {
			const pair = await runPair({
				index: idx,
				question: q,
				profile: opts.profile,
				wikiProjectId: opts.wikiProjectId,
				runDir,
			});
			pairs.push(pair);
			process.stderr.write(
				`  off:${fmtMs(pair.offTrace.totalMs)}` +
					` (${pair.offTrace.toolCallChain})` +
					`  on:${fmtMs(pair.onTrace.totalMs)}` +
					` (${pair.onTrace.toolCallChain})\n`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			process.stderr.write(`  ERROR: ${msg}\n`);
			pairs.push({
				index: idx,
				question: q,
				offTrace: {
					toolCallChain: `(spawn error: ${msg})`,
					ttftMs: null,
					totalMs: null,
					missing: true,
					parseError: null,
				},
				onTrace: {
					toolCallChain: "(skipped due to spawn error)",
					ttftMs: null,
					totalMs: null,
					missing: true,
					parseError: null,
				},
				offExitCode: -1,
				onExitCode: -1,
			});
		}
	}

	writeFileSync(
		resolve(runDir, "index.md"),
		renderIndex({ timestamp, profile: opts.profile, pairs }),
	);
	writeFileSync(
		resolve(runDir, "RESULTS.md"),
		renderResultsSkeleton({
			timestamp,
			profile: opts.profile,
			pairCount: pairs.length,
		}),
	);
	process.stderr.write(`\nWrote: ${resolve(runDir, "index.md")}\n`);
	process.stderr.write(`Wrote: ${resolve(runDir, "RESULTS.md")}\n`);
}

// Only run main when invoked as a script (not when imported by a test).
// Bun sets `import.meta.main` for the entry module.
if (import.meta.main) {
	main().catch((err) => {
		const msg = err instanceof Error ? err.stack ?? err.message : String(err);
		process.stderr.write(`Fatal: ${msg}\n`);
		process.exit(1);
	});
}
