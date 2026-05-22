#!/usr/bin/env bun
/**
 * Overwrite `dev_sessions.summary` in prod with regenerated summaries from
 * `experiments/session-summaries-backfill/regen-results/<session_id>.json`
 * (ENG-5861 verifier sweep).
 *
 * Each regen-result has `outcome: "regenerated" | "still_ungrounded" | "error"`
 * and `entry.summary`. We update only `outcome === "regenerated"` rows.
 *
 * Guard: only overwrites a row whose current `summary` matches the OLD
 * corpus summary (passed via --old-corpus). This ensures we don't clobber
 * a row that's been edited by someone else since the prior backfill.
 *
 * Run:
 *   doppler/railway-injected env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *   bun tools/session-sync/scripts/update-regenerated-summaries.ts \
 *     --regen-dir $CLAUDE_JOB_DIR/regen-results \
 *     --old-corpus experiments/session-summaries-backfill/summaries.json \
 *     [--execute]   (default dry-run)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

type RegenResult = {
  session_id: string;
  outcome: "regenerated" | "still_ungrounded" | "error";
  entry: { summary?: string } | null;
};
type CorpusEntry = { session_id: string; summary: string };

function flag(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}

const REGEN = flag("regen-dir", `${process.env.CLAUDE_JOB_DIR}/regen-results`)!;
const OLD_CORPUS = flag("old-corpus", "experiments/session-summaries-backfill/summaries.json")!;
const EXECUTE = process.argv.includes("--execute");
const VERBOSE = process.argv.includes("--verbose");

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run via `railway run --service nextjs-app -- ...` or doppler.",
  );
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });

const corpus: CorpusEntry[] = JSON.parse(readFileSync(OLD_CORPUS, "utf8"));
const oldById = new Map(corpus.map((e) => [e.session_id, e.summary]));

const files = readdirSync(REGEN).filter((f) => f.endsWith(".json") && !f.startsWith("_"));

let attempted = 0;
let writtenOrWould = 0;
let skippedNotRegen = 0;
let skippedSameText = 0;
let mismatchSkipped = 0; // current row's summary != old corpus — don't touch
let failures: { session_id: string; error: string }[] = [];

const mode = EXECUTE ? "EXECUTE" : "DRY-RUN";
console.log(`[update-regen] mode=${mode}  regen-files=${files.length}  corpus=${corpus.length}\n`);

const BATCH = 8;
for (let i = 0; i < files.length; i += BATCH) {
  const slice = files.slice(i, i + BATCH);
  await Promise.all(
    slice.map(async (f) => {
      attempted++;
      const r: RegenResult = JSON.parse(readFileSync(join(REGEN, f), "utf8"));
      const sid = r.session_id;
      if (r.outcome !== "regenerated" || !r.entry?.summary) {
        skippedNotRegen++;
        if (VERBOSE) console.log(`[skip:${r.outcome}] ${sid}`);
        return;
      }
      const newSummary = r.entry.summary;
      const oldSummary = oldById.get(sid);
      if (oldSummary === undefined) {
        failures.push({ session_id: sid, error: "session_id not in old corpus" });
        return;
      }
      if (newSummary === oldSummary) {
        skippedSameText++;
        if (VERBOSE) console.log(`[same] ${sid}`);
        return;
      }

      // Read current row first to verify guard.
      const { data: current, error: selErr } = await client
        .from("dev_sessions")
        .select("summary")
        .eq("session_id", sid)
        .maybeSingle();
      if (selErr) {
        failures.push({ session_id: sid, error: `SELECT: ${selErr.message}` });
        return;
      }
      if (!current) {
        failures.push({ session_id: sid, error: "no dev_sessions row" });
        return;
      }
      if (current.summary !== oldSummary) {
        mismatchSkipped++;
        console.log(`[mismatch] ${sid} — current row summary differs from old corpus; not overwriting`);
        return;
      }

      if (!EXECUTE) {
        writtenOrWould++;
        console.log(`[would] ${sid}`);
        return;
      }

      const { data: upRows, error: upErr } = await client
        .from("dev_sessions")
        .update({
          summary: newSummary,
          summary_generated_at: new Date().toISOString(),
        })
        .eq("session_id", sid)
        .eq("summary", oldSummary) // race-safe overwrite guard
        .select("id");
      if (upErr) {
        failures.push({ session_id: sid, error: `UPDATE: ${upErr.message}` });
        return;
      }
      if (!upRows || upRows.length === 0) {
        // Lost the race — someone wrote between our SELECT and UPDATE.
        mismatchSkipped++;
        console.log(`[mismatch:race] ${sid}`);
        return;
      }
      writtenOrWould++;
      console.log(`[updated] ${sid}`);
    }),
  );
}

console.log("");
console.log(
  JSON.stringify({
    mode,
    attempted,
    [EXECUTE ? "updated" : "would_update"]: writtenOrWould,
    skipped_not_regenerated: skippedNotRegen,
    skipped_same_text: skippedSameText,
    skipped_mismatch: mismatchSkipped,
    failures: failures.length,
  }),
);

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s) — first 5:`, JSON.stringify(failures.slice(0, 5), null, 2));
  process.exit(1);
}
