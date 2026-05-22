#!/usr/bin/env bun
/**
 * Backfill pre-generated session summaries into prod `dev_sessions` (ENG-5861).
 *
 * Corpus: `experiments/session-summaries-backfill/summaries.json` — 251 entries
 * shaped `{ session_id, summary, keywords, anchors, _grounding }`. Only
 * `session_id` and `summary` are uploaded; the rest is metadata from the
 * generation step and has no destination columns.
 *
 * Run (DRY-RUN — default, safe, makes no writes):
 *   doppler run -p next-app -c prd -- bun tools/session-sync/scripts/backfill-summaries.ts
 *
 * Run (EXECUTE — actually writes):
 *   doppler run -p next-app -c prd -- bun tools/session-sync/scripts/backfill-summaries.ts --execute
 *
 * Idempotency: every UPDATE carries a `summary IS NULL` guard, so re-runs are
 * safe — already-set rows are reported and skipped, never overwritten.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

type CorpusEntry = {
	session_id: string;
	summary: string;
	keywords?: unknown;
	anchors?: unknown;
	_grounding?: unknown;
};

type Args = {
	execute: boolean;
	dryRun: boolean;
	limit: number | null;
	only: string | null;
	verbose: boolean;
	help: boolean;
};

const USAGE = `Usage: bun tools/session-sync/scripts/backfill-summaries.ts [flags]

Uploads pre-generated session summaries from
  experiments/session-summaries-backfill/summaries.json
into prod \`dev_sessions.summary\` (ENG-5861).

Flags:
  --dry-run        (default) categorize matched/already_set/orphan; no writes
  --execute        actually perform UPDATEs (with summary IS NULL guard)
  --limit <n>      process only the first N corpus entries
  --only <id>      process exactly one session_id (overrides --limit)
  --verbose        also log per-row already_set / orphan lines
  --help           print this help and exit 0

Env (read at runtime, validated at startup):
  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL  (first set wins)
  SUPABASE_SERVICE_ROLE_KEY

Run dry-run first. Production target — be safe.
`;

function parseArgs(argv: string[]): Args {
	const a: Args = {
		execute: false,
		dryRun: true,
		limit: null,
		only: null,
		verbose: false,
		help: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const v = argv[i];
		if (v === "--help" || v === "-h") a.help = true;
		else if (v === "--execute") {
			a.execute = true;
			a.dryRun = false;
		} else if (v === "--dry-run") {
			a.dryRun = true;
			a.execute = false;
		} else if (v === "--limit") {
			const raw = argv[++i];
			if (raw === undefined || raw.startsWith("--")) {
				throw new Error(
					`Expected a positive integer after --limit, got: ${raw}`,
				);
			}
			const n = Number(raw);
			if (!Number.isFinite(n) || n <= 0) {
				throw new Error(`Expected a positive integer after --limit, got: ${raw}`);
			}
			a.limit = n;
		} else if (v === "--only") {
			const raw = argv[++i];
			if (raw === undefined || raw === "" || raw.startsWith("--")) {
				throw new Error(`Expected a session_id after --only, got: ${raw}`);
			}
			a.only = raw;
		} else if (v === "--verbose") a.verbose = true;
		else throw new Error(`Unknown flag: ${v}`);
	}
	return a;
}

function getSupabaseEnv(): { url: string; key: string } {
	const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const missing: string[] = [];
	if (!url) missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
	if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
	if (missing.length > 0) {
		throw new Error(
			`Missing required env: ${missing.join(", ")}.\n` +
				`Wrap the invocation in \`doppler run -p next-app -c prd --\` to inject prod creds.`,
		);
	}
	return { url: url as string, key: key as string };
}

async function main() {
	const argv = process.argv.slice(2);
	let args: Args;
	try {
		args = parseArgs(argv);
	} catch (e) {
		console.error((e as Error).message);
		console.error("");
		console.error(USAGE);
		process.exit(2);
	}

	if (args.help) {
		console.log(USAGE);
		process.exit(0);
	}

	const corpusPath = resolve(
		process.cwd(),
		"experiments/session-summaries-backfill/summaries.json",
	);
	const raw = await readFile(corpusPath, "utf8");
	const all = JSON.parse(raw) as CorpusEntry[];
	if (!Array.isArray(all)) {
		throw new Error(`Corpus at ${corpusPath} is not a JSON array`);
	}

	// Validate every corpus entry before talking to the DB. A malformed entry
	// (missing/empty session_id, non-UUID-shaped session_id, missing/empty
	// summary) is a corpus bug — abort loudly so the bad row gets fixed
	// upstream instead of silently no-op'ing or, worse, writing junk.
	const UUID_RE =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	for (let idx = 0; idx < all.length; idx++) {
		const e = all[idx];
		const tag =
			typeof e?.session_id === "string" && e.session_id.trim() !== ""
				? e.session_id
				: `index ${idx}`;
		if (typeof e?.session_id !== "string" || e.session_id.trim() === "") {
			console.error(`[invalid] ${tag}: session_id missing or empty`);
			process.exit(1);
		}
		if (!UUID_RE.test(e.session_id)) {
			console.error(`[invalid] ${tag}: session_id not UUID-shaped`);
			process.exit(1);
		}
		if (typeof e.summary !== "string" || e.summary.trim() === "") {
			console.error(`[invalid] ${tag}: summary missing or empty`);
			process.exit(1);
		}
	}

	// Env check happens AFTER --help and AFTER validation so validation
	// surfaces corpus bugs even without doppler creds.
	const { url, key } = getSupabaseEnv();

	let corpus: CorpusEntry[];
	if (args.only) {
		corpus = all.filter((e) => e.session_id === args.only);
		if (corpus.length === 0) {
			console.error(`--only ${args.only}: no matching entry in corpus`);
			process.exit(1);
		}
	} else {
		corpus = args.limit ? all.slice(0, args.limit) : all;
	}

	const client = createClient(url, key, { auth: { persistSession: false } });

	const mode = args.execute ? "EXECUTE" : "DRY-RUN";
	console.log(
		`[backfill-summaries] mode=${mode} corpus=${corpus.length}/${all.length} table=dev_sessions\n`,
	);

	let matched = 0;
	let wouldUpdate = 0;
	let updated = 0;
	let alreadySet = 0;
	let orphan = 0;
	const failures: { session_id: string; error: string }[] = [];

	// Batch SELECTs in parallel (50 at a time) — keeps it snappy without
	// hammering the API. UPDATEs run inside each task so the read-then-write
	// sequence stays local to one session_id.
	const BATCH = 50;
	for (let i = 0; i < corpus.length; i += BATCH) {
		const slice = corpus.slice(i, i + BATCH);
		await Promise.all(
			slice.map(async (entry) => {
				const sid = entry.session_id;
				try {
					const { data, error } = await client
						.from("dev_sessions")
						.select("id, summary")
						.eq("session_id", sid)
						.maybeSingle();
					if (error) throw new Error(`SELECT: ${error.message}`);

					if (!data) {
						orphan++;
						if (args.verbose) console.log(`[orphan] ${sid}`);
						return;
					}
					matched++;

					if (data.summary !== null && data.summary !== "") {
						alreadySet++;
						if (args.verbose) console.log(`[already_set] ${sid}`);
						return;
					}

					if (args.dryRun) {
						wouldUpdate++;
						console.log(`[would] ${sid}`);
						return;
					}

					// `summary_generated_at` is set to now() because the corpus
					// has no embedded per-entry generation timestamp — its
					// `_grounding` block carries only { dropped, summary_review,
					// anchor_tokens, anchor_tokens_grounded }. Leaving the
					// column NULL while `summary` is set would create a
					// confusing `summary IS NOT NULL AND summary_generated_at
					// IS NULL` state; now() is the closest honest value the
					// script can produce and matches what a live producer would
					// write.
					const { data: upRows, error: upErr } = await client
						.from("dev_sessions")
						.update({
							summary: entry.summary,
							summary_generated_at: new Date().toISOString(),
						})
						.eq("session_id", sid)
						.is("summary", null)
						.select("id");

					if (upErr) throw new Error(`UPDATE: ${upErr.message}`);

					if (!upRows || upRows.length === 0) {
						// Race: someone set it between our SELECT and UPDATE.
						// The IS NULL guard at the DB refused the write, so
						// this is honest counter accounting, not a fix-up.
						// This branch is only reachable in EXECUTE (DRY-RUN
						// returns above), so log unconditionally — a race in
						// production is worth seeing.
						alreadySet++;
						console.log(`[already_set:race] ${sid}`);
						return;
					}

					updated++;
					console.log(`[updated] ${sid}`);
				} catch (e) {
					failures.push({ session_id: sid, error: (e as Error).message });
					console.log(`[error] ${sid} :: ${(e as Error).message}`);
				}
			}),
		);
	}

	const summary = {
		mode,
		total_corpus: corpus.length,
		matched,
		would_update: wouldUpdate,
		updated,
		already_set: alreadySet,
		orphan_summary: orphan,
		failures: failures.length,
	};
	console.log("");
	console.log(JSON.stringify(summary));

	if (orphan > 0) {
		console.log(
			`note: ${orphan} corpus entries have no matching dev_sessions row — these sessions need the JSONL-side backfill first (tools/session-sync/scripts/backfill.ts, ENG-5863).`,
		);
	}

	if (failures.length > 0) {
		console.error(
			`\n${failures.length} failure(s) — first 5:`,
			JSON.stringify(failures.slice(0, 5), null, 2),
		);
		process.exit(1);
	}
}

main().catch((e) => {
	console.error((e as Error).stack ?? (e as Error).message);
	process.exit(1);
});
