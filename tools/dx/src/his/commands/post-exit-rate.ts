import { Command } from "commander";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { readState } from "../state";
import { lastHumanSubmissionSince } from "../db";

const SENTINEL_PATH = join(homedir(), ".claude", "dx-his", "last-ended-session.json");

export function buildHisPostExitRateCommand(): Command {
  return new Command("post-exit-rate")
    .description("After-claude-exits hook: if the last-ended session was armed for rating and the human hasn't rated, launch the interactive picker. Otherwise exit silent. Used by the claude() shell wrapper.")
    .option("--silent-on-error", "Always exit 0 even on error (default true — don't break shells)", true)
    .action(actionPostExitRate);
}

type Sentinel = {
  session_id: string;
  ended_at: string;
  force_rate: boolean;
  cwd?: string;
};

async function actionPostExitRate(_opts: { silentOnError: boolean }) {
  try {
    if (!existsSync(SENTINEL_PATH)) return;
    const raw = readFileSync(SENTINEL_PATH, "utf8");
    const sentinel = JSON.parse(raw) as Sentinel;
    if (!sentinel.session_id || !sentinel.force_rate) return;

    // Has the human already rated this session at any point?
    const state = readState(sentinel.session_id);
    if (state.last_human_rating_turn !== null) return;

    // Or any human submission since the session opened? (Belt + suspenders.)
    const epoch = "1970-01-01T00:00:00.000Z";
    if (lastHumanSubmissionSince(sentinel.session_id, epoch)) return;

    // Consume the sentinel before launching so a re-run doesn't re-fire.
    try { unlinkSync(SENTINEL_PATH); } catch {}

    process.stderr.write(`\n[his] Session ${sentinel.session_id.slice(0, 8)} ended without a rating — quick picker:\n`);
    const result = spawnSync(
      process.execPath,
      [process.argv[1] ?? "", "his", "rate-interactive", "--session-id", sentinel.session_id],
      { stdio: "inherit", env: process.env },
    );
    process.exit(result.status ?? 0);
  } catch {
    // Telemetry must never break the shell.
    return;
  }
}
