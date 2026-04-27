import { Command } from "commander";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { dxShouldOutputJson } from "../../output";

type Step = { name: string; ok: boolean; detail?: string };

export function buildHisSelfTestCommand(): Command {
  return new Command("self-test")
    .description("End-to-end smoke test for the his hook flow: rate, end, hook-stop blocks, hook-stop unblocks. Uses an isolated temp DB and state dir.")
    .option("--keep-temp", "Keep the temp DB/state dirs for debugging", false)
    .action(actionSelfTest);
}

async function actionSelfTest(opts: { keepTemp?: boolean }) {
  const tmpRoot = mkdtempSync(join(tmpdir(), "dx-his-selftest-"));
  const dbPath = join(tmpRoot, "his.db");
  const stateDir = join(tmpRoot, "state");
  const sid = "selftest-session";
  const env = {
    ...process.env,
    DX_HIS_DB: dbPath,
    DX_HIS_STATE_DIR: stateDir,
    CLAUDE_SESSION_ID: sid,
    DX_OUTPUT: "json",
    DX_HIS_QUIET: "1",
  };
  const dxBin = resolveDxBin();
  const steps: Step[] = [];

  const run = (args: string[], stdin?: string) =>
    spawnSync(dxBin, args, {
      env,
      input: stdin,
      encoding: "utf8",
    });

  // 1. fresh state — Stop should allow.
  let r = run(["his", "hook-stop"], JSON.stringify({ session_id: sid }));
  steps.push(stepFromHookOutput("fresh-stop allows", r.stdout, (j) => j.continue === true));

  // 2. arm via end.
  r = run(["his", "end"]);
  steps.push({
    name: "end arms force_rate",
    ok: r.status === 0 && safeJson(r.stdout)?.state?.force_rate === true,
    detail: r.stderr || undefined,
  });

  // 3. armed Stop without rating should block.
  r = run(["his", "hook-stop"], JSON.stringify({ session_id: sid }));
  steps.push(stepFromHookOutput("armed-stop blocks", r.stdout, (j) => j.decision === "block" && typeof j.reason === "string"));

  // 4. Claude files a rating.
  r = run([
    "his", "rate",
    "vibe=80,accuracy=85,understood_human=90",
    "--as=claude",
    "--trigger=stop-hook",
    "--note", "self-test rating: looks healthy",
  ]);
  steps.push({
    name: "claude rate clears force_rate",
    ok: r.status === 0 && safeJson(r.stdout)?.ok === true,
    detail: r.stderr || undefined,
  });

  // 5. next Stop should allow again.
  r = run(["his", "hook-stop"], JSON.stringify({ session_id: sid }));
  steps.push(stepFromHookOutput("post-rate stop allows", r.stdout, (j) => j.continue === true));

  // 6. arm-on-wrapup: simulate a wrap-up phrase.
  const armHookPath = join(process.cwd(), ".claude", "hooks", "dx-his-arm-on-wrapup.ts");
  const armRun = spawnSync("bun", [armHookPath], {
    env,
    input: JSON.stringify({ session_id: sid + "-wrap", prompt: "thanks gin, that's a wrap" }),
    encoding: "utf8",
  });
  const armOut = safeJson(armRun.stdout);
  steps.push({
    name: "arm-on-wrapup detects sentinel",
    ok: armRun.status === 0 && armOut?.continue === true && typeof armOut?.hookSpecificOutput?.additionalContext === "string",
    detail: armRun.stderr || undefined,
  });

  // 7. arm-on-wrapup ignores normal prompts.
  const armRun2 = spawnSync("bun", [armHookPath], {
    env,
    input: JSON.stringify({ session_id: sid + "-normal", prompt: "fix the failing test" }),
    encoding: "utf8",
  });
  const armOut2 = safeJson(armRun2.stdout);
  steps.push({
    name: "arm-on-wrapup ignores normal prompt",
    ok: armRun2.status === 0 && armOut2?.continue === true && armOut2?.hookSpecificOutput === undefined,
  });

  if (!opts.keepTemp) rmSync(tmpRoot, { recursive: true, force: true });

  const allOk = steps.every((s) => s.ok);
  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify({ ok: allOk, steps, tmp: opts.keepTemp ? tmpRoot : null }, null, 2) + "\n");
    process.exit(allOk ? 0 : 1);
  }
  for (const s of steps) {
    process.stdout.write(`${s.ok ? "✓" : "✗"} ${s.name}${s.detail ? ` — ${s.detail.trim().split("\n")[0]}` : ""}\n`);
  }
  process.stdout.write(`\n${allOk ? "all passed" : "FAILED"}\n`);
  process.exit(allOk ? 0 : 1);
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function stepFromHookOutput(name: string, stdout: string, predicate: (j: any) => boolean): Step {
  const j = safeJson(stdout);
  return { name, ok: !!j && predicate(j), detail: j ? undefined : `bad json: ${stdout.slice(0, 80)}` };
}

function resolveDxBin(): string {
  // `tools/bin/dx` is what the hooks resolve to — use the same.
  const repoRoot = process.cwd();
  return join(repoRoot, "tools", "bin", "dx");
}
