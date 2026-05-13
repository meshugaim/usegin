#!/usr/bin/env bun
/**
 * Experiment 005 — eval harness.
 *
 * Reads a list of questions from eval-questions.md, runs each one twice
 * through `effi ask` (wiki-off / wiki-on) against the SAME project, and
 * persists per-pair artifacts (trace JSONL + transcripts) to
 * runs/<timestamp>/ for downstream human + LLM-judge scoring.
 *
 * Methodology
 * -----------
 *   - Both sides hit one project — the dogfooding project that the
 *     server's `EFFI_WIKI_PROJECT_ID` env designates as wiki-eligible.
 *     This makes the paired comparison fair: same canon, same server,
 *     only `disable_wiki` differs per request.
 *   - Wiki-off side: `effi ask --wiki off` sets `disable_wiki: true` in
 *     the request body; both python-services gate sites suppress the
 *     wiki (MCP tool + system-prompt section).
 *   - Wiki-on side: omits `--wiki` (default is "on") — wire-bit absent,
 *     so the server's env-driven default governs.
 *   - Session freshness: both spawns pass `--new` so the CLI doesn't
 *     resume a stored session. Each turn lands in a fresh server-side
 *     session, so the second side of a pair can't inherit context from
 *     the first.
 *
 * Usage
 * -----
 *   bun run usegin/effi-memory/experiments/005-effi-wiki-tool/harness/run.ts \
 *     --project <uuid> [--profile agent-dev] [--filter <substring>] \
 *     [--questions <path>] [--output-dir <path>] [--dry-run]
 *
 * What it does NOT do
 * -------------------
 *   - Score answers. That's a separate, human-in-the-loop pass.
 *   - Start `just agent-dev` or otherwise manage services.
 *   - Pull the project UUID from anywhere — caller passes it explicitly.
 *   - Mutate `~/.effi/` state beyond what plain `effi ask --new` does. The
 *     CLI's per-project `state.json` will end the run pointing at the
 *     last harness session_id for the named project; that's fine for a
 *     smoke project but the operator should be aware.
 *
 * Wire shape per pair under runs/<timestamp>/
 * -------------------------------------------
 *   NNN-off.jsonl        - trace JSONL line from `effi ask --trace-jsonl`
 *   NNN-off.stdout.txt   - assistant content (stdout)
 *   NNN-off.stderr.txt   - tool-call chatter + clock stamps (stderr)
 *   NNN-on.jsonl, ...    - same, with the curated wiki enabled
 *   index.md             - per-pair tool-call summary derived from the JSONL
 *   RESULTS.md           - scoring skeleton (human + LLM judge fills in)
 *
 * Part of: ENG-5379 (experiment 005, step 6/6)
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
	projectId: string;
	profile: string;
	outputDir: string;
	filter?: string;
	dryRun: boolean;
}

const HELP = `Usage: run.ts [options]

Run the experiment 005 eval harness: for each question in eval-questions.md,
spawn \`effi ask\` twice (wiki-off / wiki-on) against the same project and
persist per-pair artifacts.

Both sides hit the project named by --project. To make wiki-on meaningful,
that project must match the python-services \`EFFI_WIKI_PROJECT_ID\` env at
startup (the server's gate is per-project). The wiki-off side opts out per
request via \`effi ask --wiki off\`.

Options:
  --questions <path>          Path to eval-questions.md
                              (default: ../eval-questions.md relative to script)
  --project <uuid>            Project UUID for both sides (required). Must be the
                              project the server's EFFI_WIKI_PROJECT_ID designates
                              as wiki-eligible so wiki-on actually has wiki access.
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
			project: { type: "string" },
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

	if (!values.project) {
		process.stderr.write("Error: --project <uuid> is required.\n\n");
		process.stderr.write(HELP);
		process.exit(1);
	}

	return {
		questions: values.questions ?? defaultQuestions,
		projectId: values.project as string,
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
 * or deeper (`### `, `#### `, …) are ignored.
 *
 * The regex `^##\s+(.+)$` rejects `### foo` because `##` is followed by `#`
 * (not whitespace), so `\s+` fails. Same for any deeper heading. Verified
 * empirically — don't add a `startsWith("### ")` guard; it would be dead code.
 */
export function parseQuestions(markdown: string): string[] {
	const out: string[] = [];
	for (const rawLine of markdown.split(/\r?\n/)) {
		const line = rawLine.trimEnd();
		const m = line.match(/^##\s+(.+)$/);
		if (!m) continue;
		// m[1] is guaranteed by the capture group, but noUncheckedIndexedAccess
		// types it as `string | undefined`; narrow defensively.
		const captured = m[1];
		if (captured === undefined) continue;
		const text = captured.trim();
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

/**
 * Build the `effi ask` argv for one side of a pair.
 *
 * - `--new` forces a fresh server-side session per spawn so the second side
 *   can't inherit the first side's context (smoke finding 2, 2026-05-12).
 * - `--project <uuid>` overrides whatever project the profile is linked to,
 *   so both sides land in the same project regardless of CLI link state.
 * - `--wiki off` is added on the wiki-off side; the wiki-on side omits the
 *   flag so the body never carries `disable_wiki` (matches CLI omit-when-
 *   default idiom).
 */
function buildAskArgs(opts: {
	question: string;
	profile: string;
	projectId: string;
	tracePath: string;
	wikiOff: boolean;
}): string[] {
	const args = [
		"ask",
		opts.question,
		"--profile",
		opts.profile,
		"--project",
		opts.projectId,
		"--new",
		"--json",
		"--trace-jsonl",
		opts.tracePath,
	];
	if (opts.wikiOff) {
		args.push("--wiki", "off");
	}
	return args;
}

async function runEffiAsk(opts: {
	question: string;
	profile: string;
	projectId: string;
	tracePath: string;
	wikiOff: boolean;
}): Promise<SpawnResult> {
	const args = buildAskArgs(opts);

	return new Promise((resolveP, rejectP) => {
		// Inherit env cleanly — no per-process EFFI_WIKI_PROJECT_ID mutation.
		// The server's wiki gate is read at python-services startup, not per
		// request; the only knob that affects a single request is the body's
		// `disable_wiki` bit, which `--wiki off` controls.
		const child = spawn("effi", args, {
			env: process.env,
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
	/**
	 * What the CLI recorded as the wiki gate for this turn — i.e. `!disableWiki`.
	 * This reflects what the CLI _asked for_ (whether `--wiki off` was passed).
	 * It does NOT prove what the server actually did; the harness cross-checks
	 * this against the side it intended to run (see `expectedWikiEnabled` on
	 * `PairRecord`) so a CLI/proxy/server bug would surface as a WARN line in
	 * `index.md`. `null` when the trace is missing / empty / unparseable / or
	 * pre-dates the field.
	 */
	wikiEnabled: boolean | null;
}

function summarizeTrace(tracePath: string): TraceSummary {
	if (!existsSync(tracePath)) {
		return {
			toolCallChain: "(trace missing)",
			ttftMs: null,
			totalMs: null,
			missing: true,
			parseError: null,
			wikiEnabled: null,
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
			wikiEnabled: null,
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
			wikiEnabled: null,
		};
	}
	// `effi ask` is one-shot so a single line is expected; we read the last
	// line in case the file grew (defensive).
	const lastLine = lines[lines.length - 1];
	if (lastLine === undefined) {
		return {
			toolCallChain: "(trace empty)",
			ttftMs: null,
			totalMs: null,
			missing: true,
			parseError: null,
			wikiEnabled: null,
		};
	}
	try {
		const parsed = JSON.parse(lastLine) as {
			tool_calls?: Array<{ name?: string }>;
			ttft_ms?: number | null;
			total_ms?: number | null;
			wiki_enabled?: boolean | null;
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
			wikiEnabled:
				typeof parsed.wiki_enabled === "boolean" ? parsed.wiki_enabled : null,
		};
	} catch (err) {
		return {
			toolCallChain: "(trace unparseable)",
			ttftMs: null,
			totalMs: null,
			missing: false,
			parseError: err instanceof Error ? err.message : String(err),
			wikiEnabled: null,
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
	projectId: string;
	runDir: string;
}): Promise<PairRecord> {
	const n = padIndex(opts.index);
	const offTracePath = resolve(opts.runDir, `${n}-off.jsonl`);
	const onTracePath = resolve(opts.runDir, `${n}-on.jsonl`);

	const offResult = await runEffiAsk({
		question: opts.question,
		profile: opts.profile,
		projectId: opts.projectId,
		tracePath: offTracePath,
		wikiOff: true,
	});
	writeFileSync(resolve(opts.runDir, `${n}-off.stdout.txt`), offResult.stdout);
	writeFileSync(resolve(opts.runDir, `${n}-off.stderr.txt`), offResult.stderr);
	const offTrace = summarizeTrace(offTracePath);

	const onResult = await runEffiAsk({
		question: opts.question,
		profile: opts.profile,
		projectId: opts.projectId,
		tracePath: onTracePath,
		wikiOff: false,
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
	projectId: string;
	pairs: PairRecord[];
}): string {
	const lines: string[] = [];
	lines.push(`# Experiment 005 — run ${opts.timestamp}`);
	lines.push("");
	lines.push(`Profile: \`${opts.profile}\``);
	lines.push(`Project: \`${opts.projectId}\``);
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
		// Cross-check: the trace's `wiki_enabled` field is `!disableWiki` from
		// the CLI's point of view — i.e. it records whether `--wiki off` was
		// passed for this spawn. If it disagrees with the side we intended to
		// run, something is wrong in `resolveDisableWiki` or the trace-line
		// builder. The cross-check survived the env-toggle removal because
		// the field still encodes the per-request request, not the per-process
		// env.
		if (p.offTrace.wikiEnabled === true) {
			lines.push(
				"  - **WARN**: wiki-off side recorded `wiki_enabled=true` — " +
					"likely a bug in `resolveDisableWiki` or trace-JSONL wiring; investigate.",
			);
		}
		if (p.onTrace.wikiEnabled === false) {
			lines.push(
				"  - **WARN**: wiki-on side recorded `wiki_enabled=false` — " +
					"likely a bug in `resolveDisableWiki` or trace-JSONL wiring; investigate.",
			);
		}
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
	projectId: string;
	pairCount: number;
}): string {
	return `# Experiment 005 — run ${opts.timestamp}

Pairs: ${opts.pairCount}
Profile: \`${opts.profile}\`
Project: \`${opts.projectId}\`

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
	projectId: string;
	runDir: string;
}): string {
	const lines: string[] = [];
	lines.push(`# Dry run — ${opts.questions.length} question(s)`);
	lines.push(`# Run dir: ${opts.runDir}`);
	lines.push(`# Profile: ${opts.profile}`);
	lines.push(`# Project: ${opts.projectId}`);
	lines.push("");
	opts.questions.forEach((q, i) => {
		const n = padIndex(i + 1);
		const offTrace = resolve(opts.runDir, `${n}-off.jsonl`);
		const onTrace = resolve(opts.runDir, `${n}-on.jsonl`);
		const baseArgs =
			`--profile ${opts.profile} --project ${opts.projectId} --new --json`;
		lines.push(`# Q${n}: ${truncate(q, 80)}`);
		lines.push(
			`effi ask ${JSON.stringify(q)} ${baseArgs} ` +
				`--wiki off --trace-jsonl ${offTrace}`,
		);
		lines.push(
			`effi ask ${JSON.stringify(q)} ${baseArgs} --trace-jsonl ${onTrace}`,
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
				projectId: opts.projectId,
				runDir,
			}),
		);
		return;
	}

	mkdirSync(runDir, { recursive: true });
	process.stderr.write(`Run dir: ${runDir}\n`);
	process.stderr.write(`Project: ${opts.projectId}\n`);
	process.stderr.write(`Questions: ${questions.length}\n\n`);

	const pairs: PairRecord[] = [];
	for (let i = 0; i < questions.length; i++) {
		const idx = i + 1;
		// `i < questions.length` so the index is in-bounds, but
		// noUncheckedIndexedAccess types the access as `string | undefined`;
		// narrow defensively.
		const q = questions[i];
		if (q === undefined) continue;
		const n = padIndex(idx);
		const label = truncate(q, 60);
		process.stderr.write(`[${n}/${padIndex(questions.length)}] ${label}\n`);
		try {
			const pair = await runPair({
				index: idx,
				question: q,
				profile: opts.profile,
				projectId: opts.projectId,
				runDir,
			});
			pairs.push(pair);
			process.stderr.write(
				`  off:${fmtMs(pair.offTrace.totalMs)}` +
					` (${pair.offTrace.toolCallChain})` +
					`  on:${fmtMs(pair.onTrace.totalMs)}` +
					` (${pair.onTrace.toolCallChain})\n`,
			);
			if (pair.offTrace.wikiEnabled === true) {
				process.stderr.write(
					"  WARN: wiki-off side recorded wiki_enabled=true " +
						"(resolveDisableWiki / trace-JSONL bug?)\n",
				);
			}
			if (pair.onTrace.wikiEnabled === false) {
				process.stderr.write(
					"  WARN: wiki-on side recorded wiki_enabled=false " +
						"(resolveDisableWiki / trace-JSONL bug?)\n",
				);
			}
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
					wikiEnabled: null,
				},
				onTrace: {
					toolCallChain: "(skipped due to spawn error)",
					ttftMs: null,
					totalMs: null,
					missing: true,
					parseError: null,
					wikiEnabled: null,
				},
				offExitCode: -1,
				onExitCode: -1,
			});
		}
	}

	writeFileSync(
		resolve(runDir, "index.md"),
		renderIndex({
			timestamp,
			profile: opts.profile,
			projectId: opts.projectId,
			pairs,
		}),
	);
	writeFileSync(
		resolve(runDir, "RESULTS.md"),
		renderResultsSkeleton({
			timestamp,
			profile: opts.profile,
			projectId: opts.projectId,
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
